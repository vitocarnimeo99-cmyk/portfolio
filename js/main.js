// Menu hamburger (mobile): apre/chiude la tendina dei link. Si richiude
// toccando un link (utile per le ancore nella stessa pagina), toccando fuori
// dal menu o premendo Esc.
(function () {
  const header = document.querySelector('header');
  const toggle = header && header.querySelector('.nav-toggle');
  if (!toggle) return;

  const setOpen = (open) => {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
  };

  // Header fisso: si nasconde scorrendo verso il basso e ricompare
  // verso l'alto. Resta visibile in cima alla pagina, a menu aperto, con il
  // focus da tastiera (non quello lasciato da un tocco) al suo interno e durante lo scroll verso un'ancora del
  // menu (cosi' la sezione non parte coperta o con un buco sopra).
  let lastY = window.scrollY;
  let ticking = false;
  let keepVisibleUntil = 0;
  const updateHeader = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY);
    if (Math.abs(y - lastY) < 6) return;
    const goingDown = y > lastY;
    lastY = y;
    header.classList.toggle('is-hidden',
      goingDown && y > header.offsetHeight &&
      !header.classList.contains('is-open') &&
      !header.querySelector(':focus-visible') &&
      Date.now() > keepVisibleUntil);
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); }
  }, { passive: true });
  header.addEventListener('focusin', (e) => {
    if (e.target.matches(':focus-visible')) header.classList.remove('is-hidden');
  });

  toggle.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
  header.querySelectorAll('.navlinks a').forEach(a => a.addEventListener('click', () => {
    keepVisibleUntil = Date.now() + 1200;
    setOpen(false);
  }));
  document.addEventListener('click', (e) => {
    if (header.classList.contains('is-open') && !header.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
})();

// Header animato. Al passaggio del mouse il nome o il link prende un colore
// a caso (con la sottolineatura, in style.css). Nella home, quando il cartellino sbatte
// contro l'header (cartellino3d.js, evento cartellino-hit), un'onda di
// colore parte dal punto del colpo e corre per tutto l'header, più lontano
// quanto più il colpo è forte, e il bordo basso si accende da lì verso i
// lati; il sobbalzo della barra lo fa cartellino3d.js.
(function () {
  const header = document.querySelector('header');
  if (!header) return;
  const targets = Array.from(header.querySelectorAll('.brand, .navlinks a'));

  // I colori delle lettere del titolo: le lettere dell'header, sul fondo
  // chiaro, prendono il tono pieno; il bordo che si accende, sull'hero
  // scuro, quello schiarito che usa il titolo
  const palette = [['#3B4B99', '#727DB6'], ['#6163C6', '#7476CD'], ['#3F6B3D', '#658964'],
    ['#D8322A', '#DD4B44'], ['#2347C4', '#617BD5'], ['#5A2AA0', '#9272C0'], ['#9A6229', '#A67543'],
    ['#E32227', '#E74145'], ['#00579C', '#4283B6'], ['#4F9A16', '#4F9A16'], ['#E8B400', '#F5C400']];
  let lastColor = null;
  const randomColor = () => {
    let color;
    do { color = palette[Math.floor(Math.random() * palette.length)]; } while (color === lastColor);
    lastColor = color;
    return color;
  };

  // Il colore al passaggio del mouse, nuovo ogni volta
  for (const el of targets) {
    el.addEventListener('mouseenter', () => el.style.setProperty('--hover-color', randomColor()[0]));
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Lettere in span .ch dentro parole .w che non vanno a capo, come nel titolo
  for (const el of targets) {
    const label = el.textContent.trim();
    el.setAttribute('aria-label', label);
    el.textContent = '';
    for (const part of label.split(/(\s+)/)) {
      if (/\s/.test(part)) { el.appendChild(document.createTextNode(' ')); continue; }
      const word = document.createElement('span');
      word.className = 'w';
      word.setAttribute('aria-hidden', 'true');
      for (const ch of part) {
        const span = document.createElement('span');
        span.className = 'ch';
        span.textContent = ch;
        word.appendChild(span);
      }
      el.appendChild(word);
    }
  }
  const letters = Array.from(header.querySelectorAll('.ch'));
  const toggle = header.querySelector('.nav-toggle');

  // Ogni elemento si colora in ritardo quanto più è lontano da x (px dal
  // bordo della finestra), speed in px/ms, e solo fin dove arriva l'onda:
  // amp·e^(-distanza/reach) deve restare almeno 0,6. Si saltano quelli
  // nascosti, come i link della tendina su telefono, che stanno sotto l'header.
  const wave = (items, x, { amp, reach, speed, color }) => {
    const bottom = header.getBoundingClientRect().bottom;
    const moving = [];
    for (const el of items) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.top >= bottom) continue;
      const d = Math.abs(r.left + r.width / 2 - x);
      const a = amp * Math.exp(-d / reach);
      if (a < 0.6) continue;
      el.style.setProperty('--delay', Math.round(d / speed) + 'ms');
      el.style.setProperty('--wave-color', color);
      el.classList.remove('is-tint');
      moving.push(el);
    }
    void header.offsetWidth; // fa ripartire l'animazione
    for (const el of moving) el.classList.add('is-tint');
  };
  header.addEventListener('animationend', (e) => {
    e.target.classList.remove(e.target === header ? 'is-hit' : 'is-tint');
  });

  // Il sobbalzo della barra al colpo lo fa cartellino3d.js: qui solo il colore
  header.addEventListener('cartellino-hit', (e) => {
    const { x, strength } = e.detail;
    const [color, glow] = randomColor();
    wave(toggle ? [...letters, toggle] : letters, x, {
      amp: Math.min(5 + strength * 1.2, 18),
      reach: 260 + strength * 40,
      speed: 1.1,
      color
    });
    header.style.setProperty('--hit-x', Math.round(x - header.getBoundingClientRect().left) + 'px');
    header.style.setProperty('--hit-color', glow);
    header.classList.remove('is-hit');
    void header.offsetWidth;
    header.classList.add('is-hit');
  });
})();

// Protezione immagini: niente menu del tasto destro (o pressione lunga su
// Android) né trascinamento su immagini, video e canvas, anche quando sono
// coperti da un livello sopra. Il menu resta normale sul resto della pagina e
// sui link di download (CV e portfolio). Ai video si toglie "Scarica" dai
// controlli e Cmd/Ctrl+S non salva la pagina con le immagini.
(function () {
  const MEDIA = 'img, picture, video, canvas, svg image';
  const isMedia = (el) => el instanceof Element && (el.matches(MEDIA) ||
    /url\(/.test(getComputedStyle(el).backgroundImage));
  const overMedia = (e) => {
    if (e.target instanceof Element && e.target.closest('a[download]')) return false;
    const stack = e.clientX || e.clientY
      ? document.elementsFromPoint(e.clientX, e.clientY)
      : [e.target];
    return stack.some(isMedia);
  };

  document.addEventListener('contextmenu', (e) => {
    if (overMedia(e)) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => {
    if (e.target instanceof Element && e.target.matches(MEDIA)) e.preventDefault();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') e.preventDefault();
  });
  document.querySelectorAll('video').forEach((v) => {
    v.setAttribute('controlsList', 'nodownload');
    v.disablePictureInPicture = true;
  });
})();

// Autoplay solo quando il video è visibile in viewport: senza questo, tutti
// i video della griglia partirebbero insieme al caricamento della pagina
// anche se fuori schermo, sprecando banda e CPU. In pausa quando escono.
const lazyVideos = document.querySelectorAll('video.art');
if ('IntersectionObserver' in window) {
  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.25 });

  lazyVideos.forEach(video => videoObserver.observe(video));
} else {
  lazyVideos.forEach(video => video.play().catch(() => {}));
}

// Rivelazione a cascata dei tile della griglia progetti (e dello sticker) quando entrano in
// viewport, per dare un effetto più dinamico allo scroll.
const gridTiles = document.querySelectorAll('.grid .tile, .sticker-card');
if (gridTiles.length) {
  if ('IntersectionObserver' in window) {
    const tileObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const tile = entry.target;
        const index = Array.from(gridTiles).indexOf(tile);
        tile.style.transitionDelay = `${(index % 3) * 90}ms`;
        tile.classList.add('is-visible');
        obs.unobserve(tile);
      });
    }, { threshold: 0.15 });
    gridTiles.forEach(tile => tileObserver.observe(tile));
  } else {
    gridTiles.forEach(tile => tile.classList.add('is-visible'));
  }
}

document.querySelectorAll('.zoom-tile').forEach(tile => {
  const img = tile.querySelector('.art');
  tile.addEventListener('mousemove', (e) => {
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
  });
});

// Tilt 3D delle card progetto in home (e dello sticker nei contatti), come la copertina di K-Way: la card
// si inclina verso il cursore e il riflesso lucido lo segue. Interpolazione
// con requestAnimationFrame, che si ferma da sola quando la card è ferma.
if (window.matchMedia('(hover: hover)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Anche i loghi della formazione: lì il riquadro stesso è la "card"
  document.querySelectorAll('.grid .tile, .sticker-card, .edu-logo').forEach(tile => {
    const frame = tile.matches('.edu-logo') ? tile : tile.querySelector('.tile-frame, .sticker-frame');
    if (!frame) return;
    const maxTilt = tile.matches('.edu-logo') ? 12 : 7;
    const current = { rx: 0, ry: 0, tz: 0, gx: 50, gy: 30 };
    const target = { rx: 0, ry: 0, tz: 0, gx: 50, gy: 30 };
    let rect = null;
    let rafId = null;

    const tick = () => {
      let delta = 0;
      for (const key in current) {
        const next = current[key] + (target[key] - current[key]) * 0.14;
        delta += Math.abs(next - current[key]);
        current[key] = next;
      }
      frame.style.setProperty('--rx', current.rx.toFixed(2) + 'deg');
      frame.style.setProperty('--ry', current.ry.toFixed(2) + 'deg');
      frame.style.setProperty('--tz', current.tz.toFixed(1) + 'px');
      frame.style.setProperty('--gx', current.gx.toFixed(1) + '%');
      frame.style.setProperty('--gy', current.gy.toFixed(1) + '%');
      rafId = delta > 0.02 ? requestAnimationFrame(tick) : null;
    };
    const start = () => { if (rafId === null) rafId = requestAnimationFrame(tick); };

    tile.addEventListener('mouseenter', () => {
      rect = frame.getBoundingClientRect();
      target.tz = 18;
      start();
    });
    tile.addEventListener('mousemove', (e) => {
      if (!rect) rect = frame.getBoundingClientRect();
      const px = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      const py = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
      target.rx = (0.5 - py) * maxTilt * 2;
      target.ry = (px - 0.5) * maxTilt * 2;
      target.gx = px * 100;
      target.gy = py * 100;
      start();
    });
    tile.addEventListener('mouseleave', () => {
      rect = null;
      Object.assign(target, { rx: 0, ry: 0, tz: 0 });
      start();
    });
  });
}

// Dispositivi senza mouse (telefoni, tablet): lì mouseover/mouseout vengono
// simulati al tocco, subito prima di aprire il link, quindi gli effetti al
// passaggio del mouse non si vedrebbero mai (o resterebbero "incollati").
const canHover = window.matchMedia('(hover: hover)').matches;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Video con variante al passaggio del mouse (es. "I Contadini").
// La variante è un secondo video sovrapposto, già caricato, che compare in
// hover: niente load() a ogni passaggio, che ricaricava il video da capo e
// faceva andare a scatti la card.
// Su touch resta il video di default: lo scambio scaricherebbe un secondo
// video proprio mentre si sta aprendo la pagina del progetto.
if (canHover) document.querySelectorAll('video[data-src-hover]').forEach(video => {
  const tile = video.closest('.tile') || video;
  const layer = document.createElement('video');
  layer.className = 'art cycle-fade';
  layer.muted = true;
  layer.loop = true;
  layer.playsInline = true;
  layer.preload = 'none';
  layer.setAttribute('aria-hidden', 'true');
  video.after(layer);
  // scaricata dopo il caricamento della pagina, per non rubare banda all'avvio,
  // e solo quando la card si avvicina allo schermo
  window.addEventListener('load', () => {
    const fetchLayer = () => {
      if (layer.src) return;
      layer.preload = 'auto';
      layer.src = video.dataset.srcHover;
    };
    if (!('IntersectionObserver' in window)) { fetchLayer(); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      fetchLayer();
    }, { rootMargin: '400px 0px' });
    io.observe(tile);
  });

  tile.addEventListener('mouseenter', () => {
    if (!layer.src) layer.src = video.dataset.srcHover;
    layer.play().then(() => { layer.style.opacity = '1'; }).catch(() => {});
  });
  tile.addEventListener('mouseleave', () => {
    layer.style.opacity = '0';
    layer.pause();
  });
});

// Immagini con variante ciclica al passaggio del mouse (es. "Shallo", "K-Way").
// data-cycle-prefix/ext compongono il path, data-cycle-frames è il numero
// totale di file (01 = default, gli altri sono le varianti in hover).
document.querySelectorAll('img[data-cycle-prefix]').forEach(img => {
  const prefix = img.dataset.cyclePrefix;
  const ext = img.dataset.cycleExt;
  const variants = parseInt(img.dataset.cycleFrames, 10) - 1;
  const defaultSrc = img.src;
  let step = 0;

  if (canHover) {
    // L'immagine viene scambiata solo quando è già decodificata: cambiare
    // src al volo costringeva il browser a decodificarla durante l'hover,
    // con un piccolo blocco dell'animazione.
    let hovering = false;
    img.addEventListener('mouseover', () => {
      hovering = true;
      step = (step % variants) + 1;
      const src = `${prefix}${step + 1}${ext}`;
      const next = new Image();
      next.src = src;
      next.decode().catch(() => {}).then(() => {
        if (hovering && img.dataset.cycleWant === src) img.src = src;
      });
      img.dataset.cycleWant = src;
    });
    img.addEventListener('mouseout', () => {
      hovering = false;
      step = 0;
      img.dataset.cycleWant = '';
      img.src = defaultSrc;
    });
    return;
  }

  // Su touch le varianti scorrono da sole finché il tile è visibile a schermo,
  // e si fermano (tornando alla prima) quando esce. Il cambio è una
  // dissolvenza: la nuova immagine compare sopra in un livello che sfuma,
  // poi diventa la base e il livello torna trasparente.
  if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
  const frames = variants + 1;
  const FADE_MS = 1200;
  const layer = document.createElement('img');
  layer.className = 'art cycle-fade';
  layer.alt = '';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.transition = `opacity ${FADE_MS}ms ease-in-out`;
  img.after(layer);

  let timer = null;
  let fadeTimer = null;
  const showNext = () => {
    step = (step + 1) % frames;
    const next = `${prefix}${step + 1}${ext}`;
    layer.src = next;
    layer.decode().catch(() => {}).then(() => {
      if (!timer) return;
      layer.style.opacity = '1';
      fadeTimer = setTimeout(() => {
        img.src = next;
        img.decode().catch(() => {}).then(() => {
          layer.style.transition = 'none';
          layer.style.opacity = '0';
          layer.offsetWidth; // applica subito l'opacità prima di riattivare la transizione
          layer.style.transition = `opacity ${FADE_MS}ms ease-in-out`;
        });
      }, FADE_MS);
    });
  };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !timer) {
      timer = setInterval(showNext, 3000);
    } else if (!entry.isIntersecting && timer) {
      clearInterval(timer);
      clearTimeout(fadeTimer);
      timer = null;
      step = 0;
      layer.style.transition = 'none';
      layer.style.opacity = '0';
      layer.offsetWidth;
      layer.style.transition = `opacity ${FADE_MS}ms ease-in-out`;
      img.src = defaultSrc;
    }
  }, { threshold: 0.5 }).observe(img);
});

// Precarica e decodifica le varianti hover dei tile a ciclo immagini, cosi'
// il primo mouseover non ha né attesa di rete né blocco per la decodifica.
// Solo con il mouse (su touch le varianti scorrono una alla volta e si
// caricano mentre girano) e solo per i tile vicini allo schermo: tutte
// insieme al load erano diversi MB scaricati anche per card mai viste.
// Le immagini restano in preloadedFrames perché il browser non butti via la
// versione già decodificata.
const preloadedFrames = [];
if (canHover) window.addEventListener('load', () => {
  const preload = (img) => {
    const prefix = img.dataset.cyclePrefix;
    const ext = img.dataset.cycleExt;
    const frames = parseInt(img.dataset.cycleFrames, 10);
    for (let i = 2; i <= frames; i++) {
      const frame = new Image();
      frame.src = `${prefix}${i}${ext}`;
      frame.decode().catch(() => {});
      preloadedFrames.push(frame);
    }
  };
  const imgs = document.querySelectorAll('img[data-cycle-prefix]');
  if (!('IntersectionObserver' in window)) { imgs.forEach(preload); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      preload(entry.target);
    });
  }, { rootMargin: '400px 0px' });
  imgs.forEach(img => io.observe(img));
});

// Le scene 3D (cartellino in home, pillow pack nelle pagine progetto) richiedono
// Three.js (~600KB): lo carichiamo solo quando il relativo elemento entra in
// viewport invece che sempre in testa alla pagina, cosi' non compete con le
// risorse critiche del caricamento iniziale. threePromise evita di iniettare
// Three.js due volte se una pagina avesse più scene.
(function () {
  function supportsWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  let threePromise = null;
  function loadThree() {
    if (!threePromise) {
      threePromise = new Promise((resolve) => {
        const three = document.createElement('script');
        three.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
        three.onload = resolve;
        document.body.appendChild(three);
      });
    }
    return threePromise;
  }

  function loadScene(elementId, sceneScriptSrc) {
    const el = document.getElementById(elementId);
    if (!el || !supportsWebGL()) return;

    function start() {
      loadThree().then(() => {
        const sceneScript = document.createElement('script');
        sceneScript.src = sceneScriptSrc;
        document.body.appendChild(sceneScript);
      });
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        if (entries.some(entry => entry.isIntersecting)) {
          obs.disconnect();
          start();
        }
      }, { rootMargin: '200px' });
      observer.observe(el);
    } else {
      start();
    }
  }

  loadScene('lanyard', 'js/cartellino3d.js');
  loadScene('wkz-pack', 'js/pillowpack3d.js');
})();

// Aereo di carta nella hero: ogni tanto entra da sotto a sinistra ed esce in
// alto a destra, ondeggiando, con il muso che segue la traiettoria. Ogni volo
// è un po' diverso (altezza, onde) e vola solo con l'hero a schermo e la
// scheda in primo piano; con "riduci movimento" non c'è (style.css).
(function () {
  const plane = document.querySelector('.hero-plane');
  if (!plane || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = plane.closest('.hero');
  // Dove punta il muso nell'immagine, in gradi (0 = verso destra)
  const HEADING = -50;
  let inView = true;
  let flying = false;
  let timer = null;

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(fly, ms);
  }

  function fly() {
    timer = null;
    if (!inView || document.hidden) return;
    flying = true;
    const W = hero.clientWidth;
    const H = hero.clientHeight;
    const w = plane.offsetWidth;
    const h = plane.offsetHeight;
    const x0 = -w * 1.5;
    const x1 = W + w * 0.5;
    const y0 = H * (0.65 + Math.random() * 0.25);
    const y1 = H * (0.05 + Math.random() * 0.2) - h;
    const amp = Math.min(H * 0.06, 40) * (0.6 + Math.random() * 0.8);
    const waves = 1 + Math.random();
    const dur = Math.min(Math.max((x1 - x0) / 0.25, 4000), 8000);
    const point = (t) => [
      x0 + (x1 - x0) * t,
      y0 + (y1 - y0) * t + Math.sin(t * waves * 2 * Math.PI) * amp
    ];
    const start = performance.now();
    plane.classList.add('is-flying');

    function frame(now) {
      const t = Math.min((now - start) / dur, 1);
      const [x, y] = point(t);
      const [xa, ya] = point(t + 0.005);
      const angle = Math.atan2(ya - y, xa - x) * 180 / Math.PI;
      // Un piccolo dondolio, come una papera che si gira a guardare
      const rock = Math.sin(t * Math.PI * 6) * 4;
      plane.style.transform = `translate(${x}px, ${y}px) rotate(${angle - HEADING + rock}deg)`;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        flying = false;
        plane.classList.remove('is-flying');
        schedule(9000 + Math.random() * 8000);
      }
    }
    requestAnimationFrame(frame);
  }

  // Tornando sull'hero (o sulla scheda) riparte presto se era in attesa
  function resume() {
    if (inView && !document.hidden && !flying && !timer) schedule(1500);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries.some(e => e.isIntersecting);
      resume();
    }, { threshold: 0.3 }).observe(hero);
  }
  document.addEventListener('visibilitychange', resume);

  // Il primo volo dopo l'entrata del testo
  schedule(2500);
})();

// Cursori disegnati, solo con il mouse (style.css, .img-cursor): la matita in
// "Chi sono" e la moka in "Lavori", per prendersi il tempo di un caffè
// mentre si guardano i progetti. Il contenitore segue il mouse con la punta
// (la mina, il beccuccio) sotto il puntatore, dove resta il clic; il gesto
// al clic è sull'immagine dentro e fa perno lì. Scorrendo la pagina senza
// muovere il mouse la sezione passa sotto il puntatore: lì si ricontrolla
// cosa c'è sotto.
(function () {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  // tipX e tipY: la punta nell'immagine, in frazioni di larghezza e altezza
  function imgCursor({ section, name, src, width, height, tipX, tipY }) {
    if (!document.querySelector(section)) return;
    const cursor = document.createElement('span');
    cursor.className = `img-cursor ${name}-cursor`;
    cursor.setAttribute('aria-hidden', 'true');
    const img = new Image(width, height);
    img.src = src;
    img.alt = '';
    img.decoding = 'async';
    cursor.appendChild(img);
    document.body.appendChild(cursor);
    document.documentElement.classList.add(`has-${name}`);

    let x = -1;
    let y = -1;
    let on = false;
    let w = 0;
    let h = 0;
    const measure = () => { w = img.offsetWidth; h = img.offsetHeight; };
    measure();
    window.addEventListener('resize', measure);

    function toggle(target) {
      const inside = !!(target && target.closest && target.closest(section));
      if (inside === on) return;
      on = inside;
      cursor.classList.toggle('is-on', on);
      if (!on) cursor.classList.remove('is-pressed');
    }

    document.addEventListener('mousemove', (e) => {
      x = e.clientX;
      y = e.clientY;
      cursor.style.transform = `translate(${x - tipX * w}px, ${y - tipY * h}px)`;
      toggle(e.target);
    }, { passive: true });
    window.addEventListener('scroll', () => {
      if (x >= 0) toggle(document.elementFromPoint(x, y));
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => toggle(null));
    document.addEventListener('mousedown', () => { if (on) cursor.classList.add('is-pressed'); });
    document.addEventListener('mouseup', () => cursor.classList.remove('is-pressed'));
  }

  imgCursor({ section: '#about', name: 'pencil', src: 'assets/images/MATITA-260.webp',
    width: 214, height: 260, tipX: 0.0216, tipY: 0.9935 });
  imgCursor({ section: '#lavori', name: 'moka', src: 'assets/images/MOKA-260.webp',
    width: 202, height: 260, tipX: 0.0064, tipY: 0.3286 });
})();

// Palloncino di "In evidenza": sale dal basso fino a uscire in alto, come
// sfuggito di mano a un bambino. Prende velocità piano piano, dondola a
// destra e sinistra, il vento lo sposta un po' di lato e rimpicciolisce
// allontanandosi; il filo, legato al nodo del muso, penzola e resta indietro
// a ogni dondolio. Parte quando la sezione arriva a schermo, poi ripassa ogni
// tanto finché ci resta.
(function () {
  const sky = document.querySelector('.featured-sky');
  if (!sky || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const balloon = sky.querySelector('.featured-balloon');
  const string = sky.querySelector('.balloon-string path');
  // Il nodo nell'immagine, in frazioni di larghezza e altezza
  const KNOT_X = 0.914;
  const KNOT_Y = 0.27;
  let inView = false;
  let flying = false;
  let timer = null;

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(fly, ms);
  }

  function fly() {
    timer = null;
    if (!inView || document.hidden) return;
    flying = true;
    const W = sky.clientWidth;
    const H = sky.clientHeight;
    const bw = balloon.offsetWidth;
    const bh = balloon.offsetHeight;
    const len = bh * 1.3;
    const x0 = W * (0.1 + Math.random() * 0.7);
    const drift = W * (Math.random() - 0.5) * 0.3;
    const y0 = H + 20;
    const y1 = -bh - len - 20;
    const sway = 16 + Math.random() * 14;
    const period = 2400 + Math.random() * 800;
    const dur = Math.min(Math.max((y0 - y1) / 0.13, 6000), 11000);
    const start = performance.now();
    sky.classList.add('is-flying');

    function frame(now) {
      const ms = now - start;
      const t = Math.min(ms / dur, 1);
      const p = 0.6 * t + 0.4 * t * t;
      const phase = ms / period * 2 * Math.PI;
      const x = x0 + drift * p + Math.sin(phase) * sway;
      const y = y0 + (y1 - y0) * p;
      const angle = Math.sin(phase - 0.6) * 6;
      const s = 1 - 0.2 * p;
      balloon.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${s})`;

      // Il nodo dopo rotazione e scala intorno al centro dell'immagine
      const a = angle * Math.PI / 180;
      const kx = (KNOT_X - 0.5) * bw * s;
      const ky = (KNOT_Y - 0.5) * bh * s;
      const ax = x + bw / 2 + kx * Math.cos(a) - ky * Math.sin(a);
      const ay = y + bh / 2 + kx * Math.sin(a) + ky * Math.cos(a);
      // Il filo resta indietro rispetto al dondolio e serpeggia un po'
      const l = len * s;
      const lag = -Math.cos(phase) * sway * 0.9;
      const w1 = Math.sin(phase * 1.7) * 7;
      const w2 = Math.sin(phase * 1.7 + 2) * 9;
      string.setAttribute('d',
        `M${ax},${ay} C${ax + w1},${ay + l * 0.35} ${ax + lag * 0.6 + w2},${ay + l * 0.7} ${ax + lag},${ay + l}`);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        flying = false;
        sky.classList.remove('is-flying');
        schedule(12000 + Math.random() * 8000);
      }
    }
    requestAnimationFrame(frame);
  }

  function resume() {
    if (inView && !document.hidden && !flying && !timer) schedule(1200);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries.some(e => e.isIntersecting);
      resume();
    // Con un margine e non una soglia: su telefono la sezione è più alta
    // dello schermo e una percentuale potrebbe non arrivare mai
    }, { rootMargin: '-20% 0px' }).observe(sky);
  } else {
    inView = true;
    resume();
  }
  document.addEventListener('visibilitychange', resume);
})();

// Titolo della home: ogni lettera in uno span, così al passaggio del mouse
// solo quella lettera diventa corsivo rosso (vedi .hero h1 .ch in style.css).
// Gli spazi restano testo normale per non alterare gli a capo; gli screen
// reader leggono il titolo intero dall'aria-label invece che lettera per lettera.
(function () {
  const h1 = document.querySelector('.hero h1');
  if (!h1) return;
  h1.setAttribute('aria-label', h1.innerText.replace(/\s+/g, ' ').trim());
  const splitText = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      Array.from(node.childNodes).forEach(splitText);
      return;
    }
    if (node.nodeType !== Node.TEXT_NODE) return;
    // Le lettere di ogni parola stanno in uno span .w che non va a capo:
    // il corsivo disegnato sopra la lettera (::after assoluto) altrimenti
    // creerebbe un punto di a capo in mezzo alla parola.
    const frag = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\s+)/)) {
      if (!part) continue;
      if (/\s/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
      const word = document.createElement('span');
      word.className = 'w';
      for (const ch of part) {
        const span = document.createElement('span');
        span.className = 'ch';
        span.dataset.ch = ch;
        span.setAttribute('aria-hidden', 'true');
        span.textContent = ch;
        word.appendChild(span);
      }
      frag.appendChild(word);
    }
    node.replaceWith(frag);
  };
  splitText(h1);

  // A ogni passaggio la lettera prende un colore a caso (mai uguale al
  // precedente) tra quelli già presenti nella pagina: l'accento del sito e i
  // colori delle tile dei progetti. L'hero è su fondo scuro, quindi i toni
  // più cupi sono schiariti quanto basta per leggersi sul nero (contrasto
  // almeno 4,5:1); il giallo è il #F5C400 di IDEA, verde e giallo erano già ok.
  const palette = ['#727DB6', '#7476CD', '#658964', '#DD4B44', '#617BD5',
    '#9272C0', '#A67543', '#E74145', '#4283B6', '#4F9A16', '#F5C400'];
  let lastColor = '';
  const randomColor = () => {
    let color;
    do { color = palette[Math.floor(Math.random() * palette.length)]; } while (color === lastColor);
    lastColor = color;
    return color;
  };
  const setColor = (ch) => ch.style.setProperty('--ch-color', randomColor());
  // Parola colpita dal cartellino (cartellino3d.js): si accende di un
  // colore a caso della stessa tavolozza
  h1.addEventListener('cartellino-hit', (e) => {
    e.target.style.setProperty('--dot', randomColor());
  });
  h1.addEventListener('mouseover', (e) => {
    const ch = e.target.closest('.ch');
    if (ch) setColor(ch);
  });

  // Ogni secondo o due se ne accendono per un attimo (classe is-on) due a
  // caso da sole, su tutti gli schermi, solo mentre il titolo è a schermo e
  // non con "riduci movimento". Su touch, dove non c'è hover, si accende
  // anche la lettera che si tocca o su cui ci si striscia sopra.
  const letters = Array.from(h1.querySelectorAll('.ch'));
  const timers = new Map();
  const flash = (ch, duration = 650) => {
    if (timers.has(ch)) return;
    setColor(ch);
    ch.classList.add('is-on');
    timers.set(ch, setTimeout(() => {
      ch.classList.remove('is-on');
      timers.delete(ch);
    }, duration));
  };

  // Mentre si trascina il cartellino sopra il titolo le lettere restano ferme
  const lanyard = document.getElementById('lanyard');
  const onTouch = (e) => {
    if (lanyard && lanyard.classList.contains('is-dragging')) return;
    for (const t of e.changedTouches) {
      const ch = document.elementFromPoint(t.clientX, t.clientY)?.closest('.hero h1 .ch');
      if (ch) flash(ch);
    }
  };
  h1.addEventListener('touchstart', onTouch, { passive: true });
  h1.addEventListener('touchmove', onTouch, { passive: true });

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Due "cicli" indipendenti, ognuno con pause e durate a caso: le lettere
  // accese sono spesso due ma non si accendono né si spengono insieme.
  // Si sceglie solo tra le lettere spente con entrambe le vicine spente,
  // così due lettere accese non sono mai una accanto all'altra.
  const autos = [null, null];
  const isFree = (i) => !timers.has(letters[i - 1]) && !timers.has(letters[i]) && !timers.has(letters[i + 1]);
  const tick = (i) => {
    const free = letters.filter((_, j) => isFree(j));
    if (free.length) flash(free[Math.floor(Math.random() * free.length)], 450 + Math.random() * 550);
    autos[i] = setTimeout(() => tick(i), 700 + Math.random() * 1300);
  };
  new IntersectionObserver(([entry]) => {
    autos.forEach(clearTimeout);
    if (entry.isIntersecting) {
      autos[0] = setTimeout(() => tick(0), 800);
      autos[1] = setTimeout(() => tick(1), 1300 + Math.random() * 600);
    }
  }).observe(h1);
})();

// Partner dei premi (home, sezione In evidenza, e hero di WKZ): la fila di
// loghi viene duplicata per il loop continuo (come il ticker; con "riduci
// movimento" niente copia, la fila si scorre a mano). Passando su un logo si
// accendono le voci di "Premi & Pubblicazioni" con lo stesso data-partner, e
// passando su una voce i suoi loghi.
// Home: su touch lo stesso succede toccando un logo.
// WKZ (data-dialog): i premi stanno nella finestra del bollino, quindi un
// clic sul logo la apre con le sue voci già accese.
(function () {
  const partners = document.querySelector('.partners');
  const awards = document.querySelector('.awards');
  if (!partners || !awards) return;
  const track = partners.querySelector('.partners-track');
  const cards = () => partners.querySelectorAll('.partner-card');
  const items = awards.querySelectorAll('li[data-partner]');
  const dialog = partners.dataset.dialog && document.getElementById(partners.dataset.dialog);

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Array.from(track.children).forEach((li) => {
      const copy = li.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelector('img').alt = '';
      track.appendChild(copy);
    });
  }

  // keys: elenco di partner da accendere (vuoto = spegne tutto)
  const light = (keys) => {
    const on = keys.length > 0;
    partners.classList.toggle('is-filtering', on);
    awards.classList.toggle('is-filtering', on);
    cards().forEach((c) => c.classList.toggle('is-lit', keys.includes(c.dataset.partner)));
    items.forEach((li) => li.classList.toggle('is-lit',
      li.dataset.partner.split(' ').some((k) => keys.includes(k))));
  };

  // Con la finestra aperta, uscendo da una voce si torna al logo cliccato
  let picked = [];
  const rest = () => (dialog && dialog.open ? picked : []);

  const hover = (root, selector, keysOf) => {
    root.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest(selector);
      if (el) light(keysOf(el));
    });
    root.addEventListener('pointerout', (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest(selector);
      if (el && !el.contains(e.relatedTarget)) light(rest());
    });
  };
  hover(track, '.partner-card', (c) => [c.dataset.partner]);
  hover(awards, 'li[data-partner]', (li) => li.dataset.partner.split(' '));

  if (dialog) {
    const open = (card) => {
      picked = [card.dataset.partner];
      light(picked);
      dialog.showModal();
      const first = awards.querySelector('li.is-lit');
      if (first) first.scrollIntoView({ block: 'nearest' });
    };
    // Solo le card originali sono raggiungibili da tastiera, non le copie
    cards().forEach((c) => {
      if (c.getAttribute('aria-hidden')) return;
      c.tabIndex = 0;
      c.setAttribute('role', 'button');
      c.setAttribute('aria-label', c.querySelector('img').alt + ': vedi i premi');
      c.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(c); }
      });
    });
    track.addEventListener('click', (e) => {
      const card = e.target.closest('.partner-card');
      if (card) open(card);
    });
    dialog.addEventListener('close', () => { picked = []; light([]); });
    return;
  }

  // Touch: un tocco accende e ferma la fila, un secondo tocco sullo stesso
  // logo o fuori spegne e la fa ripartire. Il click arriva solo dai tocchi
  // veri, non quando il dito scorre la pagina
  let tapped = null;
  document.addEventListener('click', (e) => {
    if (e.pointerType === 'mouse') return;
    const card = e.target.closest('.partner-card');
    tapped = card && card.dataset.partner !== tapped ? card.dataset.partner : null;
    light(tapped ? [tapped] : []);
    track.classList.toggle('is-paused', !!tapped);
    // Su telefono l'elenco può essere chiuso: lo apre per mostrare le voci accese
    const peek = awards.querySelector('.peek');
    if (tapped && peek) peek.dispatchEvent(new Event('peek:open'));
  });
})();

// Anteprime scorrevoli della home (premi, formazione, competenze): su
// telefono ogni elenco parte chiuso con le prime voci, che si scorrono col
// dito, e il pulsante lo apre/chiude (su desktop il pulsante è nascosto e
// l'elenco resta sempre aperto, vedi CSS). "peek:open" lo apre da fuori.
// Lo stesso pulsante apre la griglia dei lavori, che non ha un <ul>: lì
// le voci sono le card stesse e chiusa ne mostra solo tre (vedi CSS).
document.querySelectorAll('.peek-toggle').forEach((btn) => {
  const more = document.getElementById(btn.getAttribute('aria-controls'));
  const list = more.querySelector('ul') || more;
  const label = btn.firstChild; // il testo prima del contatore
  const labels = { false: label.textContent, true: btn.dataset.less + ' ' };
  btn.querySelector('.peek-count').textContent = list.children.length;

  // Sfuma sopra solo se si è scesi, sotto finché c'è altro
  list.addEventListener('scroll', () => {
    list.classList.toggle('is-scrolled', list.scrollTop > 2);
    list.classList.toggle('is-end', list.scrollTop + list.clientHeight >= list.scrollHeight - 2);
  }, { passive: true });

  const setOpen = (open) => {
    more.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    label.textContent = labels[open];
    // Richiusa, l'anteprima riparte dalla prima voce
    if (!open) {
      list.scrollTop = 0;
      list.classList.remove('is-scrolled', 'is-end');
    }
  };
  btn.addEventListener('click', () => {
    const open = !more.classList.contains('is-open');
    setOpen(open);
    // Richiudendo, se l'elenco è finito sopra lo schermo ci si torna
    if (!open && more.getBoundingClientRect().top < 0) {
      more.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
  more.addEventListener('peek:open', () => setOpen(true));
});

// "Leggi di più" delle pagine progetto (telefono, e desktop con
// .more--desk: vedi .more in style.css): apre e richiude il testo. L'altezza va da quella chiusa a
// quella del testo in px, poi passa ad auto così il testo si adatta se
// cambia la larghezza
document.querySelectorAll('.more-btn').forEach((btn) => {
  const more = document.getElementById(btn.getAttribute('aria-controls'));
  const label = btn.querySelector('.more-label');
  more.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'height' && more.classList.contains('is-open')) more.style.height = 'auto';
  });
  btn.addEventListener('click', () => {
    const open = !more.classList.contains('is-open');
    if (open) {
      more.classList.add('is-open');
      more.style.height = prefersReducedMotion ? 'auto' : more.scrollHeight + 'px';
    } else {
      more.style.height = more.scrollHeight + 'px';
      more.offsetHeight; // fissa l'altezza di partenza prima di richiudere
      more.style.height = '';
      more.classList.remove('is-open');
    }
    btn.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Leggi di meno' : 'Leggi di più';
  });
});

// Stories di "Chi sono" in home: lo story player di K-Way, con video e foto.
// Avanza da solo quando è a schermo (la barra segue il video, o 5s per le
// foto, e alla fine passa alla story dopo), tocco ai lati e frecce della
// tastiera per navigare, tieni premuto per la pausa. Ogni tacca della barra
// porta i dati della sua story: data-src e data-poster per un video,
// data-photo e data-alt per una foto, più data-label, data-place (il luogo
// accanto al nome) e --c. Parte muto,
// perché i browser non avviano da soli un video con l'audio: lo accende il
// tasto in alto a destra (o M da tastiera) e resta acceso per i video dopo.
// Un solo <video> che carica i video uno alla volta: su iPhone l'audio,
// permesso con un tocco, vale per quell'elemento anche quando cambia story.
(function () {
  const player = document.getElementById('about-stories');
  if (!player) return;
  const video = player.querySelector('.ab-video');
  const photo = player.querySelector('.ab-photo');
  const cover = player.querySelector('.ab-cover');
  const screen = player.querySelector('.ab-screen');
  const stories = Array.from(player.querySelectorAll('.ab-bar'));
  const bars = stories.map(s => s.firstElementChild);
  const volBtn = player.querySelector('.ab-vol');
  const volIcon = volBtn.querySelector('use');
  const place = player.querySelector('.ab-when');
  const PHOTO_DURATION = 5000;

  let index = 0;
  let inView = false;
  let held = false;
  // Con "riduci movimento" niente partenza da sola: parte al primo tocco
  let started = !prefersReducedMotion;
  let suppressClick = false;
  let rafId = null;
  let photoProgress = 0; // 0–1, avanzamento della story con la foto
  let last = 0;

  const isPhoto = () => 'photo' in stories[index].dataset;

  const progress = () => {
    if (isPhoto()) return photoProgress;
    return video.duration ? Math.min(video.currentTime / video.duration, 1) : 0;
  };
  const render = () => {
    const p = progress();
    bars.forEach((b, i) => b.style.setProperty('--p', i < index ? 1 : i === index ? p : 0));
  };

  const playing = () => inView && !held && started && !document.hidden;

  // Un solo ciclo per la barra: per i video legge il tempo del video, per le
  // foto fa avanzare il tempo da sé
  const tick = (t) => {
    if (isPhoto()) {
      if (!playing()) { rafId = null; return; }
      photoProgress += (last ? t - last : 0) / PHOTO_DURATION;
      last = t;
      if (photoProgress >= 1) { rafId = null; show(index + 1); return; }
    } else if (video.paused) {
      render();
      rafId = null;
      return;
    }
    render();
    rafId = requestAnimationFrame(tick);
  };
  const run = () => {
    if (rafId === null) { last = 0; rafId = requestAnimationFrame(tick); }
  };

  const setSound = (on) => {
    video.muted = !on;
    player.classList.toggle('is-sound', on);
    if (on) player.classList.add('was-sound');
    volBtn.setAttribute('aria-pressed', String(on));
    volBtn.setAttribute('aria-label', on ? 'Disattiva l’audio' : 'Attiva l’audio');
    volIcon.setAttribute('href', on ? '#ico-volume-high' : '#ico-volume-xmark');
  };

  const sync = () => {
    if (isPhoto()) {
      video.pause();
      if (playing()) run();
      return;
    }
    if (!playing()) { video.pause(); return; }
    video.play().catch((err) => {
      // Audio non ancora permesso dal browser: riparte muto
      if (err.name === 'NotAllowedError' && !video.muted) {
        setSound(false);
        video.play().catch(() => {});
      }
    });
  };

  // Colore, luogo e titolo della story in corso
  const mark = (i) => {
    index = (i + stories.length) % stories.length;
    const t = stories[index];
    player.style.setProperty('--now', t.style.getPropertyValue('--c'));
    place.textContent = t.dataset.place || '';
    video.setAttribute('aria-label', 'Story di Vito: ' + t.dataset.label);
    render();
  };

  const show = (i) => {
    mark(i);
    const t = stories[index];
    if (isPhoto()) {
      // La foto entra sopra il video, che resta fermo sotto
      photoProgress = 0;
      photo.classList.remove('is-on');
      photo.src = t.dataset.photo;
      photo.alt = t.dataset.alt || '';
      photo.offsetWidth;
      photo.classList.add('is-on');
      cover.classList.add('is-hidden');
    } else {
      photo.classList.remove('is-on');
      photo.alt = '';
      // Il poster della story nuova entra come le stories di K-Way e copre il
      // cambio di video; sfuma quando il video parte
      cover.classList.add('is-entering');
      cover.classList.remove('is-hidden');
      cover.src = t.dataset.poster;
      cover.offsetWidth;
      cover.classList.remove('is-entering');
      video.poster = t.dataset.poster;
      // Stesso file della story di prima: si riparte da capo senza ricaricarlo
      if (video.getAttribute('src') !== t.dataset.src) video.src = t.dataset.src;
      else video.currentTime = 0;
    }
    render();
    sync();
  };

  video.addEventListener('playing', () => {
    cover.classList.add('is-hidden');
    run();
  });
  video.addEventListener('seeked', () => { if (!video.paused) cover.classList.add('is-hidden'); });
  video.addEventListener('ended', () => { if (!isPhoto()) show(index + 1); });
  video.addEventListener('loadedmetadata', render);

  const go = (i) => { started = true; show(i); };
  player.querySelector('.ab-tap--prev').addEventListener('click', () => {
    if (!suppressClick) go(index - 1);
  });
  player.querySelector('.ab-tap--next').addEventListener('click', () => {
    if (!suppressClick) go(index + 1);
  });

  volBtn.addEventListener('click', () => {
    started = true;
    setSound(video.muted);
    sync();
  });
  // Il tasto dell'audio sta sopra lo schermo: premerlo non è "tieni premuto"
  volBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

  // Tieni premuto = pausa (come su Instagram). Un tap breve resta navigazione.
  let holdTimer = null;
  screen.addEventListener('pointerdown', () => {
    suppressClick = false;
    holdTimer = setTimeout(() => {
      held = true;
      suppressClick = true;
      player.classList.add('is-paused');
      sync();
    }, 220);
  });
  const release = () => {
    clearTimeout(holdTimer);
    if (!held) return;
    held = false;
    player.classList.remove('is-paused');
    sync();
  };
  screen.addEventListener('pointerup', release);
  screen.addEventListener('pointerleave', release);
  screen.addEventListener('pointercancel', release);

  player.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(index + 1);
    if (e.key === 'ArrowLeft') go(index - 1);
    if (e.key === 'm' || e.key === 'M') volBtn.click();
  });

  // Gira solo con metà telefono a schermo e la scheda in primo piano
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries.some(e => e.isIntersecting);
      sync();
    }, { threshold: 0.5 }).observe(screen);
  } else {
    inView = true;
  }
  document.addEventListener('visibilitychange', sync);

  // Precarica le foto dopo il caricamento della pagina: il passaggio dal
  // video alla foto è istantaneo
  window.addEventListener('load', () => {
    stories.forEach((t) => { if ('photo' in t.dataset) new Image().src = t.dataset.photo; });
  });

  mark(0);
  sync();
})();
