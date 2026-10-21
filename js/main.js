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

// Autoplay solo quando il video è visibile in viewport: senza questo, tutti
// i video della griglia partirebbero insieme al caricamento della pagina
// anche se fuori schermo, sprecando banda e CPU. In pausa quando escono.
const lazyVideos = document.querySelectorAll('video.art');

// Video con una versione dedicata al mobile (es. Raf 40): anche il poster
// deve essere quello della versione mobile, con lo stesso taglio.
if (window.matchMedia('(max-width: 820px)').matches) {
  document.querySelectorAll('video[data-poster-mobile]').forEach(video => {
    video.poster = video.dataset.posterMobile;
  });
}
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
  // scaricata dopo il caricamento della pagina, per non rubare banda all'avvio
  window.addEventListener('load', () => {
    layer.preload = 'auto';
    layer.src = video.dataset.srcHover;
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

// Precarica e decodifica le varianti hover dei tile a ciclo immagini dopo il
// load della pagina, cosi' il primo mouseover non ha né attesa di rete né
// blocco per la decodifica. Le immagini restano in preloadedFrames perché il
// browser non butti via la versione già decodificata.
const preloadedFrames = [];
window.addEventListener('load', () => {
  document.querySelectorAll('img[data-cycle-prefix]').forEach(img => {
    const prefix = img.dataset.cyclePrefix;
    const ext = img.dataset.cycleExt;
    const frames = parseInt(img.dataset.cycleFrames, 10);
    for (let i = 2; i <= frames; i++) {
      const frame = new Image();
      frame.src = `${prefix}${i}${ext}`;
      frame.decode().catch(() => {});
      preloadedFrames.push(frame);
    }
  });
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
    const frag = document.createDocumentFragment();
    for (const ch of node.textContent) {
      if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); continue; }
      const span = document.createElement('span');
      span.className = 'ch';
      span.dataset.ch = ch;
      span.setAttribute('aria-hidden', 'true');
      span.textContent = ch;
      frag.appendChild(span);
    }
    node.replaceWith(frag);
  };
  splitText(h1);

  // A ogni passaggio la lettera prende un colore a caso (mai uguale al
  // precedente) tra quelli già presenti nella pagina: l'accento del sito e i
  // colori delle tile dei progetti. Il giallo è il #F5C400 di IDEA appena
  // scurito, altrimenti sul fondo chiaro quasi sparisce.
  const palette = ['#3B4B99', '#6163C6', '#3F6B3D', '#D8322A', '#2347C4',
    '#5A2AA0', '#9A6229', '#E32227', '#00579C', '#4F9A16', '#E8B400'];
  let lastColor = '';
  h1.addEventListener('mouseover', (e) => {
    const ch = e.target.closest('.ch');
    if (!ch) return;
    let color;
    do { color = palette[Math.floor(Math.random() * palette.length)]; } while (color === lastColor);
    lastColor = color;
    ch.style.setProperty('--ch-color', color);
  });
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

  // Touch: un tocco accende, un secondo tocco sullo stesso logo o fuori spegne
  let tapped = null;
  document.addEventListener('click', (e) => {
    if (e.pointerType === 'mouse') return;
    const card = e.target.closest('.partner-card');
    tapped = card && card.dataset.partner !== tapped ? card.dataset.partner : null;
    light(tapped ? [tapped] : []);
    // Su telefono l'elenco può essere chiuso: lo apre per mostrare le voci accese
    const peek = awards.querySelector('.peek');
    if (tapped && peek) peek.dispatchEvent(new Event('peek:open'));
  });
})();

// Anteprime scorrevoli della home (premi, formazione, competenze): su
// telefono ogni elenco parte chiuso con le prime voci, che si scorrono col
// dito, e il pulsante lo apre/chiude (su desktop il pulsante è nascosto e
// l'elenco resta sempre aperto, vedi CSS). "peek:open" lo apre da fuori.
document.querySelectorAll('.peek-toggle').forEach((btn) => {
  const more = document.getElementById(btn.getAttribute('aria-controls'));
  const list = more.querySelector('ul');
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
