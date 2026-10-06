(function () {
  var FILMS = [
    { id: 'bbb', title: 'Big Buck Bunny', year: 2008, len: 596 },
    { id: 'sintel', title: 'Sintel', year: 2010, len: 888 },
    { id: 'tos', title: 'Tears of Steel', year: 2012, len: 734 },
    { id: 'ed', title: 'Elephants Dream', year: 2006, len: 654 },
    { id: 'cosmos', title: 'Cosmos Laundromat', year: 2015, len: 731 },
    { id: 'spring', title: 'Spring', year: 2019, len: 464 },
    { id: 'agent327', title: 'Agent 327: Operation Barbershop', year: 2017, len: 232 },
    { id: 'caminandes', title: 'Caminandes: Llamigos', year: 2016, len: 150 }
  ];
  var KEY = 'gc_positions';
  var idx = 0, current = null, hudTimer = null, toastTimer = null;
  var $ = function (id) { return document.getElementById(id); };
  var vid = $('vid');

  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function positions() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function savePos() {
    if (!current) return;
    var p = positions();
    var t = vid.currentTime || 0;
    if (vid.duration && t > vid.duration - 15) delete p[current.id]; else p[current.id] = Math.floor(t);
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
  }

  function show(screen) {
    ['lib', 'player', 'creditsScreen'].forEach(function (s) { $(s).classList.toggle('on', s === screen); });
  }

  function renderCard() {
    var f = FILMS[idx];
    $('poster').src = 'media/' + f.id + '.jpg';
    $('poster').alt = f.title;
    $('title').textContent = f.title;
    $('meta').textContent = f.year + ' \u00b7 ' + Math.round(f.len / 60) + ' min';
    var p = positions()[f.id];
    $('resume').textContent = p ? 'Resume at ' + fmt(p) : '';
    $('dots').textContent = (idx + 1) + ' of ' + FILMS.length;
    $('card').focus();
  }

  function renderCredits() {
    $('creditList').innerHTML = FILMS.map(function (f) {
      return f.title + ' (' + f.year + ')';
    }).join(' \u00b7 ') +
      '<p style="margin-top:14px">Open movies by the Blender Foundation and Blender Studio, released under Creative Commons licenses. studio.blender.org. Re-encoded at low resolution for display glasses; no other changes.</p>';
  }

  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = 0; }, 800);
  }
  function pokeHud() {
    $('hud').classList.remove('hide');
    clearTimeout(hudTimer);
    if (!vid.paused) hudTimer = setTimeout(function () { $('hud').classList.add('hide'); }, 3000);
  }
  function updateHud() {
    $('cur').textContent = fmt(vid.currentTime);
    $('dur').textContent = fmt(vid.duration || current.len);
    var d = vid.duration || current.len;
    $('fill').style.width = (100 * (vid.currentTime / d)) + '%';
    $('state').textContent = vid.paused ? 'Paused' : '';
  }

  function openFilm(push) {
    current = FILMS[idx];
    $('ptitle').textContent = current.title;
    vid.src = 'media/' + current.id + '.mp4';
    var start = positions()[current.id] || 0;
    vid.addEventListener('loadedmetadata', function once() {
      vid.removeEventListener('loadedmetadata', once);
      if (start) vid.currentTime = start;
    });
    show('player');
    if (push) history.pushState({ screen: 'player', idx: idx }, '');
    var pr = vid.play();
    if (pr && pr.catch) pr.catch(function () { updateHud(); pokeHud(); });
    pokeHud();
    updateHud();
  }
  function closeFilm() {
    savePos();
    vid.pause();
    vid.removeAttribute('src');
    vid.load();
    current = null;
    show('lib');
    renderCard();
  }
  function openCredits() {
    show('creditsScreen');
    history.pushState({ screen: 'credits' }, '');
    $('closeCredits').focus();
  }

  vid.addEventListener('timeupdate', function () { updateHud(); });
  vid.addEventListener('pause', function () { updateHud(); pokeHud(); savePos(); });
  vid.addEventListener('play', function () { updateHud(); pokeHud(); });
  vid.addEventListener('waiting', function () { $('state').textContent = 'Loading\u2026'; });
  vid.addEventListener('ended', function () { savePos(); toast('The End'); setTimeout(function () { history.back(); }, 1500); });
  vid.addEventListener('error', function () { $('state').textContent = 'Could not load video'; pokeHud(); });
  setInterval(function () { if (current && !vid.paused) savePos(); }, 10000);

  $('card').addEventListener('click', function () { openFilm(true); });
  $('closeCredits').addEventListener('click', function () { history.back(); });

  window.addEventListener('popstate', function (e) {
    var s = e.state || { screen: 'home' };
    if (s.screen === 'player') { idx = s.idx || 0; openFilm(false); return; }
    if (current) closeFilm(); else { show('lib'); renderCard(); }
  });

  document.addEventListener('keydown', function (e) {
    var k = e.key;
    var onPlayer = $('player').classList.contains('on');
    var onCredits = $('creditsScreen').classList.contains('on');
    if (onPlayer) {
      if (k === 'Enter' || k === ' ') { if (vid.paused) vid.play(); else vid.pause(); toast(vid.paused ? '\u275a\u275a' : '\u25b6'); }
      else if (k === 'ArrowRight') { vid.currentTime = Math.min((vid.duration || 1e9) - 1, vid.currentTime + 30); toast('+30s'); }
      else if (k === 'ArrowLeft') { vid.currentTime = Math.max(0, vid.currentTime - 30); toast('\u221230s'); }
      else if (k === 'ArrowUp') { vid.muted = false; vid.volume = Math.min(1, Math.round((vid.volume + 0.1) * 10) / 10); toast('Vol ' + Math.round(vid.volume * 100)); }
      else if (k === 'ArrowDown') { vid.volume = Math.max(0, Math.round((vid.volume - 0.1) * 10) / 10); toast('Vol ' + Math.round(vid.volume * 100)); }
      else if (k === 'Escape' || k === 'Backspace') { history.back(); }
      else return;
      pokeHud();
      e.preventDefault();
      return;
    }
    if (onCredits) {
      if (k === 'Enter' || k === 'Escape' || k === 'Backspace') { history.back(); e.preventDefault(); }
      return;
    }
    if (k === 'ArrowRight' || k === 'ArrowUp') { idx = (idx + 1) % FILMS.length; renderCard(); }
    else if (k === 'ArrowLeft') { idx = (idx - 1 + FILMS.length) % FILMS.length; renderCard(); }
    else if (k === 'ArrowDown') { openCredits(); }
    else if (k === 'Enter') { openFilm(true); }
    else return;
    e.preventDefault();
  });

  function netState() { $('net').textContent = navigator.onLine ? '' : 'Offline'; }
  window.addEventListener('online', netState);
  window.addEventListener('offline', netState);

  history.replaceState({ screen: 'home' }, '');
  renderCredits();
  renderCard();
  netState();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
