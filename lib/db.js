'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const KEEP_VERSIONS = 60;

function openDb(dataDir, seedDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'carta.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS versions (id INTEGER PRIMARY KEY AUTOINCREMENT, created TEXT NOT NULL, note TEXT, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, created INTEGER NOT NULL);
  `);

  const q = {
    getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    latest: db.prepare('SELECT id, created, note, data FROM versions ORDER BY id DESC LIMIT 1'),
    insertVersion: db.prepare('INSERT INTO versions (created, note, data) VALUES (?, ?, ?)'),
    pruneVersions: db.prepare('DELETE FROM versions WHERE id NOT IN (SELECT id FROM versions ORDER BY id DESC LIMIT ?)'),
    listVersions: db.prepare('SELECT id, created, note, data FROM versions ORDER BY id DESC LIMIT ?'),
    getVersion: db.prepare('SELECT data FROM versions WHERE id = ?'),
    allVersionData: db.prepare('SELECT data FROM versions'),
    getImage: db.prepare('SELECT mime, data FROM images WHERE id = ?'),
    hasImage: db.prepare('SELECT 1 AS x FROM images WHERE id = ?'),
    putImage: db.prepare('INSERT OR IGNORE INTO images (id, mime, data, created) VALUES (?, ?, ?, ?)'),
    oldImages: db.prepare('SELECT id FROM images WHERE created < ?'),
    delImage: db.prepare('DELETE FROM images WHERE id = ?'),
  };

  let cache = null;

  const api = {
    getSecret() {
      let row = q.getMeta.get('secret');
      if (!row) { q.setMeta.run('secret', crypto.randomBytes(32).toString('hex')); row = q.getMeta.get('secret'); }
      return row.value;
    },
    getMenu() {
      if (!cache) { const r = q.latest.get(); cache = r ? { id: r.id, created: r.created, menu: JSON.parse(r.data) } : null; }
      return cache ? cache.menu : null;
    },
    currentVersion() { api.getMenu(); return cache ? { id: cache.id, created: cache.created } : null; },
    saveMenu(menu, note) {
      const created = new Date().toISOString();
      const r = q.insertVersion.run(created, note || null, JSON.stringify(menu));
      q.pruneVersions.run(KEEP_VERSIONS);
      cache = { id: Number(r.lastInsertRowid), created, menu: JSON.parse(JSON.stringify(menu)) };
      return { id: cache.id, created };
    },
    listVersions(n) {
      return q.listVersions.all(n).map(r => {
        let m = null; try { m = JSON.parse(r.data); } catch { }
        return {
          id: r.id, created: r.created, note: r.note,
          productos: m ? m.productos.length : 0,
          agotados: m ? m.productos.filter(p => p.agotado).length : 0,
        };
      });
    },
    getVersion(id) { const r = q.getVersion.get(Number(id)); return r ? JSON.parse(r.data) : null; },
    putImage(buf, mime) {
      const id = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 24);
      q.putImage.run(id, mime, buf, Date.now());
      return id;
    },
    hasImage(id) { return !!q.hasImage.get(String(id)); },
    getImage(id) { return q.getImage.get(String(id)) || null; },
    collectGarbage() {
      // borra fotos que ninguna versión guardada usa y que tienen más de 2 días
      const used = new Set();
      for (const r of q.allVersionData.all()) {
        try {
          const m = JSON.parse(r.data);
          for (const p of m.productos) if (p.foto) used.add(p.foto);
          if (m.bowl && m.bowl.foto) used.add(m.bowl.foto);
        } catch { }
      }
      for (const r of q.oldImages.all(Date.now() - 2 * 864e5)) if (!used.has(r.id)) q.delImage.run(r.id);
    },
  };

  // primera vez: carga la carta inicial y sus fotos
  if (!q.latest.get()) {
    const seed = JSON.parse(fs.readFileSync(path.join(seedDir, 'menu.json'), 'utf8'));
    const map = {};
    const imgDir = path.join(seedDir, 'img');
    for (const f of fs.readdirSync(imgDir)) {
      const ext = path.extname(f).toLowerCase();
      const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg';
      map[path.basename(f, ext)] = api.putImage(fs.readFileSync(path.join(imgDir, f)), mime);
    }
    for (const p of seed.productos) p.foto = p.foto ? (map[p.foto] || '') : '';
    if (seed.bowl) seed.bowl.foto = seed.bowl.foto ? (map[seed.bowl.foto] || '') : '';
    api.saveMenu(seed, 'Carta inicial');
    console.log(`[carta] Carta inicial cargada: ${seed.productos.length} productos, ${Object.keys(map).length} fotos.`);
  }
  return api;
}

module.exports = { openDb };
