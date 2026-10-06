(function () {
  var LIB = window.LIBRARY, CATS = window.CATEGORIES;
  var BY = {}; LIB.forEach(function (x) { BY[x.id] = x; });
  var KEY = 'gc_positions_v2';
  var $ = function (id) { return document.getElementById(id); };
  var vid = $('vid');
  var mode = 'home';            // home | show | player | credits
  var rows = [], rowIdx = 0, colIdx = {};
  var epIdx = 0, current = null, currentShow = null, hudTimer = null, toastTimer = null;
  var TILE_W = 214, ROW_H = 168;

  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }
  function mins(s) { var m = Math.round(s / 60); return m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60) + ' min' : m + ' min'; }
  function positions() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function store(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function savePos() {
    if (!current) return;
    var p = positions(), t = vid.currentTime || 0;
    if (vid.duration && t > vid.duration - 30) { delete p[current.id]; p['done_' + current.id] = 1; }
    else if (t > 5) p[current.id] = Math.floor(t);
    if (currentShow) p['last_' + currentShow.id] = epIdx;
    p['ts_' + (currentShow ? currentShow.id : current.id)] = Date.now();
    store(p);
  }
  function show(screen) {
    ['home', 'lib', 'player', 'creditsScreen'].forEach(function (s) { $(s).classList.toggle('on', s === screen); });
    $('focusSink').focus();
  }

  // ---------- Home (category rows) ----------
  function buildRows() {
    var p = positions(), cont = [];
    LIB.forEach(function (x) {
      if (x.show ? p['last_' + x.id] != null : p[x.id]) cont.push(x);
    });
    cont.sort(function (a, b) { return (p['ts_' + b.id] || 0) - (p['ts_' + a.id] || 0); });
    rows = [];
    if (cont.length) rows.push({ name: 'Continue Watching', items: cont });
    CATS.forEach(function (c) { rows.push({ name: c.name, items: c.ids.map(function (i) { return BY[i]; }) }); });
    rows.push({ name: 'All', items: LIB.slice().sort(function (a, b) { return a.title.replace(/^The /, '').localeCompare(b.title.replace(/^The /, '')); }) });
    rows.push({ name: 'About', items: [{ id: '_credits', title: 'Credits', credits: true }] });
    if (rowIdx >= rows.length) rowIdx = rows.length - 1;
  }

  function renderRows() {
    var p = positions();
    $('rows').innerHTML = rows.map(function (r, ri) {
      return '<div class="row" data-r="' + ri + '"><h2>' + r.name + '</h2><div class="strip">' +
        r.items.map(function (it, ci) {
          var img = it.credits ? 'icon.png' : 'media/' + it.id + '.jpg';
          var prog = (!it.show && !it.credits && p[it.id]) ? '<div class="prog" style="width:' + Math.min(100, 100 * p[it.id] / it.len) + '%"></div>' : '';
          return '<div class="tile" data-c="' + ci + '"><img src="' + img + '" alt=""><div class="tag">' + it.title + '</div>' + prog + '</div>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function updateHome() {
    var rowEls = $('rows').children;
    for (var i = 0; i < rowEls.length; i++) {
      var r = rows[i], c = colIdx[r.name] || 0;
      if (c >= r.items.length) c = colIdx[r.name] = r.items.length - 1;
      rowEls[i].classList.toggle('cur', i === rowIdx);
      var tiles = rowEls[i].querySelectorAll('.tile');
      for (var j = 0; j < tiles.length; j++) tiles[j].classList.toggle('sel', j === c);
      var maxShift = Math.max(0, r.items.length * TILE_W - 552);
      var shift = Math.min(maxShift, Math.max(0, (c - 1) * TILE_W));
      rowEls[i].querySelector('.strip').style.transform = 'translateX(' + (-shift) + 'px)';
    }
    var top = Math.min(rowIdx * ROW_H, Math.max(0, rows.length * ROW_H - 400));
    $('rows').style.transform = 'translateY(' + (-top) + 'px)';
    var it = rows[rowIdx].items[colIdx[rows[rowIdx].name] || 0], p = positions();
    $('dTitle').textContent = it.title;
    if (it.credits) { $('dMeta').textContent = 'Where these films come from'; $('dResume').textContent = ''; }
    else if (it.show) {
      $('dMeta').textContent = 'TV series \u00b7 ' + it.year + ' \u00b7 ' + it.eps.length + ' episodes';
      var last = p['last_' + it.id];
      $('dResume').textContent = last != null ? 'Continue S' + it.eps[last].s + ' E' + it.eps[last].e + ': ' + it.eps[last].title : 'Pinch to see episodes';
    } else {
      $('dMeta').textContent = it.year + ' \u00b7 ' + mins(it.len);
      $('dResume').textContent = p[it.id] ? 'Resume at ' + fmt(p[it.id]) : (p['done_' + it.id] ? 'Watched' : '');
    }
  }

  function renderHome() {
    mode = 'home';
    buildRows(); renderRows(); updateHome();
    show('home');
  }
  function selectedItem() { var r = rows[rowIdx]; return r.items[colIdx[r.name] || 0]; }

  // ---------- Show (episode picker) ----------
  function renderShow() {
    mode = 'show';
    var ep = currentShow.eps[epIdx], p = positions();
    $('hdr').textContent = currentShow.title;
    $('poster').src = 'media/' + currentShow.id + '.jpg';
    $('title').textContent = ep.title;
    $('meta').textContent = 'Season ' + ep.s + ' \u00b7 Episode ' + ep.e + ' \u00b7 ' + mins(ep.len);
    $('resume').textContent = p[ep.id] ? 'Resume at ' + fmt(p[ep.id]) : (p['done_' + ep.id] ? 'Watched' : '');
    $('dots').textContent = (epIdx + 1) + ' of ' + currentShow.eps.length;
    show('lib');
  }
  function openShow(item) {
    currentShow = item;
    var last = positions()['last_' + item.id];
    epIdx = last != null ? last : 0;
    history.pushState({ screen: 'show', id: item.id }, '');
    renderShow();
  }
  function seasonJump(dir) {
    var eps = currentShow.eps, s = eps[epIdx].s + dir;
    for (var i = 0; i < eps.length; i++) if (eps[i].s === s) { epIdx = i; return true; }
    return false;
  }

  // ---------- Player ----------
  function toast(text) {
    var t = $('toast'); t.textContent = text; t.style.opacity = 1;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.style.opacity = 0; }, 800);
  }
  function pokeHud() {
    $('hud').classList.remove('hide');
    clearTimeout(hudTimer);
    if (!vid.paused) hudTimer = setTimeout(function () { $('hud').classList.add('hide'); }, 3000);
  }
  function updateHud() {
    if (!current) return;
    var d = vid.duration || current.len;
    $('cur').textContent = fmt(vid.currentTime);
    $('dur').textContent = fmt(d);
    $('fill').style.width = (100 * (vid.currentTime / d)) + '%';
    if (!vid.seeking && vid.readyState >= 2) $('state').textContent = vid.paused ? 'Paused' : '';
  }
  function play(item, push) {
    current = item;
    mode = 'player';
    $('ptitle').textContent = currentShow && item.s ? 'S' + item.s + ' E' + item.e + ' \u00b7 ' + item.title : item.title;
    $('state').textContent = 'Loading\u2026';
    vid.src = item.u;
    var start = positions()[item.id] || 0;
    vid.addEventListener('loadedmetadata', function once() {
      vid.removeEventListener('loadedmetadata', once);
      if (start) vid.currentTime = start;
    });
    show('player');
    if (push) history.pushState({ screen: 'player' }, '');
    var pr = vid.play();
    if (pr && pr.catch) pr.catch(function () { $('state').textContent = 'Pinch to play'; pokeHud(); });
    pokeHud(); updateHud();
  }
  function stopVideo() {
    savePos();
    vid.pause(); vid.removeAttribute('src'); vid.load();
    current = null;
  }

  vid.addEventListener('timeupdate', updateHud);
  vid.addEventListener('pause', function () { updateHud(); pokeHud(); savePos(); });
  vid.addEventListener('play', function () { updateHud(); pokeHud(); });
  vid.addEventListener('playing', function () { $('state').textContent = ''; });
  vid.addEventListener('waiting', function () { $('state').textContent = 'Loading\u2026'; });
  vid.addEventListener('error', function () { if (current) { $('state').textContent = 'Could not load video'; pokeHud(); } });
  vid.addEventListener('ended', function () {
    savePos();
    if (currentShow && current && current.s && epIdx < currentShow.eps.length - 1) {
      epIdx++; toast('Next episode'); savePos();
      setTimeout(function () { play(currentShow.eps[epIdx], false); }, 1200);
    } else { toast('The End'); setTimeout(function () { history.back(); }, 1500); }
  });
  setInterval(function () { if (current && !vid.paused) savePos(); }, 10000);

  function renderCredits() {
    $('creditList').innerHTML =
      '<p>Public domain films and TV, plus Pioneer One (Creative Commons, by Josh Bernhard and Bracey Smith). Streamed from the Internet Archive (archive.org).</p>' +
      '<p style="margin-top:12px">' + LIB.map(function (f) { return f.title + ' (' + f.year + ')'; }).join(' \u00b7 ') + '</p>';
  }

  // ---------- Navigation ----------
  window.addEventListener('popstate', function (e) {
    var s = e.state || { screen: 'home' };
    if (current) stopVideo();
    if (s.screen === 'show') { currentShow = BY[s.id]; renderShow(); }
    else if (s.screen === 'player') { history.back(); }
    else { currentShow = null; renderHome(); }
  });

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (mode === 'player') {
      if (k === 'Enter' || k === ' ') { if (vid.paused) vid.play(); else vid.pause(); toast(vid.paused ? '\u275a\u275a' : '\u25b6'); }
      else if (k === 'ArrowRight') { vid.currentTime = Math.min((vid.duration || 1e9) - 1, vid.currentTime + 30); toast('+30s'); }
      else if (k === 'ArrowLeft') { vid.currentTime = Math.max(0, vid.currentTime - 30); toast('\u221230s'); }
      else if (k === 'ArrowUp') { vid.muted = false; vid.volume = Math.min(1, Math.round((vid.volume + 0.1) * 10) / 10); toast('Vol ' + Math.round(vid.volume * 100)); }
      else if (k === 'ArrowDown') { vid.volume = Math.max(0, Math.round((vid.volume - 0.1) * 10) / 10); toast('Vol ' + Math.round(vid.volume * 100)); }
      else if (k === 'Escape' || k === 'Backspace') { history.back(); }
      else return;
      pokeHud(); e.preventDefault(); return;
    }
    if (mode === 'credits') {
      if (k === 'Enter' || k === 'Escape' || k === 'Backspace') { history.back(); e.preventDefault(); }
      return;
    }
    if (mode === 'show') {
      var n = currentShow.eps.length;
      if (k === 'ArrowRight') epIdx = (epIdx + 1) % n;
      else if (k === 'ArrowLeft') epIdx = (epIdx - 1 + n) % n;
      else if (k === 'ArrowDown') { if (!seasonJump(1)) epIdx = 0; }
      else if (k === 'ArrowUp') { if (!seasonJump(-1)) epIdx = 0; }
      else if (k === 'Enter') { play(currentShow.eps[epIdx], true); e.preventDefault(); return; }
      else if (k === 'Escape' || k === 'Backspace') { history.back(); e.preventDefault(); return; }
      else return;
      renderShow(); e.preventDefault(); return;
    }
    // home
    var r = rows[rowIdx], c = colIdx[r.name] || 0;
    if (k === 'ArrowDown') rowIdx = Math.min(rows.length - 1, rowIdx + 1);
    else if (k === 'ArrowUp') rowIdx = Math.max(0, rowIdx - 1);
    else if (k === 'ArrowRight') colIdx[r.name] = Math.min(r.items.length - 1, c + 1);
    else if (k === 'ArrowLeft') colIdx[r.name] = Math.max(0, c - 1);
    else if (k === 'Enter') {
      var it = selectedItem();
      e.preventDefault();
      if (it.credits) { mode = 'credits'; show('creditsScreen'); history.pushState({ screen: 'credits' }, ''); }
      else if (it.show) openShow(it);
      else { currentShow = null; play(it, true); }
      return;
    }
    else return;
    updateHome(); e.preventDefault();
  });

  function netState() { $('net').textContent = navigator.onLine ? '' : 'Offline'; }
  window.addEventListener('online', netState);
  window.addEventListener('offline', netState);

  history.replaceState({ screen: 'home' }, '');
  renderCredits();
  renderHome();
  netState();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
