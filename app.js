(function () {
  var LIB = window.LIBRARY, CATS = window.CATEGORIES;
  var BY = {}; LIB.forEach(function (x) { BY[x.id] = x; });
  var KEY = 'gc_positions_v2', RECENT = 'gc_archive_recent';
  var IA = 'https://archive.org';
  var COLLECTIONS = [
    { id: 'feature_films', title: 'Feature Films' },
    { id: 'Film_Noir', title: 'Film Noir' },
    { id: 'SciFi_Horror', title: 'Sci-Fi & Horror' },
    { id: 'Comedy_Films', title: 'Comedy Films' },
    { id: 'silent_films', title: 'Silent Films' },
    { id: 'classic_cartoons', title: 'Cartoons' }
  ];
  var $ = function (id) { return document.getElementById(id); };
  var vid = $('vid');
  var mode = 'home';            // home | browse | show | player | credits | search
  var rows = [], rowIdx = 0, colIdx = {};
  var epIdx = 0, current = null, currentShow = null, hudTimer = null, toastTimer = null;
  var browse = null;            // {title, q, items:[], page, total, idx, loading}
  var TILE_W = 214, ROW_H = 168;

  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }
  function mins(s) { if (!s) return ''; var m = Math.round(s / 60); return m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60) + ' min' : m + ' min'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function positions() { return load(KEY, {}); }
  function store(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function thumb(id) { return IA + '/services/img/' + encodeURIComponent(id); }
  function imgFor(it) { return it.img || (it.credits ? 'icon.png' : 'media/' + it.id + '.jpg'); }

  function savePos() {
    if (!current) return;
    var p = positions(), t = vid.currentTime || 0;
    if (vid.duration && t > vid.duration - 30) { delete p[current.id]; p['done_' + current.id] = 1; }
    else if (t > 5) p[current.id] = Math.floor(t);
    if (currentShow) p['last_' + currentShow.id] = epIdx;
    p['ts_' + (currentShow ? currentShow.id : current.id)] = Date.now();
    store(p);
  }
  function rememberArchive(item) {
    var r = load(RECENT, []).filter(function (x) { return x.id !== item.id; });
    r.unshift({ id: item.id, title: item.title });
    try { localStorage.setItem(RECENT, JSON.stringify(r.slice(0, 12))); } catch (e) {}
  }
  function show(screen) {
    ['home', 'lib', 'player', 'creditsScreen', 'searchScreen'].forEach(function (s) { $(s).classList.toggle('on', s === screen); });
    if (screen !== 'searchScreen') $('focusSink').focus();
  }

  // ---------- Home (category rows) ----------
  function buildRows() {
    var p = positions(), cont = [];
    LIB.forEach(function (x) { if (x.show ? p['last_' + x.id] != null : p[x.id]) cont.push(x); });
    load(RECENT, []).forEach(function (x) { cont.push({ id: x.id, title: x.title, archive: true, img: thumb(x.id) }); });
    cont.sort(function (a, b) { return (p['ts_' + b.id] || 0) - (p['ts_' + a.id] || 0); });
    rows = [];
    if (cont.length) rows.push({ name: 'Continue Watching', items: cont });
    CATS.forEach(function (c) { rows.push({ name: c.name, items: c.ids.map(function (i) { return BY[i]; }) }); });
    rows.push({ name: 'Internet Archive', items: [{ id: '_search', title: 'Search the Archive', search: true, img: 'icon.png' }].concat(
      COLLECTIONS.map(function (c) { return { id: c.id, title: c.title, collection: true, img: thumb(c.id) }; })) });
    rows.push({ name: 'All', items: LIB.slice().sort(function (a, b) { return a.title.replace(/^The /, '').localeCompare(b.title.replace(/^The /, '')); }) });
    rows.push({ name: 'About', items: [{ id: '_credits', title: 'Credits', credits: true }] });
    if (rowIdx >= rows.length) rowIdx = rows.length - 1;
  }
  function renderRows() {
    var p = positions();
    $('rows').innerHTML = rows.map(function (r, ri) {
      return '<div class="row" data-r="' + ri + '"><h2>' + esc(r.name) + '</h2><div class="strip">' +
        r.items.map(function (it, ci) {
          var prog = (it.len && !it.show && p[it.id]) ? '<div class="prog" style="width:' + Math.min(100, 100 * p[it.id] / it.len) + '%"></div>' : '';
          return '<div class="tile" data-c="' + ci + '"><img src="' + esc(imgFor(it)) + '" alt=""><div class="tag">' + esc(it.title) + '</div>' + prog + '</div>';
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
    var it = selectedItem(), p = positions();
    $('dTitle').textContent = it.title;
    if (it.credits) { $('dMeta').textContent = 'Where these films come from'; $('dResume').textContent = ''; }
    else if (it.search) { $('dMeta').textContent = 'Find any film or show by voice'; $('dResume').textContent = 'Pinch to search'; }
    else if (it.collection) { $('dMeta').textContent = 'Internet Archive collection'; $('dResume').textContent = 'Pinch to browse'; }
    else if (it.archive) { $('dMeta').textContent = 'From the Internet Archive'; $('dResume').textContent = 'Pinch to continue'; }
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
    var prevName = rows[rowIdx] && rows[rowIdx].name;
    buildRows();
    if (prevName) for (var i = 0; i < rows.length; i++) if (rows[i].name === prevName) { rowIdx = i; break; }
    renderRows(); updateHome();
    show('home');
  }
  function selectedItem() { var r = rows[rowIdx]; return r.items[colIdx[r.name] || 0]; }

  // ---------- Internet Archive: browse + search ----------
  function iaQuery(q, page) {
    var url = IA + '/advancedsearch.php?q=' + encodeURIComponent(q) +
      '&fl[]=identifier&fl[]=title&fl[]=year&sort[]=downloads+desc&rows=40&page=' + page + '&output=json';
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) { return d.response; });
  }
  function startBrowse(title, q, push) {
    browse = { title: title, q: q, items: [], page: 0, total: null, idx: 0, loading: false };
    if (push) history.pushState({ screen: 'browse' }, '');
    mode = 'browse';
    renderBrowse();
    moreResults();
  }
  function moreResults() {
    if (!browse || browse.loading || (browse.total != null && browse.items.length >= browse.total)) return;
    browse.loading = true; var b = browse;
    iaQuery(b.q, b.page + 1).then(function (res) {
      b.loading = false; b.page++; b.total = res.numFound;
      res.docs.forEach(function (d) { b.items.push({ id: d.identifier, title: d.title || d.identifier, year: d.year, archive: true, img: thumb(d.identifier) }); });
      if (mode === 'browse' && browse === b) renderBrowse();
    }).catch(function () { b.loading = false; if (mode === 'browse') { $('title').textContent = 'Could not reach the Internet Archive'; $('meta').textContent = 'Check your connection and try again'; } });
  }
  function renderBrowse() {
    show('lib');
    $('hdr').textContent = browse.title;
    $('hint').textContent = 'Swipe to browse \u00b7 pinch to open';
    if (!browse.items.length) {
      $('poster').src = 'icon.png';
      $('title').textContent = browse.total === 0 ? 'No results' : 'Loading\u2026';
      $('meta').textContent = browse.total === 0 ? 'Swipe back and try another search' : '';
      $('resume').textContent = ''; $('dots').textContent = '';
      return;
    }
    var it = browse.items[browse.idx];
    $('poster').src = it.img;
    $('title').textContent = it.title;
    $('meta').textContent = it.year ? String(it.year) : 'Internet Archive';
    $('resume').textContent = '';
    $('dots').textContent = (browse.idx + 1) + ' of ' + (browse.total || browse.items.length);
    if (browse.idx > browse.items.length - 6) moreResults();
  }

  // Pick playable MP4s from an item; one per original file.
  function playableFiles(meta) {
    var files = meta.files || [], groups = {}, order = [];
    files.forEach(function (f) {
      if (!/\.(mp4|m4v)$/i.test(f.name)) return;
      if (/sample|trailer/i.test(f.name) && files.length > 4) return;
      var key = f.original || f.name.replace(/(\.ia)?(_512kb)?\.(mp4|m4v)$/i, '');
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(f);
    });
    function score(f) {
      var w = parseInt(f.width || 0, 10), s = 0;
      if (/h\.264/i.test(f.format || '')) s += 3;
      if (w && w <= 1280) s += 2; else if (w > 1280) s -= 2;
      if (/512kb/i.test(f.name)) s -= 1;
      return s;
    }
    var out = order.map(function (k) { return groups[k].sort(function (a, b) { return score(b) - score(a); })[0]; });
    out.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
    return out;
  }
  function prettyName(n) {
    return n.replace(/^.*\//, '').replace(/(\.ia)?(_512kb)?\.(mp4|m4v)$/i, '').replace(/[._]+/g, ' ').trim();
  }
  function openArchiveItem(it, push) {
    mode = 'show';
    show('lib');
    $('hdr').textContent = 'Internet Archive';
    $('poster').src = thumb(it.id);
    $('title').textContent = it.title; $('meta').textContent = 'Loading\u2026'; $('resume').textContent = ''; $('dots').textContent = '';
    if (push) history.pushState({ screen: 'show', archive: it.id, title: it.title }, '');
    fetch(IA + '/metadata/' + encodeURIComponent(it.id)).then(function (r) { return r.json(); }).then(function (meta) {
      var title = (meta.metadata && meta.metadata.title) || it.title;
      var vids = playableFiles(meta);
      if (!vids.length) { $('meta').textContent = 'No playable video in this item'; return; }
      var base = IA + '/download/' + encodeURIComponent(it.id) + '/';
      currentShow = {
        id: it.id, title: title, img: thumb(it.id), archive: true,
        eps: vids.map(function (f, n) {
          return { id: it.id + '/' + f.name, n: n + 1, title: vids.length === 1 ? title : prettyName(f.name), len: Math.round(parseFloat(f.length) || 0),
            u: base + f.name.split('/').map(encodeURIComponent).join('/') };
        })
      };
      rememberArchive({ id: it.id, title: title });
      var last = positions()['last_' + it.id];
      epIdx = last != null && last < currentShow.eps.length ? last : 0;
      if (mode === 'show') renderShow();
    }).catch(function () { $('meta').textContent = 'Could not load this item'; });
  }

  function openSearch() {
    mode = 'search';
    history.pushState({ screen: 'search' }, '');
    show('searchScreen');
    var q = $('q'); q.value = ''; q.focus();
  }
  function runSearch() {
    var v = $('q').value.trim();
    if (!v) return;
    var q = '(' + v.replace(/[()"]/g, ' ') + ') AND mediatype:movies';
    history.replaceState({ screen: 'browse' }, '');
    startBrowse('Search: ' + v, q, false);
  }
  $('q').addEventListener('change', function () { if (mode === 'search') runSearch(); });

  // ---------- Show / item picker ----------
  function renderShow() {
    mode = 'show';
    var ep = currentShow.eps[epIdx], p = positions();
    $('hdr').textContent = currentShow.title;
    $('poster').src = currentShow.img || ('media/' + currentShow.id + '.jpg');
    $('title').textContent = ep.title;
    var bits = [];
    if (ep.s) bits.push('Season ' + ep.s, 'Episode ' + ep.e);
    else if (currentShow.eps.length > 1) bits.push('Part ' + ep.n);
    if (ep.len) bits.push(mins(ep.len));
    $('meta').textContent = bits.join(' \u00b7 ') || 'Pinch to play';
    $('resume').textContent = p[ep.id] ? 'Resume at ' + fmt(p[ep.id]) : (p['done_' + ep.id] ? 'Watched' : 'Pinch to play');
    $('dots').textContent = currentShow.eps.length > 1 ? (epIdx + 1) + ' of ' + currentShow.eps.length : '';
    $('hint').textContent = currentShow.eps.length > 1 ? 'Swipe left/right to choose \u00b7 pinch to play' : 'Pinch to play \u00b7 swipe back to return';
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
    var eps = currentShow.eps; if (!eps[epIdx].s) return false;
    var s = eps[epIdx].s + dir;
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
    var d = vid.duration || current.len || 0;
    $('cur').textContent = fmt(vid.currentTime);
    $('dur').textContent = fmt(d);
    $('fill').style.width = d ? (100 * (vid.currentTime / d)) + '%' : '0';
    if (!vid.seeking && vid.readyState >= 2) $('state').textContent = vid.paused ? 'Paused' : '';
  }
  function play(item, push) {
    current = item;
    mode = 'player';
    $('ptitle').textContent = item.s ? 'S' + item.s + ' E' + item.e + ' \u00b7 ' + item.title : item.title;
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
    if (currentShow && current && epIdx < currentShow.eps.length - 1) {
      epIdx++; toast('Up next'); savePos();
      setTimeout(function () { play(currentShow.eps[epIdx], false); }, 1200);
    } else { toast('The End'); setTimeout(function () { history.back(); }, 1500); }
  });
  setInterval(function () { if (current && !vid.paused) savePos(); }, 10000);

  function renderCredits() {
    $('creditList').innerHTML =
      '<p>Public domain films and TV, plus Pioneer One (Creative Commons, by Josh Bernhard and Bracey Smith). Streamed from the Internet Archive (archive.org).</p>' +
      '<p style="margin-top:12px">' + LIB.map(function (f) { return esc(f.title) + ' (' + f.year + ')'; }).join(' \u00b7 ') + '</p>';
  }

  // ---------- Navigation ----------
  window.addEventListener('popstate', function (e) {
    var s = e.state || { screen: 'home' };
    if (current) stopVideo();
    if (s.screen === 'show' && s.archive) { if (currentShow && currentShow.id === s.archive) renderShow(); else openArchiveItem({ id: s.archive, title: s.title }, false); }
    else if (s.screen === 'show') { currentShow = BY[s.id]; renderShow(); }
    else if (s.screen === 'browse' && browse) { currentShow = null; mode = 'browse'; renderBrowse(); }
    else if (s.screen === 'player' || s.screen === 'search') { history.back(); }
    else { currentShow = null; renderHome(); }
  });

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (mode === 'search') {
      if (k === 'Enter') { if ($('q').value.trim()) { e.preventDefault(); runSearch(); } else { $('q').focus(); } }
      else if (k === 'Escape') { e.preventDefault(); history.back(); }
      return;
    }
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
    if (mode === 'browse') {
      var n = browse.items.length;
      if (k === 'ArrowRight' && n) browse.idx = Math.min(n - 1, browse.idx + 1);
      else if (k === 'ArrowLeft' && n) browse.idx = Math.max(0, browse.idx - 1);
      else if (k === 'ArrowDown' && n) browse.idx = Math.min(n - 1, browse.idx + 10);
      else if (k === 'ArrowUp' && n) browse.idx = Math.max(0, browse.idx - 10);
      else if (k === 'Enter' && n) { e.preventDefault(); openArchiveItem(browse.items[browse.idx], true); return; }
      else if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); history.back(); return; }
      else return;
      renderBrowse(); e.preventDefault(); return;
    }
    if (mode === 'show') {
      if (!currentShow) { if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); history.back(); } return; }
      var m = currentShow.eps.length;
      if (k === 'ArrowRight') epIdx = (epIdx + 1) % m;
      else if (k === 'ArrowLeft') epIdx = (epIdx - 1 + m) % m;
      else if (k === 'ArrowDown') { if (!seasonJump(1)) epIdx = Math.min(m - 1, epIdx + 10); }
      else if (k === 'ArrowUp') { if (!seasonJump(-1)) epIdx = Math.max(0, epIdx - 10); }
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
      else if (it.search) openSearch();
      else if (it.collection) startBrowse(it.title, 'collection:' + it.id + ' AND mediatype:movies', true);
      else if (it.archive) { currentShow = null; openArchiveItem(it, true); }
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
