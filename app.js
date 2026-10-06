(function () {
  var LIB = window.LIBRARY;
  var KEY = 'gc_positions_v2';
  var $ = function (id) { return document.getElementById(id); };
  var vid = $('vid');
  var homeIdx = 0, epIdx = 0, mode = 'home';   // mode: home | show | player | credits
  var current = null, currentShow = null, hudTimer = null, toastTimer = null;

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
    store(p);
  }

  function show(screen) {
    ['lib', 'player', 'creditsScreen'].forEach(function (s) { $(s).classList.toggle('on', s === screen); });
  }

  function renderHome() {
    mode = 'home';
    var it = LIB[homeIdx], p = positions();
    $('hdr').textContent = 'Glasses Cinema';
    $('poster').src = 'media/' + it.id + '.jpg';
    $('poster').alt = it.title;
    $('title').textContent = it.title;
    if (it.show) {
      $('meta').textContent = 'TV \u00b7 ' + it.eps.length + ' episodes';
      var last = p['last_' + it.id];
      $('resume').textContent = last != null ? 'Continue S' + it.eps[last].s + ' E' + it.eps[last].e : '';
    } else {
      $('meta').textContent = it.year + ' \u00b7 ' + mins(it.len);
      $('resume').textContent = p[it.id] ? 'Resume at ' + fmt(p[it.id]) : '';
    }
    $('dots').textContent = (homeIdx + 1) + ' of ' + LIB.length;
    $('hint').textContent = 'Swipe to browse \u00b7 pinch to ' + (it.show ? 'open' : 'play') + ' \u00b7 swipe down for credits';
    show('lib');
    $('card').focus();
  }

  function renderShow() {
    mode = 'show';
    var ep = currentShow.eps[epIdx], p = positions();
    $('hdr').textContent = currentShow.title;
    $('poster').src = 'media/' + currentShow.id + '.jpg';
    $('poster').alt = currentShow.title;
    $('title').textContent = ep.title;
    $('meta').textContent = 'Season ' + ep.s + ' \u00b7 Episode ' + ep.e + ' \u00b7 ' + mins(ep.len);
    $('resume').textContent = p[ep.id] ? 'Resume at ' + fmt(p[ep.id]) : (p['done_' + ep.id] ? 'Watched' : '');
    $('dots').textContent = (epIdx + 1) + ' of ' + currentShow.eps.length;
    $('hint').textContent = 'Swipe left/right for episodes \u00b7 up/down for seasons';
    show('lib');
    $('card').focus();
  }

  function openShow(push) {
    currentShow = LIB[homeIdx];
    var last = positions()['last_' + currentShow.id];
    epIdx = last != null ? last : 0;
    if (push) history.pushState({ screen: 'show', homeIdx: homeIdx }, '');
    renderShow();
  }

  function renderCredits() {
    $('creditList').innerHTML =
      '<p>Public domain and Creative Commons films and TV episodes (Pioneer One by Bracey Smith and Josh Bernhard, CC license via VODO), streamed from the Internet Archive (archive.org).</p>' +
      '<p style="margin-top:12px">' + LIB.map(function (f) { return f.title + ' (' + f.year + ')'; }).join(' \u00b7 ') + '</p>';
  }

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

  function activate() {
    if (mode === 'home') { var it = LIB[homeIdx]; if (it.show) openShow(true); else { currentShow = null; play(it, true); } }
    else if (mode === 'show') play(currentShow.eps[epIdx], true);
  }
  $('card').addEventListener('click', activate);
  $('closeCredits').addEventListener('click', function () { history.back(); });

  window.addEventListener('popstate', function (e) {
    var s = e.state || { screen: 'home' };
    if (current) stopVideo();
    if (s.screen === 'show') { homeIdx = s.homeIdx || homeIdx; currentShow = LIB[homeIdx]; renderShow(); }
    else if (s.screen === 'player') { history.back(); }
    else { currentShow = null; renderHome(); }
  });

  function seasonJump(dir) {
    var eps = currentShow.eps, s = eps[epIdx].s + dir;
    for (var i = 0; i < eps.length; i++) if (eps[i].s === s) { epIdx = i; return true; }
    return false;
  }

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
      else if (k === "ArrowDown") { if (!seasonJump(1)) epIdx = 0; }
      else if (k === 'ArrowUp') { if (!seasonJump(-1)) epIdx = 0; }
      else if (k === 'Enter') { activate(); e.preventDefault(); return; }
      else if (k === 'Escape' || k === 'Backspace') { history.back(); e.preventDefault(); return; }
      else return;
      renderShow(); e.preventDefault(); return;
    }
    // home
    if (k === 'ArrowRight') { homeIdx = (homeIdx + 1) % LIB.length; renderHome(); }
    else if (k === 'ArrowLeft') { homeIdx = (homeIdx - 1 + LIB.length) % LIB.length; renderHome(); }
    else if (k === 'ArrowDown') { mode = 'credits'; show('creditsScreen'); history.pushState({ screen: 'credits' }, ''); $('closeCredits').focus(); }
    else if (k === 'Enter') { activate(); }
    else return;
    e.preventDefault();
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
