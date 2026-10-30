/* La Crepería & Co — carta pública + panel de administración */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var MODE = document.body.getAttribute('data-mode') || 'public';

  /* ---------- datos ---------- */
  var DATA = JSON.parse($('#lc-data').textContent);
  var DATA_STR = JSON.stringify(DATA);
  var view = DATA;

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Math.round(Number(n) || 0); return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function img(id) { return id ? '/img/' + encodeURIComponent(id) : ''; }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { } }
  function catById(d, id) { for (var i = 0; i < d.categorias.length; i++) if (d.categorias[i].id === id) return d.categorias[i]; return null; }
  function prodById(d, id) { for (var i = 0; i < d.productos.length; i++) if (d.productos[i].id === id) return d.productos[i]; return null; }
  function waLink(n) { var d = String(n || '').replace(/[^\d]/g, ''); return d ? 'https://wa.me/' + d : ''; }
  function igHandle(s) { return String(s || '').replace(/^@/, '').trim(); }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } }

  /* ---------- íconos ---------- */
  var ST = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  var TAGS = {
    fav: { label: 'Favorito de la casa', short: 'Favoritos', svg: '<path fill="currentColor" d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1L3.2 9.2l6.1-.8z"/>' },
    vegano: { label: 'Vegano', short: 'Vegano', svg: '<path fill="currentColor" d="M20.5 3.5C11 3.6 5 7.6 5 14.2c0 1.5.4 2.8 1 3.9 1.9-3.8 4.9-6.6 8.8-8.6-3.4 2.4-6 5.6-7.4 9.4 1 .4 2 .6 3.1.6 6.7 0 10.4-6.3 10-16z"/>' },
    vegetal: { label: 'Leche vegetal disponible', short: 'Leche vegetal', svg: '<path ' + ST + ' d="M9.5 2.5h5v3l2 3v11.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5V8.5l2-3zM7.5 12.5h9"/>' },
    singluten: { label: 'Sin gluten', short: 'Sin gluten', svg: '<g ' + ST + '><circle cx="12" cy="12" r="9.3"/><path d="M5.5 5.5l13 13M12 8v9M12 11c-1.8-.4-2.8-1.5-2.8-2.9M12 11c1.8-.4 2.8-1.5 2.8-2.9M12 14c-1.8-.4-2.8-1.5-2.8-2.9M12 14c1.8-.4 2.8-1.5 2.8-2.9"/></g>' },
    sinazucar: { label: 'Sin azúcar', short: 'Sin azúcar', svg: '<g ' + ST + '><circle cx="12" cy="12" r="9.3"/><path d="M5.5 5.5l13 13M8.6 9.6 12 7.7l3.4 1.9v3.9L12 15.4l-3.4-1.9z"/></g>' },
    nueces: { label: 'Contiene frutos secos', short: 'Frutos secos', noFilter: true, svg: '<path ' + ST + ' d="M12 2.8c2.8 0 4.4 2 4.4 4.3 0 1.6-.9 2.6-1.4 3.7-.4.9-.4 1.6 0 2.5.5 1.1 1.4 2.1 1.4 3.7 0 2.3-1.6 4.3-4.4 4.3s-4.4-2-4.4-4.3c0-1.6.9-2.6 1.4-3.7.4-.9.4-1.6 0-2.5-.5-1.1-1.4-2.1-1.4-3.7C7.6 4.8 9.2 2.8 12 2.8z"/>' }
  };
  var TAG_ORDER = ['fav', 'vegano', 'vegetal', 'singluten', 'sinazucar', 'nueces'];
  function tagIcon(t) { var d = TAGS[t]; return d ? '<svg viewBox="0 0 24 24" class="ic ' + t + '" role="img" aria-label="' + d.label + '"><title>' + d.label + '</title>' + d.svg + '</svg>' : ''; }
  function ico(inner) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><g ' + ST + '>' + inner + '</g></svg>'; }
  var I_SEARCH = ico('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>');
  var I_PIN = ico('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>');
  var I_IG = ico('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>');
  var I_CLOCK = ico('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');
  var I_WA = ico('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9.2 9.3c.2 1.9 1.6 3.7 3.6 4.6l1.2-1.1 1.9.8-.3 1.7c-3.9.2-7.6-3.3-7.5-7.2l1.7-.3.8 1.9z"/>');
  var I_PEN = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g ' + ST + '><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></g></svg>';
  var I_SPARK = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z"/></svg>';
  var WAVE = '<svg class="wave" viewBox="0 0 88 12" aria-hidden="true"><path d="M2 6c5.5-5 11-5 16.5 0s11 5 16.5 0 11-5 16.5 0 11 5 16.5 0 11-5 16.5 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function logo(kind) { return '<span class="logo ' + kind + '" role="img" aria-label="La Crepería &amp; Co"><i class="l-ink"></i><i class="l-gold"></i></span>'; }
  function cup(ml, min, max) {
    var t = max > min ? (ml - min) / (max - min) : 1, s = 0.55 + 0.45 * t;
    var H = 34 * s, y0 = 44 - H, tw = 20 + 10 * s, bw = 14 + 6 * s;
    var p = 'M' + (20 - tw / 2).toFixed(1) + ' ' + y0.toFixed(1) + 'L' + (20 + tw / 2).toFixed(1) + ' ' + y0.toFixed(1) + 'L' + (20 + bw / 2).toFixed(1) + ' 44L' + (20 - bw / 2).toFixed(1) + ' 44Z';
    var dome = 'M' + (20 - tw / 2).toFixed(1) + ' ' + y0.toFixed(1) + 'Q20 ' + (y0 - 9 * s).toFixed(1) + ' ' + (20 + tw / 2).toFixed(1) + ' ' + y0.toFixed(1);
    return '<svg viewBox="0 0 40 46" aria-hidden="true"><path d="' + dome + '" fill="currentColor" opacity=".35"/><path d="' + p + '" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }

  /* =====================================================================
     CARTA PÚBLICA
     ===================================================================== */
  var UI = { q: '', tags: {}, bowl: { size: null, inc: {}, ext: {} }, admin: false, previewing: false };

  function visibleProducts(d) { return d.productos.filter(function (p) { return !p.oculto; }); }
  function words(q) { return norm(q).split(/\s+/).filter(Boolean); }
  function matches(p, d) {
    for (var t in UI.tags) if (UI.tags[t] && (p.tags || []).indexOf(t) < 0) return false;
    if (!UI.q) return true;
    var c = catById(d, p.cat), hay = norm(p.nombre + ' ' + p.desc + ' ' + (c ? c.nombre : ''));
    return words(UI.q).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function bowlMatches(d) {
    if (!d.bowl || !d.bowl.activo) return false;
    for (var t in UI.tags) if (UI.tags[t]) return false;
    if (!UI.q) return true;
    var hay = norm(d.bowl.titulo + ' ' + d.bowl.desc + ' acai bowl arma toppings ' + d.bowl.incluidos.join(' ') + ' ' + d.bowl.extras.map(function (e) { return e.nombre; }).join(' '));
    return words(UI.q).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function filtering() { if (UI.q) return true; for (var t in UI.tags) if (UI.tags[t]) return true; return false; }

  var root = $('#lc-root');
  function renderShell() {
    root.innerHTML =
      '<div class="preview-banner" id="lc-pv" hidden><div class="wrap"><span>Vista previa con cambios sin publicar</span><button class="btn small" type="button" data-act="pv-back">Volver al panel</button></div></div>' +
      '<header class="hero"><div class="wrap">' + logo('full') + '<p class="lema" id="lc-lema"></p><div class="meta" id="lc-meta"></div></div></header>' +
      '<div class="bar" id="lc-bar"><div class="wrap"><div class="bar-top"><a class="bar-mono" href="#top" data-act="top" aria-label="Ir al inicio">' + logo('mono') + '</a>' +
      '<label class="search"><span class="sr">Buscar en la carta</span>' + I_SEARCH +
      '<input id="lc-q" type="search" placeholder="Buscar en la carta" autocomplete="off" enterkeyhint="search">' +
      '<button class="clear" type="button" id="lc-qx" aria-label="Borrar búsqueda" hidden>×</button></label></div>' +
      '<nav class="chips" id="lc-chips" aria-label="Categorías"></nav></div></div>' +
      '<main class="wrap"><div class="filters" id="lc-filters"></div><div id="lc-menu"></div></main>' +
      '<footer class="foot" id="lc-foot"></footer>' +
      '<button class="btn primary admin-fab" type="button" id="lc-fab" data-act="admin" hidden>' + I_PEN + 'Editar carta</button>' +
      '<dialog class="sheet" id="lc-sheet" aria-label="Detalle del producto"></dialog>' +
      '<div class="admin" id="lc-admin" hidden></div>';
    bindShell();
    renderView();
  }

  function metaHTML(inf) {
    var m = '';
    if (inf.ubicacion) m += '<span>' + I_PIN + esc(inf.ubicacion) + '</span>';
    if (igHandle(inf.instagram)) m += '<span>' + I_IG + '<a href="https://www.instagram.com/' + encodeURIComponent(igHandle(inf.instagram)) + '/" target="_blank" rel="noopener">@' + esc(igHandle(inf.instagram)) + '</a></span>';
    if (waLink(inf.whatsapp)) m += '<span>' + I_WA + '<a href="' + waLink(inf.whatsapp) + '" target="_blank" rel="noopener">' + esc(inf.whatsapp) + '</a></span>';
    if (inf.horario) m += '<span>' + I_CLOCK + esc(inf.horario) + '</span>';
    return m;
  }

  function renderView() {
    var inf = view.info;
    $('#lc-lema').textContent = inf.lema || '';
    $('#lc-lema').hidden = !inf.lema;
    $('#lc-meta').innerHTML = metaHTML(inf);
    $('#lc-pv').hidden = !UI.previewing;
    $('#lc-fab').hidden = !UI.admin || UI.previewing || !$('#lc-admin').hidden;
    renderFilters(); renderMenu(); renderFooter();
  }

  function renderFilters() {
    var vis = visibleProducts(view), html = '<span class="lbl">Filtrar</span>', any = false;
    TAG_ORDER.forEach(function (t) {
      if (TAGS[t].noFilter) return;
      var n = vis.filter(function (p) { return (p.tags || []).indexOf(t) >= 0; }).length;
      if (!n && !UI.tags[t]) return;
      any = true;
      html += '<button type="button" class="ftag" data-tag="' + t + '" aria-pressed="' + (UI.tags[t] ? 'true' : 'false') + '">' + tagIcon(t) + esc(TAGS[t].short) + '<span class="n">' + n + '</span></button>';
    });
    var f = $('#lc-filters'); f.innerHTML = any ? html : ''; f.hidden = !any;
  }

  function itemHTML(p) {
    var ph = img(p.foto);
    var tags = (p.tags || []).filter(function (t) { return TAGS[t]; }).sort(function (a, b) { return TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b); }).map(tagIcon).join('');
    return '<article class="item' + (ph ? ' ph' : '') + (p.agotado ? ' out' : '') + '">' +
      (ph ? '<img class="photo" src="' + ph + '" alt="" loading="lazy" decoding="async" width="76" height="76">' : '') +
      '<div class="body"><h4>' + esc(p.nombre) + (tags ? '<span class="tags">' + tags + '</span>' : '') + '</h4>' +
      (p.desc ? '<p>' + esc(p.desc) + '</p>' : '') + (ph ? '<span class="more">Ver foto</span>' : '') + '</div>' +
      '<div class="price">' + (p.agotado ? '<span class="pill out">Agotado</span>' : money(p.precio)) + '</div>' +
      (ph ? '<button type="button" class="open-item" data-open="' + esc(p.id) + '" aria-label="Ver foto de ' + esc(p.nombre) + '"></button>' : '') +
      '</article>';
  }

  function bowlHTML(d) {
    var b = d.bowl, st = UI.bowl, sizes = b.tamanos || [];
    if (!sizes.length) return '';
    if (!st.size || !sizes.some(function (s) { return s.id === st.size; })) st.size = sizes[Math.min(1, sizes.length - 1)].id;
    var mls = sizes.map(function (s) { return Number(s.ml) || 0; }), mn = Math.min.apply(null, mls), mx = Math.max.apply(null, mls);
    var size = sizes.filter(function (s) { return s.id === st.size; })[0];
    var inc = b.incluidos.filter(function (n) { return st.inc[n]; });
    var ext = b.extras.filter(function (e) { return st.ext[e.id] && !e.agotado; });
    var total = (Number(size.precio) || 0) + ext.reduce(function (a, e) { return a + (Number(e.precio) || 0); }, 0);
    var h = '<section class="bowl" id="c-bowl" aria-labelledby="bowl-h"><div class="bowl-head"><div class="txt">' +
      '<span class="kicker">Açaí a tu manera</span><h3 id="bowl-h">' + esc(b.titulo) + '</h3><p>' + esc(b.desc) + '</p>' +
      (b.sellos && b.sellos.length ? '<div class="seals">' + b.sellos.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>' : '') +
      '</div>' + (b.foto ? '<img src="' + img(b.foto) + '" alt="Bowl de açaí" loading="lazy">' : '') + '</div><div class="bowl-body">';
    h += '<div class="step"><h4><span class="num">1</span>Elige el tamaño</h4><div class="sizes" role="group" aria-label="Tamaño">' +
      sizes.map(function (s) {
        return '<button type="button" class="size" data-size="' + esc(s.id) + '" aria-pressed="' + (s.id === st.size) + '">' + cup(Number(s.ml) || 0, mn, mx) +
          '<b>' + esc(s.nombre) + '</b><span class="ml">' + esc(s.ml) + ' ml</span><span class="price">' + money(s.precio) + '</span></button>';
      }).join('') + '</div></div>';
    h += '<div class="step"><h4><span class="num">2</span>Toppings incluidos <small>sin costo</small></h4><div class="tops">' +
      b.incluidos.map(function (n) { return '<button type="button" class="top" data-inc="' + esc(n) + '" aria-pressed="' + (!!st.inc[n]) + '">' + esc(n) + '</button>'; }).join('') + '</div></div>';
    h += '<div class="step"><h4><span class="num">3</span>Toppings extra</h4><div class="tops">' +
      b.extras.map(function (e) {
        return '<button type="button" class="top" data-ext="' + esc(e.id) + '" aria-pressed="' + (!!st.ext[e.id] && !e.agotado) + '"' + (e.agotado ? ' disabled title="Agotado"' : '') + '>' + esc(e.nombre) + '<em>+' + money(e.precio) + '</em></button>';
      }).join('') + '</div></div>';
    h += '<div class="summary" aria-live="polite"><div class="lines"><div><b>' + esc(size.nombre) + '</b> · ' + esc(size.ml) + ' ml · ' + money(size.precio) + '</div>' +
      '<div>' + (inc.length ? 'Incluidos: ' + esc(inc.join(', ')) : 'Elige tus toppings incluidos') + '</div>' +
      (ext.length ? '<div>Extras: ' + esc(ext.map(function (e) { return e.nombre + ' +' + money(e.precio); }).join(', ')) + '</div>' : '') +
      '</div><div class="total"><small>Total</small><span class="price">' + money(total) + '</span></div>' +
      '<div class="hint"><span>Muestra este resumen al pedir en caja.</span><button type="button" class="btn small" data-act="bowl-reset">Reiniciar</button></div></div>';
    return h + '</div></section>';
  }

  function renderMenu() {
    var d = view, vis = visibleProducts(d), html = '', chips = '', any = false, showBowl = bowlMatches(d);
    d.grupos.forEach(function (g) {
      var block = '', gchips = '';
      d.categorias.filter(function (c) { return c.grupo === g.id; }).forEach(function (c) {
        var items = vis.filter(function (p) { return p.cat === c.id && matches(p, d); });
        if (items.length) {
          block += '<section class="cat" id="c-' + esc(c.id) + '"><div class="cat-h"><h3>' + esc(c.nombre) + '</h3></div>' +
            (c.nota && !filtering() ? '<p class="cat-note">' + esc(c.nota) + '</p>' : '') +
            '<div class="items">' + items.map(itemHTML).join('') + '</div></section>';
          gchips += '<button type="button" class="chip" data-go="c-' + esc(c.id) + '">' + esc(c.nombre) + '</button>';
        }
        if (showBowl && c.id === 'amazonica') {
          block += bowlHTML(d); showBowl = false;
          gchips += '<button type="button" class="chip acai" data-go="c-bowl">' + esc(d.bowl.titulo) + '</button>';
        }
      });
      if (block) {
        any = true;
        html += '<div class="group-h"><span class="sub">' + (g.id === 'barra' ? 'Café, té y bebidas' : 'Dulce y salado') + '</span><h2>' + esc(g.nombre) + '</h2>' + WAVE + '</div>' + block;
        chips += '<span class="chip sep" aria-hidden="true">' + esc(g.nombre) + '</span>' + gchips;
      }
    });
    if (showBowl) { html += bowlHTML(d); chips += '<button type="button" class="chip acai" data-go="c-bowl">' + esc(d.bowl.titulo) + '</button>'; any = true; }
    if (!any) html = '<div class="empty" role="status"><strong>Nada por aquí</strong>No encontramos productos' + (UI.q ? ' para “' + esc(UI.q) + '”' : '') + ' con estos filtros.<br><button type="button" class="btn" data-act="clear-all">Ver toda la carta</button></div>';
    $('#lc-menu').innerHTML = html;
    $('#lc-chips').innerHTML = chips;
    updateActiveChip.last = null;
    measureBar(); updateActiveChip();
  }

  function renderFooter() {
    var inf = view.info, used = {};
    visibleProducts(view).forEach(function (p) { (p.tags || []).forEach(function (t) { used[t] = 1; }); });
    var legend = TAG_ORDER.filter(function (t) { return used[t]; }).map(function (t) { return '<span>' + tagIcon(t) + esc(TAGS[t].label) + '</span>'; }).join('');
    var meta = metaHTML(inf);
    $('#lc-foot').innerHTML = '<div class="wrap"><span class="mono">' + logo('mono') + '</span>' +
      (inf.pie ? '<p class="thanks">' + esc(inf.pie) + '</p>' : '') + WAVE +
      (meta ? '<div class="meta">' + meta + '</div>' : '') +
      (legend ? '<div class="legend">' + legend + '</div>' : '') +
      '<p class="note">' + (inf.aviso ? esc(inf.aviso) + ' ' : '') + 'Precios en pesos chilenos.</p>' +
      '<a class="adminlink" href="/admin">Administración</a></div>';
  }

  /* barra fija + chip activo */
  var barH = 112, raf = 0;
  function measureBar() {
    var b = $('#lc-bar'); if (!b) return;
    barH = b.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--bar-h', Math.round(barH) + 'px');
  }
  function updateActiveChip() {
    raf = 0;
    var secs = document.querySelectorAll('#lc-menu .cat, #lc-menu .bowl'), cur = null, lim = barH + 40;
    for (var i = 0; i < secs.length; i++) { if (secs[i].getBoundingClientRect().top <= lim) cur = secs[i].id; else break; }
    if (!cur && secs.length) cur = secs[0].id;
    var chips = document.querySelectorAll('#lc-chips .chip[data-go]'), active = null;
    for (var j = 0; j < chips.length; j++) {
      var on = chips[j].getAttribute('data-go') === cur;
      chips[j].setAttribute('aria-current', on ? 'true' : 'false');
      if (on) active = chips[j];
    }
    if (active && active !== updateActiveChip.last) {
      updateActiveChip.last = active;
      var rail = $('#lc-chips'), l = active.offsetLeft - rail.offsetLeft, w = active.offsetWidth;
      if (l < rail.scrollLeft + 8 || l + w > rail.scrollLeft + rail.clientWidth - 8) rail.scrollTo({ left: Math.max(0, l - 24), behavior: 'smooth' });
    }
  }
  window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(updateActiveChip); }, { passive: true });
  window.addEventListener('resize', measureBar);

  /* ficha de producto */
  function openSheet(id) {
    var p = prodById(view, id); if (!p) return;
    var dlg = $('#lc-sheet'), c = catById(view, p.cat);
    var tags = (p.tags || []).filter(function (t) { return TAGS[t]; }).map(function (t) { return '<span>' + tagIcon(t) + esc(TAGS[t].label) + '</span>'; }).join('');
    dlg.innerHTML = (p.foto ? '<img src="' + img(p.foto) + '" alt="' + esc(p.nombre) + '">' : '') +
      '<button class="x" type="button" data-act="sheet-close" aria-label="Cerrar">×</button>' +
      '<div class="in"><span class="pill cat-pill">' + esc(c ? c.nombre : '') + '</span>' +
      '<div class="top-row"><h3>' + esc(p.nombre) + '</h3><span class="price">' + (p.agotado ? '<span class="pill out">Agotado</span>' : money(p.precio)) + '</span></div>' +
      (p.desc ? '<p>' + esc(p.desc) + '</p>' : '') + (tags ? '<div class="taglist">' + tags + '</div>' : '') + '</div>';
    if (dlg.showModal) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } } else dlg.setAttribute('open', '');
  }
  function closeSheet() { var dlg = $('#lc-sheet'); if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }

  var qTimer = 0;
  function bindShell() {
    var q = $('#lc-q'), qx = $('#lc-qx');
    q.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(function () { UI.q = q.value.trim(); qx.hidden = !UI.q; renderMenu(); }, 120); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; UI.q = ''; qx.hidden = true; renderMenu(); } });
    qx.addEventListener('click', function () { q.value = ''; UI.q = ''; qx.hidden = true; renderMenu(); q.focus(); });
    $('#lc-sheet').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });
    root.addEventListener('click', onRootClick);
  }
  function onRootClick(e) {
    var t = e.target.closest('button, a'); if (!t || !root.contains(t) || t.closest('#lc-admin')) return;
    var v;
    if ((v = t.getAttribute('data-go'))) { var el = document.getElementById(v); if (el) el.scrollIntoView({ block: 'start' }); return; }
    if ((v = t.getAttribute('data-tag'))) { UI.tags[v] = !UI.tags[v]; renderFilters(); renderMenu(); return; }
    if ((v = t.getAttribute('data-open'))) { openSheet(v); return; }
    if ((v = t.getAttribute('data-size'))) { UI.bowl.size = v; rerenderBowl(); return; }
    if (t.hasAttribute('data-inc')) { v = t.getAttribute('data-inc'); UI.bowl.inc[v] = !UI.bowl.inc[v]; rerenderBowl(); return; }
    if ((v = t.getAttribute('data-ext'))) { UI.bowl.ext[v] = !UI.bowl.ext[v]; rerenderBowl(); return; }
    var act = t.getAttribute('data-act');
    if (act === 'top') { e.preventDefault(); window.scrollTo({ top: 0 }); }
    else if (act === 'bowl-reset') { UI.bowl = { size: null, inc: {}, ext: {} }; rerenderBowl(); }
    else if (act === 'clear-all') { UI.q = ''; UI.tags = {}; $('#lc-q').value = ''; $('#lc-qx').hidden = true; renderFilters(); renderMenu(); }
    else if (act === 'sheet-close') closeSheet();
    else if (act === 'admin') openAdmin();
    else if (act === 'pv-back') { UI.previewing = false; view = DATA; renderView(); openAdmin(); }
  }
  function rerenderBowl() {
    var old = $('#c-bowl'); if (!old) return;
    var a = document.activeElement, key = '';
    if (a && old.contains(a)) ['data-size', 'data-inc', 'data-ext', 'data-act'].forEach(function (n) { var x = a.getAttribute(n); if (x != null) key += '[' + n + '="' + CSS.escape(x) + '"]'; });
    var tmp = document.createElement('div'); tmp.innerHTML = bowlHTML(view);
    old.replaceWith(tmp.firstChild);
    if (key) { var f = $('#c-bowl ' + key); if (f) f.focus({ preventScroll: true }); }
  }

  /* =====================================================================
     ADMINISTRACIÓN
     ===================================================================== */
  var A = { draft: null, version: null, tab: 'productos', cat: null, q: '', editing: null, confirm: null, notice: null, stale: null,
    busy: false, ai: false, volume: true, newInc: '', aiBusy: {}, aiPrompt: {}, prevFoto: {}, history: null, bulk: null };
  var DRAFT_KEY = 'lc-carta-borrador';

  function apiCall(method, url, body, raw) {
    var opts = { method: method, headers: { 'X-LC': '1' }, credentials: 'same-origin' };
    if (raw) { opts.headers['Content-Type'] = raw.type || 'application/octet-stream'; opts.body = raw; }
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || 'Error ' + r.status); e.status = r.status; e.data = j; throw e; }
        return j;
      });
    }, function () { var e = new Error('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.'); e.status = 0; throw e; });
  }
  function handleAuth(e) { if (e.status === 401) { A.draft && persistDraftNow(); showLogin('Tu sesión expiró. Ingresa la contraseña otra vez.'); return true; } return false; }

  /* --- login --- */
  function showLogin(msg, notConfigured) {
    var el = $('#lc-admin'); el.hidden = false; document.documentElement.style.overflow = 'hidden';
    $('#lc-fab').hidden = true;
    el.innerHTML = '<div class="login"><form class="login-card" id="lc-login" novalidate>' +
      '<span class="login-logo">' + logo('mono') + '</span><h2>Administración</h2>' +
      (notConfigured ? '<p class="help">El panel está bloqueado porque falta la variable <b>ADMIN_PASSWORD</b> en el servidor. Agrégala en Railway → Variables y vuelve a cargar esta página.</p>'
        : '<p class="help">Ingresa la contraseña para editar la carta.</p>' +
        '<label class="field"><span>Contraseña</span><input id="lc-pw" type="password" autocomplete="current-password" required></label>' +
        (msg ? '<p class="form-err" role="alert">' + esc(msg) + '</p>' : '') +
        '<button class="btn primary" type="submit" id="lc-login-btn">Entrar</button>') +
      '<a class="back" href="/">← Ver la carta</a></form></div>';
    var f = $('#lc-login'), pw = $('#lc-pw');
    if (pw) pw.focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('#lc-login-btn'); btn.disabled = true; btn.textContent = 'Entrando…';
      apiCall('POST', '/api/admin/login', { password: pw.value }).then(function (r) {
        A.ai = !!r.ai; A.volume = r.volume !== false; UI.admin = true;
        return loadServerMenu();
      }).then(function () { el._bound = false; openAdmin(); })
        .catch(function (err) { showLogin(err.message); });
    });
  }
  function loadServerMenu() {
    return apiCall('GET', '/api/admin/menu').then(function (r) {
      DATA = r.menu; DATA_STR = JSON.stringify(DATA); A.version = r.version; view = DATA;
      if (A.draft && JSON.stringify(A.draft) === DATA_STR) A.draft = null;
    });
  }

  /* --- borrador local --- */
  function loadDraft() {
    var raw = lsGet(DRAFT_KEY); if (!raw) return null;
    try {
      var o = JSON.parse(raw), s = JSON.stringify(o.data);
      if (s === DATA_STR) { lsDel(DRAFT_KEY); return null; }
      if (A.version && o.base === A.version.id) { A.notice = { kind: 'warn', text: 'Recuperamos los cambios sin publicar que dejaste en este navegador.' }; return o.data; }
      A.stale = o.data; return null;
    } catch (e) { lsDel(DRAFT_KEY); return null; }
  }
  var saveT = 0;
  function persistDraftNow() {
    if (!A.draft) return;
    if (!isDirty()) { lsDel(DRAFT_KEY); return; }
    lsSet(DRAFT_KEY, JSON.stringify({ base: A.version && A.version.id, data: A.draft }));
  }
  function persistDraft() { clearTimeout(saveT); saveT = setTimeout(persistDraftNow, 400); }
  function isDirty() { return !!A.draft && JSON.stringify(A.draft) !== DATA_STR; }
  window.addEventListener('beforeunload', function (e) { if (isDirty()) { persistDraftNow(); } });

  function openAdmin() {
    if (!UI.admin) { showLogin(); return; }
    if (!A.draft) A.draft = loadDraft() || clone(DATA);
    if (!A.cat || !catById(A.draft, A.cat)) A.cat = A.draft.categorias[0] && A.draft.categorias[0].id;
    UI.previewing = false; view = DATA;
    var el = $('#lc-admin'); el.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    $('#lc-fab').hidden = true;
    if (!el._bound) { bindAdmin(el); el._bound = true; }
    renderAdmin();
  }
  function closeAdmin() {
    $('#lc-admin').hidden = true;
    document.documentElement.style.overflow = '';
    renderView();
  }

  function tabBtn(id, label) { return '<button type="button" role="tab" data-act="tab" data-v="' + id + '" aria-selected="' + (A.tab === id) + '">' + label + '</button>'; }

  function renderAdmin() {
    var el = $('#lc-admin'); if (el.hidden || !A.draft) return;
    var sc0 = el.querySelector('main'), top = sc0 ? sc0.scrollTop : 0, body = '';
    if (!A.volume) body += '<div class="notice err">El servidor no tiene un volumen persistente: los cambios se perderán en el próximo deploy. En Railway agrega un Volume montado en <b>/data</b>.</div>';
    if (A.stale) body += '<div class="notice warn"><span>Hay cambios guardados en este navegador hechos sobre una versión anterior de la carta.</span><span class="toolbar"><button class="btn small" type="button" data-act="stale-restore">Recuperarlos</button><button class="btn small" type="button" data-act="stale-drop">Descartarlos</button></span></div>';
    if (A.notice) body += '<div class="notice ' + (A.notice.kind || '') + '" role="status"><span>' + esc(A.notice.text) + '</span>' + (A.notice.reload ? '<button class="btn small" type="button" data-act="reload">Recargar</button>' : '<button class="btn small" type="button" data-act="notice-x">Entendido</button>') + '</div>';
    if (A.tab === 'productos') body += adminProducts();
    else if (A.tab === 'fotos') body += adminPhotos();
    else if (A.tab === 'categorias') body += adminCats();
    else if (A.tab === 'bowl') body += adminBowl();
    else if (A.tab === 'info') body += adminInfo();
    else if (A.tab === 'historial') body += adminHistory();
    else body += adminQR();
    el.innerHTML =
      '<header><div class="wrap"><div class="ahead"><span class="amono">' + logo('mono') + '</span><h2>Editar carta</h2>' +
      '<button class="btn small" type="button" data-act="close">Ver carta</button><button class="btn small" type="button" data-act="logout">Salir</button></div>' +
      '<div class="tabs" role="tablist">' + tabBtn('productos', 'Productos') + tabBtn('fotos', 'Fotos con IA') + tabBtn('categorias', 'Categorías') + tabBtn('bowl', 'Arma tu Bowl') +
      tabBtn('info', 'Local') + tabBtn('historial', 'Historial') + tabBtn('qr', 'Código QR') + '</div></div></header>' +
      '<main><div class="wrap">' + body + '</div></main>' +
      '<footer><div class="wrap" id="lc-afoot"></div></footer>';
    renderAdminFoot();
    var sc = el.querySelector('main'); if (sc) sc.scrollTop = top;
  }

  function renderAdminFoot() {
    var f = $('#lc-afoot'); if (!f) return;
    var dirty = isDirty(), h;
    if (A.confirm === 'publish') {
      h = '<span class="status"><b>¿Publicar ahora?</b> Los clientes verán la carta actualizada al instante.</span>' +
        '<button class="btn" type="button" data-act="confirm-no">Cancelar</button><button class="btn primary" type="button" data-act="publish-yes"' + (A.busy ? ' disabled' : '') + '>' + (A.busy ? 'Publicando…' : 'Sí, publicar') + '</button>';
    } else if (A.confirm === 'discard') {
      h = '<span class="status"><b>¿Descartar todos los cambios?</b> Vuelves a la carta publicada.</span>' +
        '<button class="btn" type="button" data-act="confirm-no">Cancelar</button><button class="btn danger" type="button" data-act="discard-yes">Descartar</button>';
    } else {
      h = '<span class="status">' + (dirty ? '<span class="dot"></span><b>Cambios sin publicar</b>' : 'Todo publicado' + (A.version ? ' · ' + esc(fmtDate(A.version.created)) : '')) + '</span>' +
        '<button class="btn" type="button" data-act="discard"' + (dirty ? '' : ' disabled') + '>Descartar</button>' +
        '<button class="btn" type="button" data-act="preview">Vista previa</button>' +
        '<button class="btn primary" type="button" data-act="publish"' + (dirty ? '' : ' disabled') + '>Publicar cambios</button>';
    }
    f.innerHTML = h;
  }

  /* --- productos --- */
  function adminProducts() {
    var d = A.draft;
    var opts = d.categorias.map(function (c) {
      var n = d.productos.filter(function (p) { return p.cat === c.id; }).length;
      return '<option value="' + esc(c.id) + '"' + (c.id === A.cat ? ' selected' : '') + '>' + esc(c.nombre) + ' (' + n + ')</option>';
    }).join('');
    var h = '<div class="toolbar"><select id="a-cat" aria-label="Categoría" data-bind="ui:cat">' + opts + '</select>' +
      '<input id="a-q" type="search" placeholder="Buscar en toda la carta" value="' + esc(A.q) + '" data-bind="ui:q" aria-label="Buscar producto"></div>';
    var list = A.q ? d.productos.filter(function (p) { return norm(p.nombre + ' ' + p.desc).indexOf(norm(A.q)) >= 0; }) : d.productos.filter(function (p) { return p.cat === A.cat; });
    h += '<div class="mini-list">' + list.map(function (p, i) { return prodRow(p, i, list.length); }).join('') + '</div>';
    if (!A.q) h += '<div><button class="btn" type="button" data-act="p-add">+ Agregar producto a esta categoría</button></div>';
    else if (!list.length) h += '<p class="muted">Ningún producto coincide con “' + esc(A.q) + '”.</p>';
    return h;
  }
  function aiControls(p) {
    var id = esc(p.id), busy = A.aiBusy[p.id];
    if (busy) return '<span class="ai-busy"><span class="spin"></span>' + (p.foto ? 'Mejorando la foto…' : 'Creando la foto…') + ' puede tardar hasta un minuto.</span>';
    var dis = A.ai ? '' : ' disabled title="Agrega OPENAI_API_KEY en el servidor para activar"';
    return '<button class="btn small ai" type="button" data-act="' + (p.foto ? 'ai-enhance' : 'ai-generate') + '" data-v="' + id + '"' + dis + '>' + I_SPARK + (p.foto ? 'Mejorar con IA' : 'Crear foto con IA') + '</button>' +
      (A.prevFoto[p.id] ? '<button class="btn small" type="button" data-act="ai-undo" data-v="' + id + '">Volver a la foto anterior</button>' : '');
  }
  function prodRow(p, i, n) {
    var d = A.draft, open = A.editing === p.id, id = esc(p.id), c = catById(d, p.cat);
    var h = '<div class="arow' + (p.oculto ? ' hid' : '') + '">' +
      (p.foto ? '<img class="th" src="' + img(p.foto) + '" alt="">' : '<span class="th"></span>') +
      '<div class="nm"><b data-lbl="' + id + '">' + esc(p.nombre || 'Sin nombre') + '</b><small data-plbl="' + id + '">' + money(p.precio) + (A.q && c ? ' · ' + esc(c.nombre) : '') + (p.oculto ? ' · oculto' : '') + '</small></div>' +
      '<div class="acts">' +
      '<label class="switch" title="Marcar como agotado"><input type="checkbox" id="ag-' + id + '" data-bind="p:' + id + ':agotado"' + (p.agotado ? ' checked' : '') + '>Agotado</label>' +
      (A.q ? '' : '<button class="iconbtn" type="button" data-act="p-up" data-v="' + id + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="iconbtn" type="button" data-act="p-down" data-v="' + id + '" aria-label="Bajar"' + (i === n - 1 ? ' disabled' : '') + '>↓</button>') +
      '<button class="btn small' + (open ? ' primary' : '') + '" type="button" data-act="p-edit" data-v="' + id + '" aria-expanded="' + open + '">' + (open ? 'Listo' : 'Editar') + '</button></div>';
    if (open) {
      var cats = d.categorias.map(function (c2) { return '<option value="' + esc(c2.id) + '"' + (c2.id === p.cat ? ' selected' : '') + '>' + esc(c2.nombre) + '</option>'; }).join('');
      h += '<div class="edit"><div class="fgrid">' +
        '<label class="field"><span>Nombre</span><input id="pn-' + id + '" data-bind="p:' + id + ':nombre" value="' + esc(p.nombre) + '"></label>' +
        '<label class="field"><span>Precio (CLP)</span><input id="pp-' + id + '" inputmode="numeric" data-bind="p:' + id + ':precio" value="' + esc(p.precio) + '"></label>' +
        '<label class="field"><span>Categoría</span><select id="pc-' + id + '" data-bind="p:' + id + ':cat">' + cats + '</select></label></div>' +
        '<label class="field"><span>Descripción</span><textarea id="pd-' + id + '" data-bind="p:' + id + ':desc" rows="3">' + esc(p.desc) + '</textarea></label>' +
        '<div class="field"><span>Íconos</span><div class="checks">' + TAG_ORDER.map(function (t) {
          return '<label class="check"><input type="checkbox" id="pt-' + id + '-' + t + '" data-bind="pt:' + id + ':' + t + '"' + ((p.tags || []).indexOf(t) >= 0 ? ' checked' : '') + '>' + tagIcon(t) + esc(TAGS[t].label) + '</label>';
        }).join('') + '</div></div>' +
        '<div class="field"><span>Foto</span><div class="photo-ed">' + (p.foto ? '<img src="' + img(p.foto) + '" alt="">' : '<span class="ph0">Sin foto</span>') +
        '<div class="photo-btns"><label class="btn small filebtn">' + (p.foto ? 'Cambiar foto' : 'Subir foto') + '<input type="file" id="pf-' + id + '" accept="image/*" data-photo="' + id + '"></label>' +
        (p.foto ? '<button class="btn small" type="button" data-act="p-nophoto" data-v="' + id + '">Quitar foto</button>' : '') + aiControls(p) + '</div></div>' +
        '<label class="field ai-hint"><span>Indicaciones para la IA (opcional)</span><input id="pai-' + id + '" data-bind="aip:' + id + '" value="' + esc(A.aiPrompt[p.id] || '') + '" placeholder="Ej: en plato blanco, con más frutillas, vista desde arriba"></label></div>' +
        '<div class="toolbar spread"><label class="switch"><input type="checkbox" id="po-' + id + '" data-bind="p:' + id + ':oculto"' + (p.oculto ? ' checked' : '') + '>Ocultar de la carta</label>' +
        (A.confirm === 'del:' + p.id ? '<span class="confirm">¿Eliminar este producto? <button class="btn small danger" type="button" data-act="p-del-yes" data-v="' + id + '">Eliminar</button><button class="btn small" type="button" data-act="confirm-no">Cancelar</button></span>'
          : '<button class="btn small danger" type="button" data-act="p-del" data-v="' + id + '">Eliminar producto</button>') + '</div></div>';
    }
    return h + '</div>';
  }

  /* --- fotos con IA --- */
  function adminPhotos() {
    var d = A.draft, withP = d.productos.filter(function (p) { return p.foto; }), without = d.productos.filter(function (p) { return !p.foto && !p.oculto; });
    var h = '<div class="card"><h3>' + I_SPARK + ' Fotos profesionales con IA</h3>' +
      '<p class="help">Usa la IA de imágenes de OpenAI (la misma de ChatGPT) para convertir las fotos actuales en fotos de producto nítidas, o para crear fotos de productos que no tienen. Cada foto se cobra en tu cuenta de OpenAI. Revisa el resultado y luego toca <b>Publicar cambios</b>.</p>' +
      (A.ai ? '' : '<div class="notice warn">Para activar esta función agrega la variable <b>OPENAI_API_KEY</b> en Railway. La guía del proyecto explica cómo obtenerla.</div>') +
      (A.bulk ? '<div class="notice"><span><span class="spin"></span> Mejorando ' + A.bulk.done + ' de ' + A.bulk.total + '…</span><button class="btn small" type="button" data-act="bulk-stop">Detener</button></div>'
        : '<div class="toolbar"><button class="btn primary" type="button" data-act="bulk-enhance"' + (A.ai && withP.length ? '' : ' disabled') + '>' + I_SPARK + 'Mejorar todas las fotos (' + withP.length + ')</button></div>') + '</div>';
    h += '<h3 class="subh">Con foto</h3><div class="ph-grid">' + withP.map(photoCard).join('') + '</div>';
    if (without.length) h += '<h3 class="subh">Sin foto (' + without.length + ')</h3><div class="mini-list">' + without.map(function (p) {
      return '<div class="arow"><span class="th"></span><div class="nm"><b>' + esc(p.nombre) + '</b><small>' + esc((catById(d, p.cat) || {}).nombre || '') + '</small></div><div class="acts">' + aiControls(p) + '</div></div>';
    }).join('') + '</div>';
    return h;
  }
  function photoCard(p) {
    return '<div class="ph-card"><img src="' + img(p.foto) + '" alt="" loading="lazy">' +
      '<div class="ph-meta"><b>' + esc(p.nombre) + '</b>' + (A.prevFoto[p.id] ? '<small class="new">Foto nueva</small>' : '') + '</div><div class="ph-acts">' + aiControls(p) + '</div></div>';
  }

  /* --- categorías --- */
  function adminCats() {
    var d = A.draft, h = '<div class="card"><h3>Categorías</h3><p class="help">Cambia nombres, notas y el orden en que aparecen. Solo se puede eliminar una categoría vacía.</p></div>';
    h += d.categorias.map(function (c, i) {
      var n = d.productos.filter(function (p) { return p.cat === c.id; }).length, id = esc(c.id);
      var grp = d.grupos.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === c.grupo ? ' selected' : '') + '>' + esc(g.nombre) + '</option>'; }).join('');
      return '<div class="card"><div class="fgrid">' +
        '<label class="field"><span>Nombre</span><input id="cn-' + id + '" data-bind="c:' + id + ':nombre" value="' + esc(c.nombre) + '"></label>' +
        '<label class="field"><span>Sección</span><select id="cg-' + id + '" data-bind="c:' + id + ':grupo">' + grp + '</select></label></div>' +
        '<label class="field"><span>Nota bajo el título (opcional)</span><textarea id="cnt-' + id + '" rows="2" data-bind="c:' + id + ':nota">' + esc(c.nota) + '</textarea></label>' +
        '<div class="toolbar spread"><small class="muted">' + n + ' producto' + (n === 1 ? '' : 's') + '</small><span class="toolbar">' +
        '<button class="iconbtn" type="button" data-act="c-up" data-v="' + id + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="iconbtn" type="button" data-act="c-down" data-v="' + id + '" aria-label="Bajar"' + (i === d.categorias.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="btn small" type="button" data-act="c-open" data-v="' + id + '">Ver productos</button>' +
        (A.confirm === 'cdel:' + c.id ? '<span class="confirm">¿Eliminar? <button class="btn small danger" type="button" data-act="c-del-yes" data-v="' + id + '">Sí</button><button class="btn small" type="button" data-act="confirm-no">No</button></span>'
          : '<button class="btn small danger" type="button" data-act="c-del" data-v="' + id + '"' + (n ? ' disabled title="Mueve o elimina sus productos primero"' : '') + '>Eliminar</button>') +
        '</span></div></div>';
    }).join('');
    return h + '<div><button class="btn" type="button" data-act="c-add">+ Agregar categoría</button></div>';
  }

  /* --- bowl --- */
  function adminBowl() {
    var b = A.draft.bowl;
    var h = '<div class="card"><div class="toolbar spread"><h3>Armador de bowl de açaí</h3>' +
      '<label class="switch"><input type="checkbox" class="ok" id="b-act" data-bind="b:activo"' + (b.activo ? ' checked' : '') + '>Mostrar en la carta</label></div>' +
      '<div class="fgrid"><label class="field"><span>Título</span><input id="b-tit" data-bind="b:titulo" value="' + esc(b.titulo) + '"></label>' +
      '<label class="field"><span>Descripción</span><input id="b-desc" data-bind="b:desc" value="' + esc(b.desc) + '"></label></div></div>';
    h += '<div class="card"><h3>1 · Tamaños</h3><div class="mini-list">' + b.tamanos.map(function (s) {
      var id = esc(s.id);
      return '<div class="mini sz"><input id="bs-n-' + id + '" aria-label="Nombre" data-bind="bs:' + id + ':nombre" value="' + esc(s.nombre) + '">' +
        '<input id="bs-m-' + id + '" aria-label="Mililitros" inputmode="numeric" data-bind="bs:' + id + ':ml" value="' + esc(s.ml) + '">' +
        '<input id="bs-p-' + id + '" aria-label="Precio" inputmode="numeric" data-bind="bs:' + id + ':precio" value="' + esc(s.precio) + '"></div>';
    }).join('') + '</div><p class="help">Nombre · ml · precio</p></div>';
    h += '<div class="card"><h3>2 · Toppings incluidos</h3><div class="tagedit">' + b.incluidos.map(function (n, i) {
      return '<span>' + esc(n) + '<button type="button" data-act="bi-del" data-v="' + i + '" aria-label="Quitar ' + esc(n) + '">×</button></span>';
    }).join('') + '</div><div class="toolbar"><input id="bi-new" placeholder="Nuevo topping incluido" data-bind="ui:newInc" value="' + esc(A.newInc) + '"><button class="btn small" type="button" data-act="bi-add">Agregar</button></div></div>';
    h += '<div class="card"><h3>3 · Toppings extra</h3><div class="mini-list">' + b.extras.map(function (e) {
      var id = esc(e.id);
      return '<div class="mini"><input id="be-n-' + id + '" aria-label="Nombre" data-bind="be:' + id + ':nombre" value="' + esc(e.nombre) + '">' +
        '<input id="be-p-' + id + '" aria-label="Precio" inputmode="numeric" data-bind="be:' + id + ':precio" value="' + esc(e.precio) + '">' +
        '<span class="toolbar nowrap"><label class="switch" title="Agotado"><input type="checkbox" id="be-a-' + id + '" data-bind="be:' + id + ':agotado"' + (e.agotado ? ' checked' : '') + '><span class="sr">Agotado</span></label>' +
        '<button class="iconbtn" type="button" data-act="be-del" data-v="' + id + '" aria-label="Eliminar ' + esc(e.nombre) + '">×</button></span></div>';
    }).join('') + '</div><p class="help">El interruptor marca el topping como agotado.</p><div><button class="btn small" type="button" data-act="be-add">+ Agregar topping extra</button></div></div>';
    return h;
  }

  /* --- local --- */
  function adminInfo() {
    var i = A.draft.info;
    function f(k, label, ph) { return '<label class="field"><span>' + label + '</span><input id="i-' + k + '" data-bind="i:' + k + '" value="' + esc(i[k] || '') + '" placeholder="' + esc(ph || '') + '"></label>'; }
    return '<div class="card"><h3>Datos del local</h3><div class="fgrid">' +
      f('ubicacion', 'Ubicación', 'Pichidangui, Chile') + f('instagram', 'Instagram (sin @)', 'lacreperiaco') +
      f('whatsapp', 'WhatsApp (opcional)', '+56 9 1234 5678') + f('horario', 'Horario (opcional)', 'Lun a Dom · 10:00 a 20:00') + '</div>' +
      '<label class="field"><span>Frase de bienvenida</span><textarea id="i-lema" rows="2" data-bind="i:lema">' + esc(i.lema) + '</textarea></label>' +
      f('pie', 'Mensaje final', 'Gracias por ser parte de nuestra mesa') +
      '<label class="field"><span>Aviso de alérgenos</span><textarea id="i-aviso" rows="2" data-bind="i:aviso">' + esc(i.aviso) + '</textarea></label></div>';
  }

  /* --- historial --- */
  function adminHistory() {
    if (!A.history) { loadHistory(); return '<p class="muted"><span class="spin"></span> Cargando historial…</p>'; }
    if (A.history.error) return '<div class="notice err">' + esc(A.history.error) + '</div>';
    return '<div class="card"><h3>Versiones publicadas</h3><p class="help">Cada vez que publicas se guarda una copia. Si algo salió mal, restaura una versión anterior.</p></div><div class="mini-list">' +
      A.history.map(function (v, i) {
        return '<div class="arow hist"><span class="vnum">#' + v.id + '</span><div class="nm"><b>' + esc(fmtDate(v.created)) + (i === 0 ? ' · actual' : '') + '</b><small>' + v.productos + ' productos · ' + v.agotados + ' agotados' + (v.note ? ' · ' + esc(v.note) : '') + '</small></div><div class="acts">' +
          (i === 0 ? '' : A.confirm === 'restore:' + v.id ? '<span class="confirm">¿Restaurar? <button class="btn small primary" type="button" data-act="restore-yes" data-v="' + v.id + '">Sí</button><button class="btn small" type="button" data-act="confirm-no">No</button></span>'
            : '<button class="btn small" type="button" data-act="restore" data-v="' + v.id + '">Restaurar</button>') + '</div></div>';
      }).join('') + '</div>';
  }
  function loadHistory() {
    apiCall('GET', '/api/admin/history').then(function (r) { A.history = r.versions; if (A.tab === 'historial') renderAdmin(); })
      .catch(function (e) { if (!handleAuth(e)) { A.history = { error: e.message }; renderAdmin(); } });
  }

  /* --- QR --- */
  function adminQR() {
    var url = location.origin + '/';
    setTimeout(drawQR, 0);
    return '<div class="card qr"><h3>Código QR de la carta</h3><p class="help">Imprímelo para las mesas. Lleva a <b>' + esc(url) + '</b></p>' +
      '<div class="qrbox" id="lc-qr" role="img" aria-label="Código QR de la carta"><span class="spin"></span></div>' +
      '<div class="toolbar"><button class="btn primary" type="button" data-act="qr-png">Descargar PNG</button><button class="btn" type="button" data-act="qr-svg">Descargar SVG</button>' +
      '<button class="btn" type="button" data-act="copy-url">Copiar enlace</button></div></div>';
  }
  function loadQRLib() {
    if (window.qrcode) return Promise.resolve();
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = '/assets/qrcode.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function qrSvg() {
    var q = window.qrcode(0, 'M'); q.addData(location.origin + '/'); q.make();
    return q.createSvgTag({ cellSize: 8, margin: 3, scalable: true }).replace(/fill="black"/g, 'fill="#033555"').replace(/#000000/g, '#033555');
  }
  function drawQR() {
    var box = $('#lc-qr'); if (!box) return;
    loadQRLib().then(function () { box.innerHTML = qrSvg(); }, function () { box.textContent = 'No se pudo generar el código QR.'; });
  }
  function saveBlob(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function downloadQR(kind) {
    loadQRLib().then(function () {
      var svg = qrSvg(), blob = new Blob([svg], { type: 'image/svg+xml' });
      if (kind === 'svg') return saveBlob(blob, 'qr-carta-la-creperia.svg');
      var url = URL.createObjectURL(blob), im = new Image();
      im.onload = function () {
        var cv = document.createElement('canvas'); cv.width = cv.height = 1200;
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, 1200, 1200); cx.drawImage(im, 0, 0, 1200, 1200);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { if (b) saveBlob(b, 'qr-carta-la-creperia.png'); }, 'image/png');
      };
      im.src = url;
    });
  }

  /* --- eventos del panel --- */
  function bindAdmin(el) {
    el.addEventListener('input', onAdminInput);
    el.addEventListener('change', onAdminChange);
    el.addEventListener('click', onAdminClick);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'bi-new') { e.preventDefault(); addInc(); } });
  }
  function toInt(v) { var n = parseInt(String(v).replace(/[^\d]/g, ''), 10); return isNaN(n) ? 0 : n; }
  function el$(s) { return $('#lc-admin ' + s); }
  function applyBind(t) {
    var b = t.getAttribute('data-bind'); if (!b) return false;
    var parts = b.split(':'), kind = parts[0], d = A.draft, val = t.type === 'checkbox' ? t.checked : t.value;
    if (kind === 'ui') { A[parts[1]] = val; return parts[1] === 'cat' ? 'rerender' : 'ui'; }
    if (kind === 'aip') { A.aiPrompt[parts[1]] = val; return 'ui'; }
    if (kind === 'p') {
      var p = prodById(d, parts[1]); if (!p) return false;
      var k = parts[2];
      if (k === 'precio') { p.precio = toInt(val); var pl = el$('[data-plbl="' + p.id + '"]'); if (pl) pl.textContent = money(p.precio); }
      else p[k] = val;
      if (k === 'nombre') { var l = el$('[data-lbl="' + p.id + '"]'); if (l) l.textContent = val || 'Sin nombre'; }
      return k === 'cat' || k === 'oculto' ? 'rerender' : true;
    }
    if (kind === 'pt') {
      var pp = prodById(d, parts[1]); if (!pp) return false;
      pp.tags = (pp.tags || []).filter(function (x) { return x !== parts[2]; });
      if (val) pp.tags.push(parts[2]);
      pp.tags.sort(function (a, b2) { return TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b2); });
      return true;
    }
    if (kind === 'c') { var c = catById(d, parts[1]); if (c) c[parts[2]] = val; return true; }
    if (kind === 'b') { d.bowl[parts[1]] = val; return true; }
    if (kind === 'bs') { var s = d.bowl.tamanos.filter(function (x) { return x.id === parts[1]; })[0]; if (s) s[parts[2]] = parts[2] === 'nombre' ? val : toInt(val); return true; }
    if (kind === 'be') { var e = d.bowl.extras.filter(function (x) { return x.id === parts[1]; })[0]; if (e) e[parts[2]] = parts[2] === 'nombre' || parts[2] === 'agotado' ? val : toInt(val); return true; }
    if (kind === 'i') { d.info[parts[1]] = val; return true; }
    return false;
  }
  function changed(r) {
    if (r === 'ui') return;
    if (A.confirm === 'publish' || A.confirm === 'discard') A.confirm = null;
    persistDraft();
    if (r === 'rerender') renderAdmin(); else renderAdminFoot();
  }
  function onAdminInput(e) {
    var t = e.target; if (t.type === 'checkbox' || t.tagName === 'SELECT' || t.type === 'file') return;
    if (t.getAttribute('data-bind') === 'ui:q') {
      A.q = t.value; clearTimeout(onAdminInput.t);
      onAdminInput.t = setTimeout(function () { renderAdmin(); var q = $('#a-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 200);
      return;
    }
    var r = applyBind(t); if (r) changed(r);
  }
  function onAdminChange(e) {
    var t = e.target;
    if (t.type === 'file') { var id = t.getAttribute('data-photo'); if (id && t.files && t.files[0]) uploadPhoto(id, t.files[0]); return; }
    if (t.type === 'checkbox' || t.tagName === 'SELECT') { var r = applyBind(t); if (r) changed(r); }
  }
  function move(arr, i, dir) { var j = i + dir; if (i < 0 || j < 0 || j >= arr.length) return; var x = arr[i]; arr[i] = arr[j]; arr[j] = x; }
  function moveProduct(id, dir) {
    var d = A.draft, p = prodById(d, id); if (!p) return;
    var same = d.productos.filter(function (x) { return x.cat === p.cat; }), other = same[same.indexOf(p) + dir]; if (!other) return;
    var a = d.productos.indexOf(p), b = d.productos.indexOf(other);
    d.productos[a] = other; d.productos[b] = p;
  }
  function addInc() {
    var v = (A.newInc || '').trim(); if (!v) return;
    A.draft.bowl.incluidos.push(v); A.newInc = ''; changed('rerender');
    var n = $('#bi-new'); if (n) n.focus();
  }
  function focusNew(sel) { var el = $(sel); if (el) { el.focus(); if (el.select) el.select(); el.scrollIntoView({ block: 'center' }); } }

  function onAdminClick(e) {
    var t = e.target.closest('button'); if (!t) return;
    var act = t.getAttribute('data-act'), v = t.getAttribute('data-v'), d = A.draft;
    if (!act) return;
    switch (act) {
      case 'close': closeAdmin(); return;
      case 'logout': persistDraftNow(); apiCall('POST', '/api/admin/logout', {}).finally(function () { location.href = '/'; }); return;
      case 'reload': persistDraftNow(); location.reload(); return;
      case 'tab': A.tab = v; A.confirm = null; if (v === 'historial') A.history = null; renderAdmin(); $('#lc-admin main').scrollTop = 0; return;
      case 'notice-x': A.notice = null; renderAdmin(); return;
      case 'stale-restore': A.draft = A.stale; A.stale = null; A.notice = { kind: 'warn', text: 'Recuperaste tus cambios. Revísalos antes de publicar: la carta cambió desde que los hiciste.' }; changed('rerender'); return;
      case 'stale-drop': A.stale = null; lsDel(DRAFT_KEY); renderAdmin(); return;
      case 'confirm-no': A.confirm = null; renderAdmin(); return;
      case 'p-edit': A.editing = A.editing === v ? null : v; A.confirm = null; renderAdmin(); return;
      case 'p-up': moveProduct(v, -1); changed('rerender'); return;
      case 'p-down': moveProduct(v, 1); changed('rerender'); return;
      case 'p-del': A.confirm = 'del:' + v; renderAdmin(); return;
      case 'p-del-yes': d.productos = d.productos.filter(function (p) { return p.id !== v; }); A.confirm = null; A.editing = null; changed('rerender'); return;
      case 'p-nophoto': var pn = prodById(d, v); if (pn) { A.prevFoto[v] = { foto: pn.foto }; pn.foto = ''; } changed('rerender'); return;
      case 'p-add':
        var np = { id: uid('p'), cat: A.cat, nombre: 'Nuevo producto', desc: '', precio: 0, tags: [], foto: '', agotado: false, oculto: false };
        var last = -1; d.productos.forEach(function (p, i) { if (p.cat === A.cat) last = i; });
        d.productos.splice(last + 1, 0, np); A.editing = np.id; changed('rerender'); focusNew('#pn-' + np.id);
        return;
      case 'c-up': case 'c-down': move(d.categorias, d.categorias.findIndex(function (c) { return c.id === v; }), act === 'c-up' ? -1 : 1); changed('rerender'); return;
      case 'c-open': A.cat = v; A.q = ''; A.tab = 'productos'; renderAdmin(); $('#lc-admin main').scrollTop = 0; return;
      case 'c-del': A.confirm = 'cdel:' + v; renderAdmin(); return;
      case 'c-del-yes': d.categorias = d.categorias.filter(function (c) { return c.id !== v; }); A.confirm = null; changed('rerender'); return;
      case 'c-add': var nc = { id: uid('c'), grupo: d.grupos[0].id, nombre: 'Nueva categoría', nota: '' }; d.categorias.push(nc); changed('rerender'); focusNew('#cn-' + nc.id); return;
      case 'bi-del': d.bowl.incluidos.splice(Number(v), 1); changed('rerender'); return;
      case 'bi-add': addInc(); return;
      case 'be-del': d.bowl.extras = d.bowl.extras.filter(function (x) { return x.id !== v; }); changed('rerender'); return;
      case 'be-add': var ne = { id: uid('e'), nombre: 'Nuevo topping', precio: 0, agotado: false }; d.bowl.extras.push(ne); changed('rerender'); focusNew('#be-n-' + ne.id); return;
      case 'discard': A.confirm = 'discard'; renderAdminFoot(); return;
      case 'discard-yes': A.draft = clone(DATA); A.confirm = null; A.editing = null; A.prevFoto = {}; lsDel(DRAFT_KEY); A.notice = { text: 'Cambios descartados. Estás viendo la carta publicada.' }; renderAdmin(); return;
      case 'preview': UI.previewing = true; view = A.draft; $('#lc-admin').hidden = true; document.documentElement.style.overflow = ''; renderView(); window.scrollTo(0, 0); return;
      case 'publish': A.confirm = 'publish'; renderAdminFoot(); return;
      case 'publish-yes': publish(); return;
      case 'ai-enhance': case 'ai-generate': runAI(v, act === 'ai-enhance').catch(function () { }); return;
      case 'ai-undo': var pu = prodById(d, v); if (pu && A.prevFoto[v]) { pu.foto = A.prevFoto[v].foto || ''; delete A.prevFoto[v]; } changed('rerender'); return;
      case 'bulk-enhance': bulkEnhance(); return;
      case 'bulk-stop': if (A.bulk) A.bulk.stop = true; return;
      case 'restore': A.confirm = 'restore:' + v; renderAdmin(); return;
      case 'restore-yes': restore(v); return;
      case 'qr-png': downloadQR('png'); return;
      case 'qr-svg': downloadQR('svg'); return;
      case 'copy-url':
        var u = location.origin + '/';
        if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { t.textContent = 'Enlace copiado'; }, function () { t.textContent = u; });
        else t.textContent = u;
        return;
    }
  }

  /* --- fotos --- */
  function resizeToBlob(file, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) {
          if (b && b.type === 'image/webp') return resolve(b);
          cv.toBlob(function (j) { j ? resolve(j) : reject(new Error('No se pudo procesar la imagen.')); }, 'image/jpeg', 0.85);
        }, 'image/webp', 0.85);
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('No pudimos leer esa imagen. Prueba con otra foto (JPG o PNG).')); };
      im.src = url;
    });
  }
  function uploadPhoto(id, file) {
    if (!/^image\//.test(file.type)) { A.notice = { kind: 'err', text: 'Ese archivo no es una imagen. Sube una foto JPG, PNG o WEBP.' }; renderAdmin(); return; }
    A.notice = { text: 'Subiendo foto…' }; renderAdmin();
    resizeToBlob(file, 1600).then(function (blob) { return apiCall('POST', '/api/admin/images', undefined, blob); })
      .then(function (r) {
        var p = prodById(A.draft, id); if (p) { A.prevFoto[id] = { foto: p.foto || '' }; p.foto = r.id; }
        A.notice = { text: 'Foto subida. Recuerda publicar los cambios.' }; changed('rerender');
      })
      .catch(function (e) { if (!handleAuth(e)) { A.notice = { kind: 'err', text: e.message }; renderAdmin(); } });
  }
  function runAI(id, enhance) {
    var p = prodById(A.draft, id); if (!p || A.aiBusy[id]) return Promise.resolve();
    A.aiBusy[id] = true; renderAdmin();
    var body = { nombre: p.nombre, desc: p.desc, extra: A.aiPrompt[id] || '' };
    if (enhance) body.imageId = p.foto;
    return apiCall('POST', enhance ? '/api/admin/ai/enhance' : '/api/admin/ai/generate', body).then(function (r) {
      var q = prodById(A.draft, id); if (q) { A.prevFoto[id] = { foto: q.foto || '' }; q.foto = r.id; }
      delete A.aiBusy[id]; changed('rerender');
    }, function (e) {
      delete A.aiBusy[id];
      if (!handleAuth(e)) { A.notice = { kind: 'err', text: e.message }; renderAdmin(); }
      throw e;
    });
  }
  function bulkEnhance() {
    var list = A.draft.productos.filter(function (p) { return p.foto && !A.prevFoto[p.id]; }).map(function (p) { return p.id; });
    if (!list.length) { A.notice = { text: 'Todas las fotos ya fueron mejoradas en esta sesión.' }; renderAdmin(); return; }
    A.bulk = { total: list.length, done: 0, stop: false }; renderAdmin();
    var i = 0;
    (function next() {
      if (!A.bulk || A.bulk.stop || i >= list.length) {
        var done = A.bulk ? A.bulk.done : 0; A.bulk = null;
        A.notice = { text: done + ' foto' + (done === 1 ? '' : 's') + ' mejorada' + (done === 1 ? '' : 's') + '. Revisa el resultado y publica los cambios.' };
        renderAdmin(); return;
      }
      runAI(list[i++], true).then(function () { A.bulk && A.bulk.done++; next(); }, function (e) {
        if (e && (e.status === 401 || e.status === 501 || e.status === 0)) { A.bulk = null; return; }
        next();
      });
    })();
  }

  /* --- publicar / restaurar --- */
  function prune(d) {
    d.productos.forEach(function (p) { p.foto = p.foto || ''; });
    return d;
  }
  function publish() {
    if (A.busy) return;
    A.busy = true; renderAdminFoot();
    var data = prune(clone(A.draft));
    apiCall('PUT', '/api/admin/menu', { menu: data, baseVersion: A.version && A.version.id }).then(function (r) {
      A.busy = false; A.confirm = null;
      DATA = data; DATA_STR = JSON.stringify(DATA); A.version = r.version; A.draft = clone(DATA); A.prevFoto = {};
      lsDel(DRAFT_KEY);
      A.notice = { text: 'Carta publicada. Los clientes ya ven los cambios.' }; renderAdmin();
    }, function (e) {
      A.busy = false; A.confirm = null;
      if (handleAuth(e)) return;
      if (e.status === 409) { persistDraftNow(); A.notice = { kind: 'err', text: e.message, reload: true }; }
      else A.notice = { kind: 'err', text: e.message };
      renderAdmin();
    });
  }
  function restore(id) {
    apiCall('POST', '/api/admin/history/' + encodeURIComponent(id) + '/restore', {}).then(function (r) {
      DATA = r.menu; DATA_STR = JSON.stringify(DATA); A.version = r.version; A.draft = clone(DATA); A.confirm = null; A.history = null; A.prevFoto = {};
      lsDel(DRAFT_KEY); A.notice = { text: 'Versión restaurada y publicada.' }; renderAdmin();
    }, function (e) { if (!handleAuth(e)) { A.notice = { kind: 'err', text: e.message }; A.confirm = null; renderAdmin(); } });
  }

  /* ---------- inicio ---------- */
  renderShell();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureBar);
  if (MODE === 'admin') {
    apiCall('GET', '/api/admin/session').then(function (s) {
      A.ai = !!s.ai; A.volume = s.volume !== false;
      if (!s.configured) return showLogin('', true);
      if (!s.admin) return showLogin();
      UI.admin = true;
      return loadServerMenu().then(openAdmin);
    }).catch(function (e) { showLogin(e.message); });
  }
})();
