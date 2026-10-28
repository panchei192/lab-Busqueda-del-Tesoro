/* ==========================================================================
   Tesoro del Sacré Coeur · lógica del juego (AR.js + A-Frame)
   --------------------------------------------------------------------------
   - 3 marcadores: pistas que se desbloquean en orden y un cofre final.
   - Progreso guardado en el navegador (si se recarga la página no se pierde).
   - Sonidos generados con WebAudio (sin archivos), vibración y confeti final.
   - Parámetros de URL útiles:  ?debug=1 (muestra qué marcador se ve)
                                ?reset=1 (borra el progreso al abrir)
   ========================================================================== */
(() => {
  'use strict';

  /* ======================================================================
     CONFIGURACIÓN · editá acá los textos y las pistas
     ⚠️ Las "next" (próxima pista) deben coincidir con los lugares donde
        pegues realmente los marcadores impresos.
     ====================================================================== */
  const CONFIG = {
    storageKey: 'sacre-coeur-ar-v1',
    enforceOrder: true, // true = hay que encontrar los marcadores en orden
    team: '',           // opcional: nombre del equipo, aparece en la pantalla final
    clues: [
      {
        badge: 'Inicio',
        title: 'El Pergamino del Guardián',
        story:
          'Hace más de cien años, en una noche de tormenta, el hermano Étienne, guardián del Sacré Coeur, ' +
          'escondió algo tan valioso que nunca se animó a decir qué era. Antes de desaparecer dejó este pergamino, ' +
          'cerrado con lacre rojo y una advertencia: «Solo quien reúna los tres sellos podrá abrir mi cofre». ' +
          'Desde entonces nadie lo logró… hasta hoy. El primer sello ya es tuyo.',
        next:
          'Buscá un marcador con una LLAVE dibujada. Pista: está en un lugar por donde pasa todo el mundo, ' +
          'entre un piso y otro.',
      },
      {
        badge: 'Sello 2',
        title: 'La Brújula y la Llave',
        story:
          'Esta brújula no apunta al norte: apunta al tesoro. El guardián la forjó con el oro de su propio anillo ' +
          'y escondió junto a ella la única llave capaz de abrir el cofre. Pero la llave sola no alcanza: ' +
          'la cerradura tiene forma de corazón y no cede sin el último sello. La aguja ya empezó a girar… seguila.',
        next:
          'Buscá un marcador con un CORAZÓN y una cruz. Pista: el Sacré Coeur es el “Sagrado Corazón”, ' +
          'y el último sello late en el corazón del edificio, donde se cruzan todos los caminos.',
      },
      {
        badge: 'Tesoro',
        title: '¡El Cofre del Guardián!',
        story:
          'La llave gira, el último sello encaja y el cofre cruje después de más de un siglo de silencio. ' +
          'Adentro brilla el oro del hermano Étienne… y una nota escrita a mano: «El verdadero tesoro nunca ' +
          'estuvo en este cofre, sino en quienes se animaron a buscarlo juntos». ¡La leyenda es tuya!',
        next: '',
      },
    ],
  };

  /* ====================================================================== */
  const $ = (sel) => document.querySelector(sel);
  const total = CONFIG.clues.length;
  const params = new URLSearchParams(location.search);

  /* ---------- Estado persistente ---------- */
  function freshState() {
    return { found: new Array(total).fill(false), startedAt: null, finishedAt: null };
  }
  function loadState() {
    if (params.get('reset')) {
      try { localStorage.removeItem(CONFIG.storageKey); } catch (e) { /* sin storage */ }
      return freshState();
    }
    try {
      const raw = JSON.parse(localStorage.getItem(CONFIG.storageKey) || 'null');
      if (raw && Array.isArray(raw.found) && raw.found.length === total) return raw;
    } catch (e) { /* storage no disponible o dañado */ }
    return freshState();
  }
  function saveState() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch (e) { /* ignorar */ }
  }
  let state = loadState();

  const foundCount = () => state.found.filter(Boolean).length;
  const isDone = () => foundCount() === total;
  const canUnlock = (i) =>
    !state.found[i] && (!CONFIG.enforceOrder || state.found.slice(0, i).every(Boolean));

  /* ---------- Sonido (WebAudio) ---------- */
  const Sfx = (() => {
    let ctx = null;
    let muted = false;
    function ensure() {
      if (!ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (C) ctx = new C();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function beep(freq, start, dur, type, vol) {
      const c = ensure();
      if (!c || muted) return;
      const t = c.currentTime + start;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
    return {
      unlock: ensure,
      toggle() { muted = !muted; return muted; },
      found() { [523.25, 659.25, 783.99].forEach((f, k) => beep(f, k * 0.11, 0.35, 'triangle', 0.18)); },
      locked() { beep(196, 0, 0.18, 'square', 0.07); beep(147, 0.16, 0.28, 'square', 0.07); },
      win() {
        [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, k) =>
          beep(f, k * 0.14, 0.45, 'triangle', 0.2));
      },
    };
  })();

  const vibrate = (pattern) => {
    try {
      // Chrome bloquea vibrate() hasta que el usuario toca la pantalla
      if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(pattern);
    } catch (e) { /* ignorar */ }
  };

  /* ---------- Utilidades de interfaz ---------- */
  const fmtTime = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  let toastTimer = null;
  function toast(msg, ms) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 3600);
  }

  function renderPips() {
    const wrap = $('#pips');
    wrap.innerHTML = '';
    state.found.forEach((ok) => {
      const pip = document.createElement('span');
      pip.className = 'pip' + (ok ? ' on' : '');
      wrap.appendChild(pip);
    });
  }

  function renderTimer() {
    const el = $('#timer');
    if (!state.startedAt) { el.textContent = '00:00'; return; }
    el.textContent = fmtTime((state.finishedAt || Date.now()) - state.startedAt);
  }

  function lastUnlockedIndex() {
    for (let i = total - 1; i >= 0; i--) if (state.found[i]) return i;
    return -1;
  }

  function showCard(i, revisit) {
    const c = CONFIG.clues[i];
    $('#card-badge').textContent = c.badge;
    $('#card-revisit').hidden = !revisit;
    $('#card-title').textContent = c.title;
    $('#card-story').textContent = c.story;
    $('#card-next').textContent = c.next;
    $('#card-next-wrap').hidden = !c.next;
    const card = $('#clue-card');
    card.hidden = false;
    // reiniciar la animación de entrada
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    $('#btn-clue').hidden = true;
  }
  function hideCard() {
    $('#clue-card').hidden = true;
    $('#btn-clue').hidden = lastUnlockedIndex() < 0;
  }

  /* ---------- Objetos 3D dinámicos ---------- */
  const contents = [];
  const locks = [];

  function el(tag, attrs, parent) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }

  function buildLock(markerEl) {
    const g = el('a-entity', { visible: 'false', position: '0 0 0' }, markerEl);
    const wobble = el('a-entity', {
      animation: 'property: rotation; from: 0 -10 0; to: 0 10 0; dir: alternate; dur: 500; easing: easeInOutSine; loop: true',
    }, g);
    el('a-box', { position: '0 0.25 0', width: '0.5', height: '0.4', depth: '0.22', color: '#b3202a', material: 'metalness: 0.4; roughness: 0.4' }, wobble);
    el('a-torus', { position: '0 0.45 0', radius: '0.14', 'radius-tubular': '0.04', arc: '180', color: '#c0c5cc', material: 'metalness: 0.8; roughness: 0.3', 'segments-tubular': '24' }, wobble);
    el('a-cylinder', { position: '0 0.26 0.115', rotation: '90 0 0', radius: '0.04', height: '0.02', color: '#1a1a1a' }, wobble);
    return g;
  }

  function buildCoinsAndSparkles() {
    const coins = $('#coins');
    for (let k = 0; k < 9; k++) {
      el('a-cylinder', {
        position: `${(Math.random() - 0.5) * 0.6} ${0.43 + Math.random() * 0.05} ${(Math.random() - 0.5) * 0.3}`,
        rotation: `${Math.random() * 40 - 20} ${Math.random() * 180} ${Math.random() * 40 - 20}`,
        radius: '0.085', height: '0.018', color: '#f7cf3d',
        material: 'metalness: 0.6; roughness: 0.3; emissive: #c99a12; emissiveIntensity: 0.9',
      }, coins);
    }
    const sp = $('#sparkles');
    for (let k = 0; k < 14; k++) {
      const x = ((Math.random() - 0.5) * 0.8).toFixed(2);
      const z = ((Math.random() - 0.5) * 0.4).toFixed(2);
      const dur = 1800 + Math.floor(Math.random() * 1600);
      const delay = Math.floor(Math.random() * 1500);
      el('a-octahedron', {
        position: `${x} 0.45 ${z}`,
        radius: '0.03',
        material: 'shader: flat; color: #fff2b0',
        animation__up: `property: position; from: ${x} 0.45 ${z}; to: ${x} 1.5 ${z}; dur: ${dur}; delay: ${delay}; easing: easeOutQuad; loop: true`,
        animation__fade: `property: scale; from: 1 1 1; to: 0 0 0; dur: ${dur}; delay: ${delay}; easing: easeInQuad; loop: true`,
      }, sp);
    }
  }

  function openChest(instant) {
    const lid = $('#chest-lid');
    if (instant) lid.setAttribute('rotation', '-110 0 0');
    else lid.emit('open-chest');
    $('#chest-beam').setAttribute('visible', true);
    $('#sparkles').setAttribute('visible', true);
  }

  /* ---------- Lógica de marcadores ---------- */
  const visible = new Array(total).fill(false);
  const lostTimer = new Array(total).fill(null);

  function revealContent(i) {
    contents[i].setAttribute('visible', true);
    locks[i].setAttribute('visible', false);
  }

  function unlock(i) {
    state.found[i] = true;
    if (!state.startedAt) state.startedAt = Date.now();
    const done = isDone();
    if (done) state.finishedAt = Date.now();
    saveState();

    revealContent(i);
    renderPips();
    renderTimer();
    vibrate([90, 50, 90]);

    if (done) {
      Sfx.found();
      openChest(false);
      hideCard();
      setTimeout(showFinale, 2800);
    } else {
      Sfx.found();
      showCard(i, false);
    }
  }

  function lockedFeedback(i) {
    contents[i].setAttribute('visible', false);
    locks[i].setAttribute('visible', true);
    Sfx.locked();
    vibrate(200);
    const got = foundCount();
    toast(got === 0
      ? '🔒 Primero tenés que encontrar el marcador de inicio de la leyenda.'
      : `🔒 Ese marcador todavía no. Releé la pista ${got} para ir al lugar correcto.`);
  }

  // El juego no avanza mientras la pantalla de inicio está abierta.
  let started = false;

  function onMarkerFound(i) {
    clearTimeout(lostTimer[i]);
    const wasVisible = visible[i];
    visible[i] = true;
    updateDebug();
    if (wasVisible) return; // parpadeo de detección: ignorar
    if (!started) return;   // se procesa recién cuando el jugador toca "Empezar"

    if (state.found[i]) {
      revealContent(i);
      if (isDone() && i === total - 1) openChest(true);
      if (i !== total - 1 || !isDone()) showCard(i, true);
      else toast('🏆 ¡Ya encontraste el tesoro!');
      return;
    }
    if (canUnlock(i)) unlock(i);
    else lockedFeedback(i);
  }

  function onMarkerLost(i) {
    clearTimeout(lostTimer[i]);
    lostTimer[i] = setTimeout(() => { visible[i] = false; updateDebug(); }, 1500);
  }

  /* ---------- Pantalla final ---------- */
  function showFinale() {
    $('#final-time').textContent = fmtTime((state.finishedAt || Date.now()) - (state.startedAt || Date.now()));
    if (CONFIG.team) {
      const t = $('#final-team');
      t.textContent = CONFIG.team;
      t.hidden = false;
    }
    $('#finale').hidden = false;
    Sfx.win();
    vibrate([120, 60, 120, 60, 240]);
    confetti(7000);
  }

  function confetti(ms) {
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    cv.width = window.innerWidth * dpr;
    cv.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#e0b84c', '#c8102e', '#2e8bff', '#3ddc97', '#ffffff', '#ff8c42'];
    const parts = Array.from({ length: 150 }, () => ({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight * 0.7,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 2 + Math.random() * 3.5,
      vx: -1.5 + Math.random() * 3,
      rot: Math.random() * 6.28,
      vr: -0.2 + Math.random() * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const end = performance.now() + ms;
    (function frame(t) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let alive = false;
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.y < window.innerHeight + 20) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive && t < end) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    })(performance.now());
  }

  /* ---------- Cámara ---------- */
  function showCamError(msg) {
    $('#cam-error-msg').textContent = msg;
    $('#cam-error').hidden = false;
  }
  function explainCameraError(err) {
    const name = err && err.error && err.error.name ? err.error.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
      return 'Bloqueaste el permiso de la cámara. Habilitalo en los ajustes del navegador (ícono del candado junto a la dirección) y tocá Reintentar.';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
      return 'No se encontró ninguna cámara en este dispositivo.';
    return 'Revisá que ninguna otra app esté usando la cámara. Si abriste el link desde WhatsApp, Instagram u otra app, abrilo en Chrome o Safari.';
  }

  /* ---------- Depuración ---------- */
  function updateDebug() {
    if (!params.get('debug')) return;
    const d = $('#debug');
    d.hidden = false;
    d.textContent =
      'visibles: ' + (visible.map((v, i) => (v ? i + 1 : null)).filter(Boolean).join(',') || '-') + '\n' +
      'desbloqueados: ' + state.found.map((v) => (v ? '✔' : '·')).join(' ');
  }

  /* ---------- Reinicio ---------- */
  function resetGame() {
    try { localStorage.removeItem(CONFIG.storageKey); } catch (e) { /* ignorar */ }
    const url = new URL(location.href);
    url.searchParams.delete('reset');
    location.href = url.toString();
  }

  /* ---------- Arranque ---------- */
  function init() {
    // enlazar cada <a-marker> con su contenido y su candado
    for (let i = 0; i < total; i++) {
      const marker = $('#marker-' + i);
      contents[i] = $('#content-' + i);
      locks[i] = buildLock(marker);
      marker.addEventListener('markerFound', () => onMarkerFound(i));
      marker.addEventListener('markerLost', () => onMarkerLost(i));
      if (state.found[i]) contents[i].setAttribute('visible', true);
    }
    buildCoinsAndSparkles();
    if (isDone()) openChest(true);

    renderPips();
    renderTimer();
    updateDebug();
    setInterval(renderTimer, 500);

    // Intro
    const got = foundCount();
    if (isDone()) {
      $('#intro-progress').textContent = '🏆 ¡Ya completaste la búsqueda! Podés volver a ver el cofre o jugar de nuevo.';
      $('#intro-progress').hidden = false;
      $('#btn-start').textContent = 'Ver el cofre';
      $('#btn-reset').textContent = 'Jugar de nuevo';
      $('#btn-reset').hidden = false;
    } else if (got > 0) {
      $('#intro-progress').textContent = `Tenés progreso guardado: ${got} de ${total} sellos.`;
      $('#intro-progress').hidden = false;
      $('#btn-start').textContent = 'Continuar';
      $('#btn-reset').hidden = false;
    }

    $('#btn-start').addEventListener('click', () => {
      Sfx.unlock();
      $('#intro').hidden = true;
      $('#hud').hidden = false;
      started = true;
      if (got === 0) toast('Apuntá la cámara al marcador de inicio 👀', 4500);
      else $('#btn-clue').hidden = lastUnlockedIndex() < 0;
      // si ya había un marcador frente a la cámara, procesarlo ahora
      visible.forEach((v, i) => { if (v) { visible[i] = false; onMarkerFound(i); } });
    });
    $('#btn-reset').addEventListener('click', resetGame);
    $('#btn-again').addEventListener('click', resetGame);
    $('#btn-keep').addEventListener('click', () => { $('#finale').hidden = true; });
    $('#card-close').addEventListener('click', hideCard);
    $('#btn-clue').addEventListener('click', () => {
      const i = lastUnlockedIndex();
      if (i >= 0) showCard(i, true);
    });
    $('#btn-sound').addEventListener('click', () => {
      $('#btn-sound').textContent = Sfx.toggle() ? '🔇' : '🔊';
    });
    $('#btn-retry').addEventListener('click', () => location.reload());

    // primer toque en cualquier lado = permiso de audio
    document.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });

    // errores de cámara
    const scene = $('a-scene');
    const onCamErr = (e) => showCamError(explainCameraError(e && e.detail));
    scene.addEventListener('camera-error', onCamErr);
    window.addEventListener('camera-error', onCamErr);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCamError('Este navegador no permite usar la cámara. Abrí el link con Chrome o Safari (la página debe estar en HTTPS).');
    }

    // utilidades para probar desde la consola del navegador
    window.__treasure = {
      state: () => JSON.parse(JSON.stringify(state)),
      visible: () => visible.slice(),
      reset: resetGame,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
