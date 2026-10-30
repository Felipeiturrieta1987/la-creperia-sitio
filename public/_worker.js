/*
 * La Crepería & Co — versión para Cloudflare Pages (gratis).
 * Base de datos: Cloudflare D1 conectada con el nombre DB.
 * Variables: ADMIN_PASSWORD (obligatoria), OPENAI_API_KEY (opcional), OPENAI_IMAGE_MODEL, OPENAI_IMAGE_QUALITY.
 */
const KEEP_VERSIONS = 40;
const SESSION_DAYS = 30;
const COOKIE = 'lc_admin';
const ASSET_V = '2';
const enc = new TextEncoder();

let ready = null;
let template = null;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === '/' || p === '/index.html') return await page(request, env, 'public');
      if (p === '/admin' || p === '/admin/') return await page(request, env, 'admin');
      if (p === '/healthz') return json({ ok: true, db: !!env.DB });
      if (p.startsWith('/img/')) return await image(request, env, ctx, decodeURIComponent(p.slice(5)));
      if (p.startsWith('/api/admin/')) return await api(request, env, ctx, p.slice(11));
      return env.ASSETS.fetch(request);
    } catch (e) {
      if (e && e.message === 'NO_DB') return noDb(p);
      console.error(e && e.stack || e);
      return json({ error: 'Error del servidor.' }, 500);
    }
  },
};

/* ---------------- utilidades ---------------- */
function json(o, status = 200, headers = {}) {
  return new Response(JSON.stringify(o), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers) });
}
function err(status, message) { const e = new Error(message); e.status = status; return e; }
function hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function b64url(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlDecode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function sameStr(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
function escAttr(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function jsonForHtml(str) { return str.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
async function sha256(data) { return crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data); }

function noDb(p) {
  const msg = 'Falta conectar la base de datos. En Cloudflare: tu proyecto → Settings → Bindings → Add → D1 database, nombre de variable DB. Luego vuelve a desplegar.';
  if (p.startsWith('/api/')) return json({ error: msg }, 503);
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configuración pendiente</title><body style="font-family:system-ui;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.5"><h1>Casi listo</h1><p>' + msg + '</p></body>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/* ---------------- base de datos ---------------- */
async function init(env, origin) {
  if (!env.DB) throw new Error('NO_DB');
  if (!ready) {
    ready = (async () => {
      await env.DB.batch([
        env.DB.prepare('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
        env.DB.prepare("CREATE TABLE IF NOT EXISTS versions (id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT NOT NULL, note TEXT, data TEXT NOT NULL, refs TEXT NOT NULL DEFAULT '', productos INTEGER NOT NULL DEFAULT 0, agotados INTEGER NOT NULL DEFAULT 0)"),
        env.DB.prepare('CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created INTEGER NOT NULL)'),
        env.DB.prepare('CREATE TABLE IF NOT EXISTS attempts (ip TEXT NOT NULL, ts INTEGER NOT NULL)'),
      ]);
      const has = await env.DB.prepare('SELECT id FROM versions LIMIT 1').first();
      if (!has) {
        const r = await env.ASSETS.fetch(new Request(origin + '/seed/menu.json'));
        if (!r.ok) throw new Error('No se encontró la carta inicial (seed/menu.json).');
        const menu = await r.json();
        await saveMenu(env, menu, 'Carta inicial', true);
      }
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}
function summary(menu) {
  const refs = new Set();
  for (const p of menu.productos) if (p.foto) refs.add(p.foto);
  if (menu.bowl && menu.bowl.foto) refs.add(menu.bowl.foto);
  return { refs: [...refs].join(','), productos: menu.productos.length, agotados: menu.productos.filter(p => p.agotado).length };
}
async function saveMenu(env, menu, note, onlyIfEmpty) {
  const created = new Date().toISOString();
  const s = summary(menu), data = JSON.stringify(menu);
  const sql = onlyIfEmpty
    ? 'INSERT INTO versions (created, note, data, refs, productos, agotados) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM versions)'
    : 'INSERT INTO versions (created, note, data, refs, productos, agotados) VALUES (?, ?, ?, ?, ?, ?)';
  const r = await env.DB.prepare(sql).bind(created, note || null, data, s.refs, s.productos, s.agotados).run();
  await env.DB.prepare('DELETE FROM versions WHERE id NOT IN (SELECT id FROM versions ORDER BY id DESC LIMIT ?)').bind(KEEP_VERSIONS).run();
  return { id: Number(r.meta && r.meta.last_row_id), created };
}
async function current(env) {
  return env.DB.prepare('SELECT id, created, data FROM versions ORDER BY id DESC LIMIT 1').first();
}
async function collectGarbage(env) {
  const used = new Set();
  const rows = (await env.DB.prepare('SELECT refs FROM versions').all()).results || [];
  for (const r of rows) for (const id of String(r.refs || '').split(',')) if (id) used.add(id);
  const old = (await env.DB.prepare('SELECT id FROM images WHERE created < ?').bind(Date.now() - 2 * 864e5).all()).results || [];
  const del = old.filter(r => !used.has(r.id)).map(r => env.DB.prepare('DELETE FROM images WHERE id = ?').bind(r.id));
  if (del.length) await env.DB.batch(del);
}
async function secret(env) {
  let row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'secret'").first();
  if (!row) {
    const v = hex(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('secret', ?)").bind(v).run();
    row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'secret'").first();
  }
  return row.value;
}

/* ---------------- páginas ---------------- */
async function page(request, env, mode) {
  const origin = new URL(request.url).origin;
  await init(env, origin);
  if (!template) {
    const r = await env.ASSETS.fetch(new Request(origin + '/'));
    template = await r.text();
  }
  const row = await current(env);
  let info = {}, firstPhoto = '';
  try { const m = JSON.parse(row.data); info = m.info || {}; firstPhoto = ((m.productos || []).find(p => p.foto && !p.oculto) || {}).foto || ''; } catch { }
  const base = (env.SITE_URL || origin).replace(/\/+$/, '');
  const html = template
    .replace(/__TITLE__/g, escAttr(info.nombre || 'La Crepería & Co'))
    .replace(/__DESC__/g, escAttr(info.lema || ''))
    .replace(/__URL__/g, escAttr(base + '/'))
    .replace(/__OGIMG__/g, escAttr(firstPhoto ? base + '/img/' + firstPhoto : base + '/assets/icon-512.png'))
    .replace(/__V__/g, ASSET_V)
    .replace('__MODE__', mode)
    .replace('__DATA__', () => jsonForHtml(row.data));
  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': mode === 'admin' ? 'no-store' : 'no-cache', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'SAMEORIGIN' };
  if (mode === 'admin') headers['x-robots-tag'] = 'noindex';
  return new Response(html, { headers });
}

async function image(request, env, ctx, id) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return new Response('No encontrado', { status: 404 });
  const origin = new URL(request.url).origin;
  const cache = caches.default, key = new Request(origin + '/img/' + id);
  let res = await cache.match(key);
  if (res) return res;
  await init(env, origin);
  const row = await env.DB.prepare('SELECT mime, data FROM images WHERE id = ?').bind(id).first();
  if (row) {
    res = new Response(new Uint8Array(row.data), { headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable' } });
    ctx.waitUntil(cache.put(key, res.clone()).catch(() => { }));
    return res;
  }
  const a = await env.ASSETS.fetch(new Request(origin + '/seed/img/' + id + '.webp'));
  if (a.ok && (a.headers.get('content-type') || '').startsWith('image/')) {
    return new Response(a.body, { headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=86400' } });
  }
  return new Response('No encontrado', { status: 404 });
}
async function imageExists(env, origin, id) {
  if (await env.DB.prepare('SELECT 1 AS x FROM images WHERE id = ?').bind(id).first()) return true;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return false;
  const a = await env.ASSETS.fetch(new Request(origin + '/seed/img/' + id + '.webp'));
  return a.ok && (a.headers.get('content-type') || '').startsWith('image/');
}

/* ---------------- sesión ---------------- */
function readCookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg))));
}
async function pwTag(env, sec) { return (await hmac(sec, 'pw:' + env.ADMIN_PASSWORD)).slice(0, 12); }
async function makeToken(env) {
  const sec = await secret(env);
  const payload = b64url(enc.encode(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5, pw: await pwTag(env, sec) })));
  return payload + '.' + await hmac(sec, payload);
}
async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const tok = readCookie(request, COOKIE); if (!tok) return false;
  const [payload, sig] = tok.split('.');
  if (!payload || !sig) return false;
  const sec = await secret(env);
  if (!sameStr(sig, await hmac(sec, payload))) return false;
  try {
    const o = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    return o.exp > Date.now() && o.pw === await pwTag(env, sec);
  } catch { return false; }
}
function sessionCookie(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:';
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

/* ---------------- API ---------------- */
async function api(request, env, ctx, route) {
  const origin = new URL(request.url).origin;
  await init(env, origin);
  const method = request.method;
  const ai = !!env.OPENAI_API_KEY;

  if (route === 'session' && method === 'GET') return json({ admin: await isAdmin(request, env), configured: !!env.ADMIN_PASSWORD, ai, volume: true });

  if (route === 'login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD) return json({ error: 'Falta configurar la variable ADMIN_PASSWORD en Cloudflare.' }, 503);
    const ip = request.headers.get('cf-connecting-ip') || 'x';
    const since = Date.now() - 15 * 60e3;
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE ip = ? AND ts > ?').bind(ip, since).first();
    if (n && n.n >= 8) return json({ error: 'Demasiados intentos. Espera 15 minutos y vuelve a probar.' }, 429);
    let body = {}; try { body = await request.json(); } catch { }
    const a = hex(await sha256(String(body.password || ''))), b = hex(await sha256(env.ADMIN_PASSWORD));
    if (!sameStr(a, b)) {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO attempts (ip, ts) VALUES (?, ?)').bind(ip, Date.now()),
        env.DB.prepare('DELETE FROM attempts WHERE ts < ?').bind(since),
      ]);
      return json({ error: 'Contraseña incorrecta.' }, 401);
    }
    await env.DB.prepare('DELETE FROM attempts WHERE ip = ?').bind(ip).run();
    return json({ ok: true, ai, volume: true }, 200, { 'set-cookie': sessionCookie(request, await makeToken(env), SESSION_DAYS * 86400) });
  }
  if (route === 'logout' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': sessionCookie(request, '', 0) });

  // a partir de aquí, solo administradores
  if (!(await isAdmin(request, env))) return json({ error: 'Tu sesión expiró. Vuelve a ingresar la contraseña.' }, 401);
  if (method !== 'GET') {
    const o = request.headers.get('origin');
    let host = null; try { host = o ? new URL(o).host : null; } catch { host = 'invalid'; }
    if (o && host !== new URL(request.url).host) return json({ error: 'Origen no permitido.' }, 403);
    if (request.headers.get('x-lc') !== '1') return json({ error: 'Solicitud no permitida.' }, 403);
  }

  if (route === 'menu' && method === 'GET') {
    const row = await current(env);
    return new Response('{"menu":' + row.data + ',"version":' + JSON.stringify({ id: row.id, created: row.created }) + '}', { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (route === 'menu' && method === 'PUT') {
    const text = await request.text();
    if (text.length > 3e6) return json({ error: 'La carta es demasiado grande.' }, 413);
    let body; try { body = JSON.parse(text); } catch { return json({ error: 'Datos inválidos.' }, 400); }
    const { menu, baseVersion } = body || {};
    const e = validateMenu(menu); if (e) return json({ error: e }, 400);
    const cur = await env.DB.prepare('SELECT id, created FROM versions ORDER BY id DESC LIMIT 1').first();
    if (baseVersion && cur && baseVersion !== cur.id) return json({ error: 'La carta cambió desde otro dispositivo mientras editabas. Recarga para ver la versión nueva.', version: cur }, 409);
    for (const id of summary(menu).refs.split(',').filter(Boolean)) {
      if (!(await imageExists(env, origin, id))) return json({ error: 'Hay fotos que no se encontraron en el servidor. Vuelve a subirlas.' }, 400);
    }
    const v = await saveMenu(env, menu);
    ctx.waitUntil(collectGarbage(env).catch(() => { }));
    return json({ ok: true, version: v });
  }
  if (route === 'history' && method === 'GET') {
    const rows = (await env.DB.prepare('SELECT id, created, note, productos, agotados FROM versions ORDER BY id DESC LIMIT 30').all()).results || [];
    return json({ versions: rows });
  }
  let m;
  if ((m = route.match(/^history\/(\d+)\/restore$/)) && method === 'POST') {
    const r = await env.DB.prepare('SELECT data FROM versions WHERE id = ?').bind(Number(m[1])).first();
    if (!r) return json({ error: 'Esa versión ya no existe.' }, 404);
    const menu = JSON.parse(r.data);
    const v = await saveMenu(env, menu, 'Restaurada desde #' + m[1]);
    return json({ ok: true, version: v, menu });
  }
  if (route === 'images' && method === 'POST') {
    const buf = new Uint8Array(await request.arrayBuffer());
    if (buf.length > 6e6) return json({ error: 'El archivo es demasiado grande.' }, 413);
    const mime = sniff(buf);
    if (!mime) return json({ error: 'El archivo no es una imagen JPG, PNG o WEBP.' }, 400);
    return json({ id: await putImage(env, buf, mime) });
  }
  if ((route === 'ai/enhance' || route === 'ai/generate') && method === 'POST') {
    let body = {}; try { body = await request.json(); } catch { }
    try {
      let out;
      if (route === 'ai/enhance') {
        if (!body.imageId) return json({ error: 'Primero sube una foto para usarla como referencia.' }, 400);
        const ref = await loadImage(env, origin, body.imageId);
        if (!ref) return json({ error: 'No se encontró la foto de referencia.' }, 400);
        out = await aiEnhance(env, ref.bytes, ref.mime, body);
      } else {
        if (!body.nombre) return json({ error: 'El producto necesita un nombre.' }, 400);
        out = await aiGenerate(env, body);
      }
      return json({ id: await putImage(env, out.bytes, out.mime) });
    } catch (e) { return json({ error: e.message || 'Error con OpenAI.' }, e.status || 502); }
  }
  return json({ error: 'No encontrado' }, 404);
}

function sniff(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}
async function putImage(env, bytes, mime) {
  const id = hex(await sha256(bytes)).slice(0, 24);
  await env.DB.prepare('INSERT OR IGNORE INTO images (id, mime, data, created) VALUES (?, ?, ?, ?)').bind(id, mime, bytes, Date.now()).run();
  return id;
}
async function loadImage(env, origin, id) {
  const row = await env.DB.prepare('SELECT mime, data FROM images WHERE id = ?').bind(String(id)).first();
  if (row) return { bytes: new Uint8Array(row.data), mime: row.mime };
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null;
  const a = await env.ASSETS.fetch(new Request(origin + '/seed/img/' + id + '.webp'));
  if (!a.ok) return null;
  return { bytes: new Uint8Array(await a.arrayBuffer()), mime: 'image/webp' };
}

/* ---------------- fotos con IA (OpenAI) ---------------- */
const STYLE = 'Natural soft daylight, shallow depth of field, served on handmade ceramic or clear glass on a light wooden table in a bright seaside café on the Chilean coast. Appetizing, realistic, editorial food photography, 3/4 angle. No text, no letters, no logos, no watermarks, no hands, no menu borders.';
function clip(s, n) { return String(s || '').slice(0, n); }
async function openai(env, endpoint, body, isForm) {
  if (!env.OPENAI_API_KEY) throw err(501, 'Para usar fotos con IA agrega la variable OPENAI_API_KEY en Cloudflare (ver la guía).');
  const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  let res;
  try {
    res = await fetch(base + endpoint, {
      method: 'POST',
      headers: Object.assign({ Authorization: 'Bearer ' + env.OPENAI_API_KEY }, isForm ? {} : { 'content-type': 'application/json' }),
      body: isForm ? body : JSON.stringify(body),
    });
  } catch { throw err(504, 'No se pudo conectar con OpenAI. Intenta otra vez.'); }
  let j = null; try { j = await res.json(); } catch { }
  if (!res.ok) {
    const msg = (j && j.error && j.error.message) || '';
    const e = err(res.status === 401 ? 401 : 502,
      res.status === 401 ? 'La API key de OpenAI no es válida. Revisa OPENAI_API_KEY.' :
      res.status === 429 ? 'OpenAI rechazó la solicitud por límite de uso o falta de saldo. Revisa tu cuenta en platform.openai.com.' :
      /safety|moderation|rejected/i.test(msg) ? 'OpenAI no aceptó esta imagen o descripción. Prueba con otra foto o cambia el texto.' :
      res.status === 403 && /verif/i.test(msg) ? 'Tu organización de OpenAI debe verificarse para usar este modelo de imágenes (platform.openai.com → Settings → Organization).' :
      'OpenAI devolvió un error: ' + (msg || res.status));
    e.raw = msg; throw e;
  }
  const item = j && j.data && j.data[0];
  if (!item || !item.b64_json) throw err(502, 'OpenAI no devolvió una imagen.');
  const bin = atob(item.b64_json), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime: sniff(bytes) || 'image/png' };
}
async function aiEnhance(env, bytes, mime, info) {
  const nombre = clip(info.nombre, 160), desc = clip(info.desc, 600), extra = clip(info.extra, 400);
  const prompt = `Professional menu photo of "${nombre}"${desc ? ' (' + desc + ')' : ''}. ` +
    'Recreate exactly the same dish shown in the reference image: same ingredients, toppings, plating, colors and composition, ' +
    'but as a clean, sharp, high-resolution photograph without the blur, glare, print texture or paper of the reference. ' + STYLE + (extra ? ' ' + extra : '');
  const make = (fidelity) => {
    const f = new FormData();
    f.append('model', env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
    f.append('image', new Blob([bytes], { type: mime }), 'referencia.' + (mime.split('/')[1] || 'png'));
    f.append('prompt', prompt);
    f.append('size', '1536x1024');
    f.append('quality', env.OPENAI_IMAGE_QUALITY || 'medium');
    f.append('output_format', 'webp');
    f.append('output_compression', '82');
    if (fidelity) f.append('input_fidelity', 'high');
    return f;
  };
  try { return await openai(env, '/images/edits', make(true), true); }
  catch (e) { if (e.raw && /input_fidelity/i.test(e.raw)) return openai(env, '/images/edits', make(false), true); throw e; }
}
async function aiGenerate(env, info) {
  const nombre = clip(info.nombre, 160), desc = clip(info.desc, 600), extra = clip(info.extra, 400);
  return openai(env, '/images/generations', {
    model: env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt: `Professional menu photo of "${nombre}"${desc ? ': ' + desc : ''}. ` + STYLE + (extra ? ' ' + extra : ''),
    size: '1536x1024', quality: env.OPENAI_IMAGE_QUALITY || 'medium', output_format: 'webp', output_compression: 82, n: 1,
  }, false);
}

/* ---------------- validación ---------------- */
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
    if (p.foto && !/^[A-Za-z0-9_-]{1,80}$/.test(p.foto)) return 'Foto inválida.';
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
