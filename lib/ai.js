'use strict';
/*
 * Fotos con IA usando la API de imágenes de OpenAI (la misma tecnología de imágenes de ChatGPT).
 * Necesita la variable OPENAI_API_KEY. Opcionales: OPENAI_IMAGE_MODEL, OPENAI_IMAGE_QUALITY, OPENAI_BASE_URL.
 */
const BASE = () => (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const MODEL = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const QUALITY = () => process.env.OPENAI_IMAGE_QUALITY || 'medium';
const SIZE = '1536x1024';

function enabled() { return !!process.env.OPENAI_API_KEY; }

const STYLE = 'Natural soft daylight, shallow depth of field, served on handmade ceramic or clear glass on a light wooden table in a bright seaside café on the Chilean coast. Appetizing, realistic, editorial food photography, 3/4 angle. No text, no letters, no logos, no watermarks, no hands, no menu borders.';

function describe(info) {
  const nombre = String(info.nombre || '').slice(0, 160);
  const desc = String(info.desc || '').slice(0, 600);
  const extra = String(info.extra || '').slice(0, 400);
  return { nombre, desc, extra };
}

function err(status, message) { const e = new Error(message); e.status = status; return e; }

async function call(endpoint, body, isForm) {
  if (!enabled()) throw err(501, 'Para usar fotos con IA agrega la variable OPENAI_API_KEY en Railway (ver la guía).');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 150e3);
  let res;
  try {
    res = await fetch(BASE() + endpoint, {
      method: 'POST',
      headers: Object.assign({ Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }, isForm ? {} : { 'Content-Type': 'application/json' }),
      body: isForm ? body : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw err(504, e.name === 'AbortError' ? 'OpenAI tardó demasiado en responder. Intenta otra vez.' : 'No se pudo conectar con OpenAI.');
  } finally { clearTimeout(t); }
  let json = null; try { json = await res.json(); } catch { }
  if (!res.ok) {
    const msg = (json && json.error && json.error.message) || '';
    const e = err(res.status === 401 ? 401 : 502,
      res.status === 401 ? 'La API key de OpenAI no es válida. Revisa OPENAI_API_KEY.' :
      res.status === 429 ? 'OpenAI rechazó la solicitud por límite de uso o falta de saldo. Revisa tu cuenta en platform.openai.com.' :
      /safety|moderation|rejected/i.test(msg) ? 'OpenAI no aceptó esta imagen o descripción. Prueba con otra foto o cambia el texto.' :
      res.status === 403 && /verif/i.test(msg) ? 'Tu organización de OpenAI debe verificarse para usar este modelo de imágenes (platform.openai.com → Settings → Organization).' :
      'OpenAI devolvió un error: ' + (msg || res.status));
    e.raw = msg;
    throw e;
  }
  const item = json && json.data && json.data[0];
  if (!item || !item.b64_json) throw err(502, 'OpenAI no devolvió una imagen.');
  const buffer = Buffer.from(item.b64_json, 'base64');
  const mime = buffer.slice(0, 4).toString() === 'RIFF' ? 'image/webp' : buffer[0] === 0xff ? 'image/jpeg' : 'image/png';
  return { buffer, mime };
}

async function enhance(buf, mime, info) {
  const { nombre, desc, extra } = describe(info);
  const prompt = `Professional menu photo of "${nombre}"${desc ? ' (' + desc + ')' : ''}. ` +
    'Recreate exactly the same dish shown in the reference image: same ingredients, toppings, plating, colors and composition, ' +
    'but as a clean, sharp, high-resolution photograph without the blur, glare, print texture or paper of the reference. ' + STYLE + (extra ? ' ' + extra : '');
  const make = (fidelity) => {
    const f = new FormData();
    f.append('model', MODEL());
    f.append('image', new Blob([buf], { type: mime }), 'referencia.' + (mime.split('/')[1] || 'png'));
    f.append('prompt', prompt);
    f.append('size', SIZE);
    f.append('quality', QUALITY());
    f.append('output_format', 'webp');
    f.append('output_compression', '82');
    if (fidelity) f.append('input_fidelity', 'high');
    return f;
  };
  try { return await call('/images/edits', make(true), true); }
  catch (e) {
    if (e.raw && /input_fidelity/i.test(e.raw)) return call('/images/edits', make(false), true);
    throw e;
  }
}

async function generate(info) {
  const { nombre, desc, extra } = describe(info);
  const prompt = `Professional menu photo of "${nombre}"${desc ? ': ' + desc : ''}. ` + STYLE + (extra ? ' ' + extra : '');
  return call('/images/generations', {
    model: MODEL(), prompt, size: SIZE, quality: QUALITY(), output_format: 'webp', output_compression: 82, n: 1,
  }, false);
}

module.exports = { enabled, enhance, generate };
