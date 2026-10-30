'use strict';
/*
 * La Crepería & Co — carta digital con panel de administración.
 * Node 22+ (usa node:sqlite, sin dependencias nativas), Express y QRCode.
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const QRCode = require('qrcode');
const { openDb } = require('./lib/db');
const ai = require('./lib/ai');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const ON_RAILWAY = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const HAS_VOLUME = !!(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH) || !ON_RAILWAY;
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');

const db = openDb(DATA_DIR, path.join(__dirname, 'seed'));
if (!ADMIN_PASSWORD) console.warn('[aviso] ADMIN_PASSWORD no está configurada: el panel /admin queda bloqueado.');
if (!HAS_VOLUME) console.warn('[aviso] No hay volumen persistente: los cambios se perderán en el próximo deploy. Agrega un Volume montado en /data.');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

/* ---------- seguridad básica ---------- */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

/* ---------- sesiones (cookie firmada) ---------- */
const SECRET = db.getSecret();
const COOKIE = 'lc_admin';
const SESSION_DAYS = 30;
function sign(v) { return crypto.createHmac('sha256', SECRET).update(v).digest('base64url'); }
function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5, pw: sign('pw:' + ADMIN_PASSWORD).slice(0, 12) })).toString('base64url');
  return payload + '.' + sign(payload);
}
function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const tok = readCookie(req, COOKIE); if (!tok) return false;
  const [payload, sig] = tok.split('.');
  if (!payload || !sig) return false;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try {
    const o = JSON.parse(Buffer.from(payload, 'base64url').toString());
    // si cambias ADMIN_PASSWORD, las sesiones anteriores dejan de valer
    return o.exp > Date.now() && o.pw === sign('pw:' + ADMIN_PASSWORD).slice(0, 12);
  } catch { return false; }
}
function setSession(req, res, value, maxAge) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a ingresar la contraseña.' });
  // protección CSRF: las escrituras deben venir de esta misma página
  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    let host = null; try { host = origin ? new URL(origin).host : null; } catch { host = 'invalid'; }
    if (origin && host !== req.headers.host) return res.status(403).json({ error: 'Origen no permitido.' });
    if (req.headers['x-lc'] !== '1') return res.status(403).json({ error: 'Solicitud no permitida.' });
  }
  next();
}

/* límite de intentos de login por IP */
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now(), a = (attempts.get(ip) || []).filter(t => now - t < 15 * 60e3);
  attempts.set(ip, a);
  return a.length >= 8;
}

/* ---------- páginas ---------- */
const PUB = path.join(__dirname, 'public');
const TEMPLATE = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const ASSET_V = crypto.createHash('sha1').update(fs.readFileSync(path.join(PUB, 'assets', 'app.js'))).update(fs.readFileSync(path.join(PUB, 'assets', 'style.css'))).digest('hex').slice(0, 10);
function jsonForHtml(o) { return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
function escAttr(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function renderPage(req, mode) {
  const menu = db.getMenu();
  const base = SITE_URL || `${req.protocol}://${req.get('host')}`;
  const firstPhoto = (menu.productos.find(p => p.foto && !p.oculto) || {}).foto;
  return TEMPLATE
    .replace(/__TITLE__/g, escAttr(menu.info.nombre || 'La Crepería & Co'))
    .replace(/__DESC__/g, escAttr(menu.info.lema || ''))
    .replace(/__URL__/g, escAttr(base + '/'))
    .replace(/__OGIMG__/g, escAttr(firstPhoto ? base + '/img/' + firstPhoto : base + '/assets/icon-512.png'))
    .replace(/__V__/g, ASSET_V)
    .replace('__MODE__', mode)
    .replace('__DATA__', jsonForHtml(menu));
}
app.get('/', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.type('html').send(renderPage(req, 'public')); });
app.get('/admin', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex'); res.type('html').send(renderPage(req, 'admin')); });
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use('/assets', express.static(path.join(PUB, 'assets'), { maxAge: '7d' }));

app.get('/img/:id', (req, res) => {
  const img = db.getImage(req.params.id);
  if (!img) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.type(img.mime).send(Buffer.from(img.data));
});

/* QR público de la carta (útil para imprimir) */
app.get('/qr.svg', async (req, res) => {
  const base = SITE_URL || `${req.protocol}://${req.get('host')}`;
  const svg = await QRCode.toString(base + '/', { type: 'svg', margin: 2, color: { dark: '#033555', light: '#ffffff' }, errorCorrectionLevel: 'M' });
  res.type('image/svg+xml').setHeader('Cache-Control', 'public, max-age=3600');
  if (req.query.download) res.setHeader('Content-Disposition', 'attachment; filename="qr-carta-la-creperia.svg"');
  res.send(svg);
});
app.get('/qr.png', async (req, res) => {
  const base = SITE_URL || `${req.protocol}://${req.get('host')}`;
  const buf = await QRCode.toBuffer(base + '/', { type: 'png', margin: 2, width: 1200, color: { dark: '#033555', light: '#ffffff' }, errorCorrectionLevel: 'M' });
  res.type('image/png').setHeader('Content-Disposition', 'attachment; filename="qr-carta-la-creperia.png"');
  res.send(buf);
});

/* ---------- API admin ---------- */
const api = express.Router();
api.use(express.json({ limit: '3mb' }));

api.get('/session', (req, res) => {
  res.json({ admin: isAdmin(req), configured: !!ADMIN_PASSWORD, ai: ai.enabled(), volume: HAS_VOLUME });
});
api.post('/login', (req, res) => {
  const ip = req.ip || 'x';
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Falta configurar la variable ADMIN_PASSWORD en el servidor.' });
  if (tooMany(ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos y vuelve a probar.' });
  const pw = String((req.body && req.body.password) || '');
  const a = crypto.createHash('sha256').update(pw).digest(), b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a, b)) { attempts.get(ip).push(Date.now()); return res.status(401).json({ error: 'Contraseña incorrecta.' }); }
  attempts.delete(ip);
  setSession(req, res, makeToken(), SESSION_DAYS * 86400);
  res.json({ ok: true, ai: ai.enabled(), volume: HAS_VOLUME });
});
api.post('/logout', (req, res) => { setSession(req, res, '', 0); res.json({ ok: true }); });

api.get('/menu', requireAdmin, (req, res) => res.json({ menu: db.getMenu(), version: db.currentVersion() }));
api.put('/menu', requireAdmin, (req, res) => {
  const { menu, baseVersion } = req.body || {};
  const err = validateMenu(menu);
  if (err) return res.status(400).json({ error: err });
  const cur = db.currentVersion();
  if (baseVersion && cur && baseVersion !== cur.id) {
    return res.status(409).json({ error: 'La carta cambió desde otro dispositivo mientras editabas. Recarga para ver la versión nueva.', version: cur });
  }
  const missing = [...imageRefs(menu)].filter(id => !db.hasImage(id));
  if (missing.length) return res.status(400).json({ error: 'Hay fotos que no se encontraron en el servidor. Vuelve a subirlas.' });
  const v = db.saveMenu(menu);
  db.collectGarbage();
  res.json({ ok: true, version: v });
});
api.get('/history', requireAdmin, (req, res) => res.json({ versions: db.listVersions(30) }));
api.post('/history/:id/restore', requireAdmin, (req, res) => {
  const m = db.getVersion(req.params.id);
  if (!m) return res.status(404).json({ error: 'Esa versión ya no existe.' });
  const v = db.saveMenu(m, 'Restaurada desde ' + req.params.id);
  res.json({ ok: true, version: v, menu: m });
});

api.post('/images', requireAdmin, express.raw({ type: ['image/*'], limit: '6mb' }), (req, res) => {
  const buf = req.body;
  const mime = sniff(buf);
  if (!mime) return res.status(400).json({ error: 'El archivo no es una imagen JPG, PNG o WEBP.' });
  res.json({ id: db.putImage(buf, mime) });
});

api.post('/ai/enhance', requireAdmin, async (req, res) => {
  const { imageId, nombre, desc, extra } = req.body || {};
  const img = imageId && db.getImage(imageId);
  if (!img) return res.status(400).json({ error: 'Primero sube una foto para usarla como referencia.' });
  try {
    const out = await ai.enhance(Buffer.from(img.data), img.mime, { nombre, desc, extra });
    res.json({ id: db.putImage(out.buffer, out.mime) });
  } catch (e) { res.status(e.status || 502).json({ error: e.message }); }
});
api.post('/ai/generate', requireAdmin, async (req, res) => {
  const { nombre, desc, extra } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'El producto necesita un nombre.' });
  try {
    const out = await ai.generate({ nombre, desc, extra });
    res.json({ id: db.putImage(out.buffer, out.mime) });
  } catch (e) { res.status(e.status || 502).json({ error: e.message }); }
});

app.use('/api/admin', api);
app.use((req, res) => res.status(404).type('text').send('No encontrado'));
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 413 ? 'El archivo es demasiado grande.' : 'Error del servidor.' });
});

/* ---------- validación ---------- */
function sniff(b) {
  if (!b || !b.length) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
function imageRefs(m) {
  const s = new Set();
  for (const p of m.productos) if (p.foto) s.add(p.foto);
  if (m.bowl && m.bowl.foto) s.add(m.bowl.foto);
  return s;
}
function validateMenu(m) {
  const str = (v, max) => typeof v === 'string' && v.length <= max;
  const num = v => Number.isFinite(v) && v >= 0 && v < 1e8;
  if (!m || typeof m !== 'object') return 'Carta vacía.';
  if (!m.info || typeof m.info !== 'object') return 'Faltan los datos del local.';
  for (const k of ['nombre', 'lema', 'ubicacion', 'instagram', 'horario', 'pie', 'aviso', 'whatsapp']) if (m.info[k] != null && !str(m.info[k], 400)) return 'Dato del local inválido: ' + k;
  if (!Array.isArray(m.grupos) || !Array.isArray(m.categorias) || !Array.isArray(m.productos)) return 'Estructura de carta inválida.';
  if (m.productos.length > 2000 || m.categorias.length > 200) return 'La carta es demasiado grande.';
  const cats = new Set();
  for (const c of m.categorias) { if (!str(c.id, 60) || !str(c.nombre, 120) || !str(c.grupo, 60) || (c.nota != null && !str(c.nota, 600))) return 'Categoría inválida.'; cats.add(c.id); }
  const ids = new Set();
  for (const p of m.productos) {
    if (!str(p.id, 60) || ids.has(p.id)) return 'Producto con identificador inválido.';
    ids.add(p.id);
    if (!str(p.nombre, 160) || !str(p.desc || '', 800) || !num(p.precio)) return `Revisa el producto “${String(p.nombre || '').slice(0, 40)}”: nombre, descripción o precio inválido.`;
    if (!cats.has(p.cat)) return `El producto “${p.nombre}” está en una categoría que no existe.`;
    if (!Array.isArray(p.tags) || p.tags.some(t => !str(t, 30))) return 'Íconos inválidos.';
    if (p.foto && !str(p.foto, 80)) return 'Foto inválida.';
  }
  const b = m.bowl;
  if (b) {
    if (!Array.isArray(b.tamanos) || !Array.isArray(b.extras) || !Array.isArray(b.incluidos)) return 'Armador de bowl inválido.';
    for (const s of b.tamanos) if (!str(s.nombre, 60) || !num(s.precio) || !num(s.ml)) return 'Tamaño de bowl inválido.';
    for (const e of b.extras) if (!str(e.nombre, 80) || !num(e.precio)) return 'Topping extra inválido.';
    for (const i of b.incluidos) if (!str(i, 80)) return 'Topping incluido inválido.';
  }
  return null;
}

app.listen(PORT, '0.0.0.0', () => console.log(`La Crepería & Co lista en http://localhost:${PORT}  (datos en ${DATA_DIR})`));
