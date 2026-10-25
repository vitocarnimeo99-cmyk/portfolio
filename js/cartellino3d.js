// ============ Cartellino 3D interattivo (lanyard) ============
// Richiede il global THREE caricato prima di questo script (build UMD non-module,
// cosi' la pagina funziona anche aperta come file:// senza server locale).
(function () {
  const container = document.getElementById('lanyard');
  if (!container || !window.WebGLRenderingContext) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = container.clientWidth || 300;
  let height = container.clientHeight || 460;

  const scene = new THREE.Scene();
  /* FOV largo e camera vicina (invece di FOV stretto e camera lontana, quasi
     ortografica) accentuano molto la prospettiva: quando il cartellino gira
     i suoi bordi si avvicinano/allontanano in modo evidente, dando un vero
     senso di volume invece di un semplice scorrimento piatto. La distanza è
     calcolata per inquadrare la stessa area del laccetto di prima. */
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0.35, 6.76);
  camera.lookAt(0, 0.35, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  /* Ambiente per i riflessi: una stanza finta con tre pannelli luminosi
     (soffitto e due laterali), trasformata in mappa di riflessione. È lei
     a dare la lucentezza alla plastificazione del cartellino, il cromo
     all'anello e i colori al sigillo olografico, che senza riflessi
     sarebbero piatti. Si calcola una volta sola. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(
    new THREE.BoxGeometry(12, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xb8b2a5, side: THREE.BackSide })
  ));
  function envPanel(w, h, x, y, z, color, intensity) {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    envScene.add(panel);
  }
  envPanel(7, 2.5, 0, 5.5, 2.5, 0xffffff, 4);
  envPanel(2, 6, -5.5, 0.5, 2, 0xfff1dc, 2.4);
  envPanel(2, 6, 5.5, 1, -1.5, 0xdbe3ff, 1.8);
  scene.environment = pmrem.fromScene(envScene, 0.03).texture;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(3, 5, 6);
  scene.add(key);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
  fillLight.position.set(-4, -1, 4);
  scene.add(fillLight);
  /* Controluce sul retro: quando il cartellino gira su se stesso il bordo
     e il retro prendono un riflesso diverso dal fronte, rendendo la
     rotazione molto più leggibile come effetto tridimensionale. */
  const rimLight = new THREE.DirectionalLight(0xbcd0ff, 0.6);
  rimLight.position.set(-2, 2, -6);
  scene.add(rimLight);

  /* ---------------- corda fisica (verlet) ---------------- */
  const SEGMENTS = 16;
  const REST_LEN = 0.32;
  /* Ancorato in alto a destra: il cordino nasce appena sotto il menu (il
     punto è fuori dall'inquadratura, sopra il riquadro dell'hero) e riposa
     lontano dal titolo, ma resta libero di essere trascinato su tutta l'area.
     La x è proporzionale alla larghezza visibile della camera, così su
     schermi stretti (mobile) resta sempre dentro l'inquadratura. */
  const ANCHOR = new THREE.Vector3(0, 6.6, 0);
  const CARD_W = 2.05, CARD_H = 2.7, CARD_D = 0.08;
  const CLIP_GAP = 0.28; // distanza tra moschettone e bordo alto del cartellino

  /* Su mobile e tablet l'inquadratura è quella di una fascia alta
     MOBILE_BAND_H px in cima all'hero (vedi updateCamera). Su telefono, dove
     sotto il titolo ci sono le pillole dei ruoli, la fascia è più bassa
     così il cartellino viene più piccolo (154px di altezza). */
  const MOBILE_BAND_H = 420;
  const PHONE_BAND_H = 360;
  const roles = document.querySelector('.hero-roles');
  const title = document.querySelector('.hero h1');
  const isPhoneLayout = () => !!roles && roles.offsetParent !== null;

  /* Telefono: x (in px dal bordo sinistro dell'hero) del cordino a riposo.
     Di base il cartellino sta a 20px dal bordo destro, ma il cordino non
     deve sfiorare la fine di una riga del titolo: si sceglie la posizione
     più vicina a quella di base che stia ad almeno TEXT_GAP px da ogni
     riga, potendo avvicinare il cartellino al bordo fino a 8px o spostarlo
     a sinistra fino alle pillole. Le righe che occupano tutto lo spazio
     disponibile (il cordino le attraversa comunque, dietro le lettere) non
     contano. */
  const TEXT_GAP = 16;
  // Righe del titolo in px rispetto all'hero: dove finiscono e dove stanno
  function titleLines() {
    const box = container.getBoundingClientRect();
    const lines = {};
    const range = document.createRange();
    range.selectNodeContents(title);
    for (const r of range.getClientRects()) {
      const key = Math.round(r.top);
      const line = lines[key] || (lines[key] = { right: 0, bottom: 0 });
      line.right = Math.max(line.right, r.right - box.left);
      line.bottom = Math.max(line.bottom, r.bottom - box.top);
    }
    return Object.values(lines);
  }
  function phoneStrapX(cardHalf, lines) {
    const box = container.getBoundingClientRect();
    const w = box.width;
    const pref = w - 20 - cardHalf;
    const hi = w - 8 - cardHalf;
    const lo = Math.min(pref, roles.firstElementChild.getBoundingClientRect().right - box.left + TEXT_GAP + cardHalf);
    const blocked = lines
      .map(({ right }) => [0, right + TEXT_GAP])
      .filter(([a, b]) => !(a <= lo && b >= hi));
    const free = [pref, ...blocked.map(([, b]) => b)]
      .map((x) => THREE.MathUtils.clamp(x, lo, hi))
      .filter((x) => !blocked.some(([a, b]) => x > a && x < b));
    if (!free.length) return pref;
    return free.reduce((best, x) => (Math.abs(x - pref) < Math.abs(best - pref) ? x : best));
  }
  /* Telefono: bordo alto del cartellino (px dall'hero). Sale il più
     possibile nello spazio libero a destra delle ultime righe del titolo
     (accanto a "impresse."): sta sotto ogni riga che arriva fin sopra il
     cartellino, e ancora più giù sotto quelle che arrivano fin sopra il
     moschettone, che sporge sopra il cartellino di clipSpace px. */
  function phoneCardTop(strapX, cardHalf, clipSpace, lines) {
    let top = title.getBoundingClientRect().top - container.getBoundingClientRect().top;
    for (const { right, bottom } of lines) {
      if (right + TEXT_GAP > strapX - 8) top = Math.max(top, bottom + clipSpace);
      else if (right + TEXT_GAP > strapX - cardHalf) top = Math.max(top, bottom + 12);
    }
    return top;
  }

  /* ---------------- pillole dei ruoli ----------------
     Sul telefono le pillole sono quelle dei ruoli; su tablet e desktop, dove
     al loro posto c'è l'occhiello, fanno da pillole le sue quattro parti
     ("Illustrator," "Graphic" "&" "Motion Designer"), con la stessa fisica.
     In tutti e due i casi lo sono anche le parole del titolo (gli span .w
     creati da main.js).
     Le pillole sono "corpi" leggeri legati con una molla al loro posto.
     A ogni passo il contorno del cartellino viene proiettato sullo schermo
     (un quadrilatero, che si stringe quando gira su se stesso) e confrontato
     con quello di ogni pillola (una capsula): se si toccano, la pillola
     viene spinta fuori e prende la velocità del cartellino, ruota se è
     colpita lontano dal centro, si schiaccia un attimo e il pallino fa
     un'onda del suo colore. Le pillole si urtano anche tra loro, quindi un
     colpo forte le manda una contro l'altra, poi tornano a posto elastiche.
     Il cartellino, se non lo si sta tenendo, rimbalza un po' all'indietro. */
  const PILL_SPRING = 0.05;       // richiamo verso il posto
  const PILL_DAMPING = 0.9;       // attrito dello spostamento
  const PILL_ANGLE_SPRING = 0.07;
  const PILL_ANGLE_DAMPING = 0.88;
  const PILL_BOUNCE = 0.55;       // elasticità dell'urto con il cartellino
  const PILL_SHARE = 0.85;        // quanta compenetrazione risolve la pillola (il resto il cartellino)
  const PILL_MAX_X = 140, PILL_MAX_Y = 90, PILL_MAX_ANGLE = 0.7;
  /* Qualsiasi cosa succeda, dopo un po' le pillole tornano a posto: passati
     PILL_RETURN_STEPS passi dall'ultimo colpo del cartellino, o comunque
     PILL_MAX_STEPS da quando ha cominciato a muoversi, una pillola smette
     di urtare (cartellino e altre pillole le passano sopra) e rientra
     dritta, senza rimbalzi; se dopo PILL_SNAP_STEPS non è ancora arrivata
     ci torna di colpo. Senza, potrebbe restare incastrata ruotata contro
     un'altra, o sotto il cartellino tenuto sopra con il dito. */
  const PILL_RETURN_STEPS = 90;  // 1,5 s
  const PILL_MAX_STEPS = 180;    // 3 s
  const PILL_SNAP_STEPS = 90;    // 1,5 s di rientro al massimo
  let pillClock = 0;
  // shrink: quanto togliere all'altezza (in frazione) perché le righe del
  // titolo, attaccate tra loro, a riposo non si tocchino
  const makePills = (els, shrink = 0) => Array.from(els).map((el) => ({
    el, shrink, hx: 0, hy: 0, w: 0, h: 0, // posto (centro, px dall'hero) e misure
    x: 0, y: 0, vx: 0, vy: 0,          // spostamento dal posto e velocità, px/passo
    a: 0, va: 0, s: 0, vs: 0,          // rotazione e schiacciamento
    poly: null, hitAt: 0, moving: false,
    lastHit: 0, startedAt: 0,            // passo dell'ultimo colpo e di quando ha cominciato a muoversi
    returning: false, returnAt: 0        // se sta rientrando, e da quando
  }));
  const titlePills = makePills(title.querySelectorAll('.w'), 0.2);
  const rolePills = [...(roles ? makePills(roles.children) : []), ...titlePills];
  const eyebrowPills = [...makePills(document.querySelectorAll('.hero .home-eyebrow > span')), ...titlePills];
  let pills = rolePills; // quelle del layout attuale
  function usePills(list) {
    if (list === pills) return;
    resetPills();
    pills = list;
  }

  function measurePills() {
    const box = container.getBoundingClientRect();
    for (const p of pills) {
      const t = p.el.style.transform;
      p.el.style.transform = '';
      const r = p.el.getBoundingClientRect();
      p.el.style.transform = t;
      p.hx = r.left + r.width / 2 - box.left;
      p.hy = r.top + r.height / 2 - box.top;
      p.w = r.width;
      p.h = r.height * (1 - p.shrink);
    }
  }
  function resetPills() {
    for (const p of pills) {
      p.x = p.y = p.vx = p.vy = p.a = p.va = p.s = p.vs = 0;
      p.moving = p.returning = false;
      p.el.style.transform = '';
    }
  }

  // Contorno della capsula: due semicerchi da 5 punti, ruotati con la pillola
  // (la "&" è più stretta che alta: diventa un cerchio largo quanto lei)
  function pillPolygon(p) {
    const r = Math.min(p.w, p.h) / 2, half = p.w / 2 - r;
    const cos = Math.cos(p.a), sin = Math.sin(p.a);
    const cx = p.hx + p.x, cy = p.hy + p.y;
    const poly = [];
    for (let side = 0; side < 2; side++) {
      const ox = side ? -half : half;
      for (let k = 0; k <= 4; k++) {
        const ang = -Math.PI / 2 + (side ? Math.PI : 0) + k * Math.PI / 4;
        const lx = ox + Math.cos(ang) * r, ly = Math.sin(ang) * r;
        poly.push({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos });
      }
    }
    return poly;
  }

  function centroid(poly) {
    let x = 0, y = 0;
    for (const v of poly) { x += v.x; y += v.y; }
    return { x: x / poly.length, y: y / poly.length };
  }

  /* Separating Axis Theorem tra due poligoni convessi: null se non si
     toccano, altrimenti la direzione (da A verso B) e la profondità minime
     per separarli. */
  function overlap(A, B) {
    let depth = Infinity, nx = 0, ny = 0;
    for (const P of [A, B]) {
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length];
        let ax = q.y - p.y, ay = p.x - q.x;
        const len = Math.hypot(ax, ay);
        if (len < 1e-3) continue;
        ax /= len; ay /= len;
        let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
        for (const v of A) { const d = v.x * ax + v.y * ay; if (d < minA) minA = d; if (d > maxA) maxA = d; }
        for (const v of B) { const d = v.x * ax + v.y * ay; if (d < minB) minB = d; if (d > maxB) maxB = d; }
        const o = Math.min(maxA - minB, maxB - minA);
        if (o <= 0) return null;
        if (o < depth) { depth = o; nx = ax; ny = ay; }
      }
    }
    const ca = centroid(A), cb = centroid(B);
    if ((cb.x - ca.x) * nx + (cb.y - ca.y) * ny < 0) { nx = -nx; ny = -ny; }
    return { nx, ny, depth };
  }

  function inside(poly, pt) {
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const c = (q.x - p.x) * (pt.y - p.y) - (q.y - p.y) * (pt.x - p.x);
      if (Math.abs(c) < 1e-6) continue;
      if (sign === 0) sign = Math.sign(c);
      else if (Math.sign(c) !== sign) return false;
    }
    return true;
  }

  // Punto di contatto: gli spigoli del cartellino dentro la pillola, o
  // quelli della pillola dentro il cartellino, o il centro della pillola
  function contactPoint(card, pill) {
    let pts = card.filter((v) => inside(pill, v));
    if (!pts.length) pts = pill.filter((v) => inside(card, v));
    return pts.length ? centroid(pts) : centroid(pill);
  }

  let lastPulse = 0;
  function pulse(p, strength) {
    const now = performance.now();
    if (now - p.hitAt < 220) return;
    p.hitAt = now;
    p.el.classList.remove('is-hit');
    // Prima dell'animazione: main.js ne approfitta per dare alle parole del
    // titolo un colore a caso (in --dot)
    p.el.dispatchEvent(new CustomEvent('cartellino-hit', { bubbles: true }));
    void p.el.offsetWidth; // fa ripartire l'animazione
    p.el.classList.add('is-hit');
    // Sui telefoni Android un colpo forte si sente anche in mano
    if (dragging && strength > 5 && now - lastPulse > 120 && navigator.vibrate) {
      lastPulse = now;
      navigator.vibrate(8);
    }
  }

  let restLen = REST_LEN;
  let pillsPxPerUnit = 0; // px per unità di scena, per le pillole (0 = non ancora misurato)
  // A riposo il cordino si allunga un po' sotto il peso del cartellino
  // (i vincoli della simulazione non sono rigidi): di quanto, misurato a
  // occhio sugli screenshot, per far arrivare il cartellino dove deve.
  const ROPE_STRETCH = 0.044;
  function updateLayout() {
    const dist = camera.position.z;
    const halfHeight = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const w = container.clientWidth;
    restLen = REST_LEN;
    // Le parole del titolo spostate falserebbero la misura delle sue righe
    resetPills();
    // Telefono: cartellino a destra delle pillole e centrato con loro in
    // altezza. Il cartellino scende fino a centrarsi sulle pillole (mai più
    // in alto di quanto permette phoneCardTop); se deve stare più in basso
    // sono le pillole a scendere (padding-top) fino al suo centro. Il blocco
    // delle pillole arriva comunque fin sotto il cartellino, così il
    // paragrafo non gli finisce dietro. Il cordino si allunga quanto serve.
    if (isPhoneLayout()) {
      const pxPerUnit = PHONE_BAND_H / (2 * halfHeight);
      const cardHalf = CARD_W / 2 * pxPerUnit;
      const cardH = CARD_H * pxPerUnit;
      const lines = titleLines();
      const strapX = phoneStrapX(cardHalf, lines);
      ANCHOR.x = (strapX - w / 2) / pxPerUnit;
      const heroTop = container.getBoundingClientRect().top;
      const rolesTop = roles.getBoundingClientRect().top - heroTop;
      const pillsH = roles.lastElementChild.getBoundingClientRect().bottom - roles.firstElementChild.getBoundingClientRect().top;
      const minCardTop = phoneCardTop(strapX, cardHalf, (CLIP_GAP + 0.11) * pxPerUnit + 8, lines);
      const cardTop = Math.max(minCardTop, rolesTop + (pillsH - cardH) / 2);
      const pillsPush = Math.max(0, cardTop + cardH / 2 - (rolesTop + pillsH / 2));
      const cardTopY = camera.position.y + halfHeight - cardTop / pxPerUnit;
      restLen = (ANCHOR.y - cardTopY - CLIP_GAP) / (SEGMENTS - 1) / (1 + ROPE_STRETCH);
      roles.style.paddingTop = Math.round(pillsPush) + 'px';
      roles.style.minHeight = Math.max(0, Math.ceil(cardTop + cardH - rolesTop)) + 'px';
      usePills(rolePills);
      pillsPxPerUnit = pxPerUnit;
      measurePills();
      return;
    }
    if (roles) roles.style.paddingTop = roles.style.minHeight = '';
    // Tablet e desktop: pillole dell'occhiello. La camera inquadra la
    // fascia alta (tablet) o tutto l'hero (desktop), vedi updateCamera.
    usePills(eyebrowPills);
    const viewH = w <= 980 && height > MOBILE_BAND_H ? MOBILE_BAND_H : height;
    pillsPxPerUnit = viewH / (2 * halfHeight);
    measurePills();
    // Tablet (vedi style.css): il cartellino ha una fascia tutta sua sopra
    // il titolo, lì sta meglio centrato.
    if (w <= 980) { ANCHOR.x = 0; return; }
    const halfWidth = halfHeight * camera.aspect;
    ANCHOR.x = THREE.MathUtils.clamp(halfWidth * 0.62, 0.5, 3.2);
  }
  updateLayout();
  const GRAVITY_Y = -0.03;
  const DAMPING = 0.98;

  const points = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const y = prefersReducedMotion ? ANCHOR.y - i * restLen : ANCHOR.y - i * 0.06;
    const x = ANCHOR.x + (prefersReducedMotion ? 0 : (Math.random() - 0.5) * 0.05);
    points.push({
      pos: new THREE.Vector3(x, y, 0),
      old: new THREE.Vector3(x, y + (prefersReducedMotion ? 0 : 0.02), 0),
      pinned: i === 0
    });
  }

  function simulate() {
    for (const p of points) {
      if (p.pinned) continue;
      const vx = (p.pos.x - p.old.x) * DAMPING;
      const vy = (p.pos.y - p.old.y) * DAMPING;
      const vz = (p.pos.z - p.old.z) * DAMPING;
      p.old.copy(p.pos);
      p.pos.x += vx;
      p.pos.y += vy + GRAVITY_Y;
      p.pos.z += vz;
    }
    for (let iter = 0; iter < 12; iter++) {
      points[0].pos.copy(ANCHOR);
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
        const diff = (dist - restLen) / dist;
        const ox = dx * 0.5 * diff, oy = dy * 0.5 * diff, oz = dz * 0.5 * diff;
        if (!a.pinned) { a.pos.x += ox; a.pos.y += oy; a.pos.z += oz; }
        if (!b.pinned) { b.pos.x -= ox; b.pos.y -= oy; b.pos.z -= oz; }
      }
    }
  }

  /* ---------------- laccetto (mesh) ----------------
     Un nastro piatto stampato, come i laccetti veri, invece di un tubo. La
     geometria è una striscia di STRAP_SAMPLES coppie di vertici lungo la
     curva della corda, aggiornata sul posto a ogni frame (niente geometrie
     nuove da creare e buttare). Il nastro guarda la camera e, verso il
     fondo, si attorciglia per seguire il cartellino quando gira. */
  const STRAP_W = 0.3;
  const STRAP_SAMPLES = 72;
  const STRAP_TEX_RATIO = 8; // larghezza/altezza della texture del nastro

  function makeStrapTexture() {
    const w = 1024, h = w / STRAP_TEX_RATIO;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3B4B99';
    ctx.fillRect(0, 0, w, h);
    // Trama del tessuto: righe sottili appena più chiare e più scure
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = y % 6 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, y, w, 1);
    }
    // Cuciture lungo i bordi
    ctx.strokeStyle = 'rgba(247,245,240,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 7]);
    for (const y of [11, h - 11]) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#F7F5F0';
    ctx.textBaseline = 'middle';
    ctx.font = '700 46px Inter, "Helvetica Neue", Arial, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillText('VITQ', 34, h / 2 + 2);
    ctx.font = '600 26px Inter, "Helvetica Neue", Arial, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    ctx.fillText('ILLUSTRATOR · GRAPHIC & MOTION DESIGNER', 196, h / 2 + 2);
    // Stellina finale, prima che il motivo ricominci
    ctx.font = '700 34px Inter, "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#F2C14E';
    ctx.fillText('✦', w - 64, h / 2 + 1);
    const tex = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  const strapMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.82, metalness: 0, side: THREE.DoubleSide
  });
  const strapGeo = new THREE.BufferGeometry();
  const strapPos = new Float32Array(STRAP_SAMPLES * 2 * 3);
  const strapNorm = new Float32Array(STRAP_SAMPLES * 2 * 3);
  const strapUv = new Float32Array(STRAP_SAMPLES * 2 * 2);
  const strapIndex = [];
  for (let i = 0; i < STRAP_SAMPLES - 1; i++) {
    const a = i * 2;
    strapIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  strapGeo.setIndex(strapIndex);
  strapGeo.setAttribute('position', new THREE.BufferAttribute(strapPos, 3));
  strapGeo.setAttribute('normal', new THREE.BufferAttribute(strapNorm, 3));
  strapGeo.setAttribute('uv', new THREE.BufferAttribute(strapUv, 2));
  const strapMesh = new THREE.Mesh(strapGeo, strapMaterial);
  strapMesh.frustumCulled = false;
  scene.add(strapMesh);

  const strapCurvePts = points.map(p => p.pos.clone());
  const strapCurve = new THREE.CatmullRomCurve3(strapCurvePts);
  const sP = new THREE.Vector3(), sPrev = new THREE.Vector3(), sT = new THREE.Vector3();
  const sB = new THREE.Vector3(), sN = new THREE.Vector3(), sB2 = new THREE.Vector3(), sN2 = new THREE.Vector3();
  const VIEW_Z = new THREE.Vector3(0, 0, 1);
  function updateStrap() {
    for (let i = 0; i < points.length; i++) strapCurvePts[i].copy(points[i].pos);
    /* Torsione in fondo al nastro: uguale alla rotazione del cartellino
       attorno al suo asse verticale, riportata tra -π e π (un nastro girato
       di un giro intero è uguale a uno dritto). Si distribuisce sull'ultimo
       terzo del nastro. */
    const yaw = cardGroup.rotation.y;
    const endTwist = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    let len = 0;
    for (let i = 0; i < STRAP_SAMPLES; i++) {
      const t = i / (STRAP_SAMPLES - 1);
      strapCurve.getPoint(t, sP);
      strapCurve.getTangent(t, sT);
      if (i) len += sP.distanceTo(sPrev);
      sPrev.copy(sP);
      sB.crossVectors(sT, VIEW_Z).normalize();
      sN.crossVectors(sB, sT).normalize();
      const k = THREE.MathUtils.smoothstep(t, 0.66, 1);
      const th = endTwist * k, c = Math.cos(th), s = Math.sin(th);
      sB2.copy(sB).multiplyScalar(c).addScaledVector(sN, s);
      sN2.copy(sN).multiplyScalar(c).addScaledVector(sB, -s);
      const u = len / (STRAP_W * STRAP_TEX_RATIO);
      for (let side = 0; side < 2; side++) {
        const v = i * 2 + side, o = side ? -STRAP_W / 2 : STRAP_W / 2;
        strapPos[v * 3] = sP.x + sB2.x * o;
        strapPos[v * 3 + 1] = sP.y + sB2.y * o;
        strapPos[v * 3 + 2] = sP.z + sB2.z * o;
        strapNorm[v * 3] = sN2.x;
        strapNorm[v * 3 + 1] = sN2.y;
        strapNorm[v * 3 + 2] = sN2.z;
        strapUv[v * 2] = u;
        strapUv[v * 2 + 1] = side;
      }
    }
    strapGeo.attributes.position.needsUpdate = true;
    strapGeo.attributes.normal.needsUpdate = true;
    strapGeo.attributes.uv.needsUpdate = true;
  }

  /* ---------------- cartellino ----------------
     Rettangolo dagli angoli arrotondati estruso con un piccolo smusso (che
     prende la luce sui bordi), con una vera asola in alto: l'anello del
     laccetto ci passa attraverso. Il bordo è blu, come i biglietti da
     visita con l'anima colorata. */
  const CARD_R = 0.15;         // raggio degli angoli
  const CARD_BEVEL = 0.014;    // smusso dei bordi
  const SLOT_W = 0.46, SLOT_H = 0.1;
  const SLOT_Y = 0.16;         // centro dell'asola, dal bordo alto

  function roundedRect(path, x, y, w, h, r) {
    path.moveTo(x + r, y);
    path.lineTo(x + w - r, y);
    path.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    path.lineTo(x + w, y + h - r);
    path.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    path.lineTo(x + r, y + h);
    path.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    path.lineTo(x, y + r);
    path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return path;
  }

  function makeCardGeometry() {
    const w = CARD_W - CARD_BEVEL * 2, h = CARD_H - CARD_BEVEL * 2;
    const shape = roundedRect(new THREE.Shape(), -w / 2, -h / 2, w, h, CARD_R - CARD_BEVEL);
    const slotW = SLOT_W + CARD_BEVEL * 2, slotH = SLOT_H + CARD_BEVEL * 2;
    shape.holes.push(roundedRect(new THREE.Path(), -slotW / 2, CARD_H / 2 - SLOT_Y - slotH / 2, slotW, slotH, slotH / 2));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: CARD_D - CARD_BEVEL * 2,
      bevelEnabled: true,
      bevelThickness: CARD_BEVEL,
      bevelSize: CARD_BEVEL,
      bevelSegments: 3,
      curveSegments: 14
    });
    geo.translate(0, 0, -(CARD_D - CARD_BEVEL * 2) / 2);
    /* ExtrudeGeometry mette le due facce in un solo gruppo (prima quella
       dietro, poi quella davanti, con lo stesso numero di triangoli) e il
       bordo in un secondo: le si separa per dare a ognuna il suo
       materiale, e si rifanno le UV in modo che la texture copra
       esattamente il cartellino (sul retro specchiata, perché lo si
       guarda da dietro). */
    const lid = geo.groups[0], side = geo.groups[1];
    const half = lid.count / 2;
    geo.clearGroups();
    geo.addGroup(side.start, side.count, 0);
    geo.addGroup(lid.start, half, 1);
    geo.addGroup(lid.start + half, half, 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = lid.start; i < lid.start + lid.count; i++) {
      const u = (pos.getX(i) + CARD_W / 2) / CARD_W;
      uv.setXY(i, i < lid.start + half ? 1 - u : u, (pos.getY(i) + CARD_H / 2) / CARD_H);
    }
    return geo;
  }

  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x3b4b99, roughness: 0.45 });
  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0xefebe2, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.3
  });
  // Fronte plastificato lucido (clearcoat), come i pass veri
  const frontMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7f5f0, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.16
  });
  const cardMesh = new THREE.Mesh(makeCardGeometry(), [edgeMat, backMat, frontMat]);
  /* Il cartellino è figlio del gruppo, spostato in basso rispetto
     all'origine: l'origine del gruppo è il punto di aggancio al laccetto
     (lo stesso punto dove sta il moschettone), non il centro del
     cartellino. Così qualsiasi rotazione applicata al gruppo (oscillazione,
     spin, ecc.) avviene attorno al punto di aggancio, che quindi non si
     sposta mai: il moschettone non può più "staccarsi" dal cartellino. */
  cardMesh.position.y = -(CARD_H * 0.5 + CLIP_GAP);
  const cardGroup = new THREE.Group();
  cardGroup.add(cardMesh);
  scene.add(cardGroup);

  /* ---------------- moschettone ----------------
     Il nastro finisce in un morsetto di metallo da cui pende un anello
     cromato che passa nell'asola. Stanno nel gruppo del cartellino, quindi
     girano con lui. L'anello sta su un piano verticale ruotato rispetto al
     cartellino, così da davanti si vede come un'ellisse; qualsiasi
     rotazione attorno all'asse verticale lo fa comunque passare per
     l'asola. */
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e4, metalness: 1, roughness: 0.22 });
  const crimpMat = new THREE.MeshStandardMaterial({ color: 0x2b2a28, metalness: 0.85, roughness: 0.35 });
  const crimpW = STRAP_W + 0.04, crimpH = 0.15, crimpBevel = 0.012;
  const crimpGeo = new THREE.ExtrudeGeometry(
    roundedRect(new THREE.Shape(), -crimpW / 2 + crimpBevel, -crimpH / 2 + crimpBevel, crimpW - crimpBevel * 2, crimpH - crimpBevel * 2, 0.025),
    { depth: 0.035, bevelEnabled: true, bevelThickness: crimpBevel, bevelSize: crimpBevel, bevelSegments: 2, curveSegments: 6 }
  );
  crimpGeo.translate(0, 0, -0.0175);
  const crimp = new THREE.Mesh(crimpGeo, crimpMat);
  crimp.position.y = 0.04;
  cardGroup.add(crimp);
  const ringTop = -0.03, ringBottom = -(CLIP_GAP + SLOT_Y);
  const ringR = (ringTop - ringBottom) / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.018, 12, 48), chromeMat);
  ring.position.y = ringTop - ringR;
  ring.rotation.y = Math.PI / 2 - 0.6;
  cardGroup.add(ring);

  /* ---------------- ombra ----------------
     Un'ombra morbida su un piano dietro al cartellino, come se fosse
     appeso davanti a una parete: segue posizione e inclinazione del
     cartellino e si stringe quando lui gira di taglio. */
  function makeShadowTexture() {
    const w = 256, h = Math.round(256 * (CARD_H / CARD_W)), pad = 40;
    const canvas = document.createElement('canvas');
    canvas.width = w + pad * 2; canvas.height = h + pad * 2;
    const ctx = canvas.getContext('2d');
    /* La sfocatura si fa con shadowBlur (ctx.filter non c'è su Safari): si
       disegna il rettangolo fuori dal canvas e se ne tiene solo l'ombra. */
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetX = 2000;
    ctx.fillStyle = '#000';
    const rr = new Path2D();
    const r = CARD_R / CARD_W * w;
    rr.roundRect ? rr.roundRect(pad - 2000, pad, w, h, r) : rr.rect(pad - 2000, pad, w, h);
    ctx.fill(rr);
    return new THREE.CanvasTexture(canvas);
  }
  const SHADOW_PAD = 40 / 256;
  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * (1 + SHADOW_PAD * 2), CARD_H + CARD_W * SHADOW_PAD * 2),
    new THREE.MeshBasicMaterial({ map: makeShadowTexture(), color: 0x17140f, transparent: true, opacity: 0.2, depthWrite: false })
  );
  scene.add(shadowMesh);
  const SHADOW_OFFSET = new THREE.Vector3(0.16, -0.22, -0.55);
  const cardCenter = new THREE.Vector3();
  function placeShadow() {
    cardMesh.getWorldPosition(cardCenter);
    shadowMesh.position.copy(cardCenter).add(SHADOW_OFFSET);
    shadowMesh.rotation.z = cardGroup.rotation.z;
    shadowMesh.scale.x = Math.max(0.1, Math.abs(Math.cos(cardGroup.rotation.y)));
  }

  /* ---------------- grafica del cartellino ----------------
     Fronte: solo la foto, con un bordino chiaro sottile. Retro:
     l'illustrazione VITQ. Disegnati su canvas grandi
     quanto il cartellino (TEX_W px di larghezza), con Inter appena
     caricato. */
  const TEX_W = 1024, TEX_H = Math.round(TEX_W * (CARD_H / CARD_W));
  const U = TEX_W / CARD_W; // px per unità di scena
  const FONT = 'Inter, "Helvetica Neue", Arial, sans-serif';
  const DOTS = ['#D8322A', '#E8B400', '#3F6B3D', '#3B4B99'];
  const slotBox = {
    x: TEX_W / 2 - SLOT_W / 2 * U, y: (SLOT_Y - SLOT_H / 2) * U,
    w: SLOT_W * U, h: SLOT_H * U
  };

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Ritaglio "cover" con un punto di fuoco (fy: 0 = in alto, 1 = in basso)
  function drawCover(ctx, img, x, y, w, h, fy = 0.5) {
    const ir = img.width / img.height, cr = w / h;
    let sw, sh, sx, sy;
    if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) * fy; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function newCanvas(w = TEX_W, h = TEX_H) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    return [canvas, canvas.getContext('2d')];
  }

  function text(ctx, str, x, y, font, color, spacing = 0, align = 'left') {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
    ctx.fillText(str, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  // Rinforzo stampato attorno all'asola
  function drawSlotRing(ctx, color) {
    const g = 10;
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    roundRectPath(ctx, slotBox.x - g, slotBox.y - g, slotBox.w + g * 2, slotBox.h + g * 2, slotBox.h / 2 + g);
    ctx.stroke();
  }

  // Fascia a quattro colori in fondo, gli stessi dei pallini dell'occhiello
  function drawColorBar(ctx, h) {
    const segW = TEX_W / DOTS.length;
    DOTS.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(i * segW, TEX_H - h, segW + 1, h);
    });
  }

  const BORDER = 30;                               // bordino attorno alla foto
  const PHOTO = { x: BORDER, y: BORDER, w: TEX_W - BORDER * 2, h: TEX_H - BORDER * 2 };

  function drawFront(ctx, photo) {
    ctx.fillStyle = '#F7F5F0';
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    // Foto, con gli angoli concentrici a quelli del cartellino
    ctx.save();
    roundRectPath(ctx, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, CARD_R * U - BORDER);
    ctx.clip();
    drawCover(ctx, photo, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, 0.2);
    ctx.restore();
    // L'asola taglia la foto: attorno le si lascia lo stesso bordino chiaro
    const g = BORDER * 0.6;
    ctx.fillStyle = '#F7F5F0';
    roundRectPath(ctx, slotBox.x - g, slotBox.y - g, slotBox.w + g * 2, slotBox.h + g * 2, slotBox.h / 2 + g);
    ctx.fill();
  }

  function drawBack(ctx, sticker) {
    ctx.fillStyle = '#EFEBE2';
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    // Puntinato leggero
    ctx.fillStyle = 'rgba(23,20,15,0.07)';
    for (let y = 30; y < TEX_H; y += 34) {
      for (let x = 30 + (Math.round(y / 34) % 2) * 17; x < TEX_W; x += 34) {
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawSlotRing(ctx, '#DBD5C6');
    if (sticker) {
      const sh = 860, sw = sh * (sticker.width / sticker.height);
      ctx.drawImage(sticker, (TEX_W - sw) / 2, 150, sw, sh);
    }
    text(ctx, 'Disegno identità', TEX_W / 2, TEX_H - 216, `700 50px ${FONT}`, '#17140F', -1, 'center');
    text(ctx, 'che restano impresse.', TEX_W / 2, TEX_H - 160, `700 50px ${FONT}`, '#17140F', -1, 'center');
    text(ctx, '@VITQ1999', TEX_W / 2, TEX_H - 86, `700 22px ${FONT}`, '#3B4B99', 4, 'center');
    drawColorBar(ctx, 30);
  }

  function canvasTexture(canvas, srgb) {
    const tex = new THREE.CanvasTexture(canvas);
    if (srgb && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  const loadImage = (src) => new Promise((resolve) => {
    new THREE.ImageLoader().load(src, resolve, undefined, () => resolve(null));
  });
  // Inter deve essere caricato prima di disegnare, o il canvas userebbe il font di riserva
  const fontsReady = document.fonts
    ? Promise.all([document.fonts.load(`700 40px Inter`), document.fonts.load(`500 40px Inter`)]).catch(() => {})
    : Promise.resolve();

  fontsReady.then(() => {
    strapMaterial.map = makeStrapTexture();
    strapMaterial.needsUpdate = true;
  });

  Promise.all([loadImage('assets/images/VITO.JPG'), fontsReady]).then(([photo]) => {
    if (!photo) return;
    const [front, fctx] = newCanvas();
    drawFront(fctx, photo);
    frontMat.map = canvasTexture(front, true);
    frontMat.color.set(0xffffff);
    frontMat.needsUpdate = true;
  });

  Promise.all([loadImage('assets/images/VITQ_STICKER-cartellino.png'), fontsReady]).then(([sticker]) => {
    const [back, bctx] = newCanvas();
    drawBack(bctx, sticker);
    backMat.map = canvasTexture(back, true);
    backMat.color.set(0xffffff);
    backMat.needsUpdate = true;
  });

  /* ---------------- resize ---------------- */
  /* Su mobile il canvas copre tutto l'hero (per poter tirare il cartellino
     giù fino in fondo), ma l'inquadratura deve restare quella della fascia
     alta di 420px: la camera "vede" la fascia come prima e il resto del
     canvas è solo un'estensione verso il basso della stessa vista, quindi
     scala e posizione del cartellino non cambiano. */
  function updateCamera() {
    const bandH = isPhoneLayout() ? PHONE_BAND_H : MOBILE_BAND_H;
    if (width <= 980 && height > bandH) {
      camera.aspect = width / bandH;
      camera.setViewOffset(width, bandH, 0, 0, width, height);
    } else {
      camera.aspect = width / height;
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }

  function onResize() {
    width = container.clientWidth; height = container.clientHeight;
    if (!width || !height) return;
    updateCamera();
    renderer.setSize(width, height);
    updateLayout();
  }
  new ResizeObserver(onResize).observe(container);
  // Il font del titolo può cambiare la fine delle righe senza cambiare
  // l'altezza dell'hero: a font caricato si ricalcola la posizione.
  if (document.fonts) document.fonts.ready.then(updateLayout);

  /* ---------------- drag ---------------- */
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const dragPlane = new THREE.Plane();
  const dragPoint = new THREE.Vector3();
  const dragVelocity = new THREE.Vector3();
  /* "Picco recente" della velocità, con decadimento: cattura uno strappo
     veloce anche se negli ultimi millisecondi prima del rilascio la mano
     rallenta (cosa che succede quasi sempre quando ci si prepara a
     "lasciare andare" qualcosa) — usare solo l'ultimo frame prima del
     pointerup faceva sì che lo spin non partisse quasi mai. */
  const peakVelocity = new THREE.Vector3();
  let lastMoveTime = 0;
  const lastMovePos = new THREE.Vector3();
  let dragging = false;
  let suppressClickUntil = 0;

  /* Se il rilascio è abbastanza "scattante" il cartellino prende a girare
     su se stesso (rotazione attorno all'asse verticale) e rallenta con un
     attrito, come un vero cartellino lanciato con forza sul laccetto. */
  const SPIN_FLING_THRESHOLD = 0.06;  // velocità minima di rilascio per far scattare la rotazione
  const SPIN_VELOCITY_SCALE = 4;      // quanto la velocità di rilascio si traduce in velocità di spin
  const SPIN_MAX_VELOCITY = 0.55;     // rad/frame massimi sui lanci fortissimi (~3 giri/sec di picco)
  const SPIN_DAMPING = 0.975;         // attrito: quanto rapidamente lo spin rallenta fino a fermarsi
  const SPIN_SETTLE_EASE = 0.05;      // velocità con cui, a spin esaurito, si riallinea al fronte
  let spinVelocity = 0;
  let spinAngle = 0;

  function setPointerFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    /* Il pointer capture continua a inviare eventi anche quando il mouse
       esce dal canvas (es. verso i margini bianchi ai lati su schermi larghi):
       senza questo clamp le coordinate NDC superano [-1,1] e il raggio
       proietta il cartellino fuori dal frustum della camera, facendolo
       sparire prima di raggiungere il bordo visibile. */
    pointerNDC.x = THREE.MathUtils.clamp(nx, -1, 1);
    pointerNDC.y = THREE.MathUtils.clamp(ny, -1, 1);
  }

  function onPointerDown(e) {
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointerNDC, camera);
    const hit = raycaster.intersectObject(cardMesh, false);
    if (hit.length === 0) return;
    dragging = true;
    container.classList.add('is-dragging');
    updateHover();
    renderer.domElement.setPointerCapture(e.pointerId);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const last = points[points.length - 1];
    dragPlane.setFromNormalAndCoplanarPoint(camDir, last.pos);
    /* Il punto trascinato viene "pinnato": durante il drag deve seguire
       esattamente il mouse, senza che gravità e vincoli della corda lo
       tirino altrove nello stesso frame (quel tira-e-molla era la causa
       dell'effetto di glitch/lag). */
    last.pinned = true;
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      last.pos.copy(dragPoint);
      last.old.copy(dragPoint);
    }
    dragVelocity.set(0, 0, 0);
    peakVelocity.set(0, 0, 0);
    lastMoveTime = performance.now();
    lastMovePos.copy(last.pos);
    /* Riafferrare il cartellino ferma qualsiasi spin residuo del lancio precedente. */
    spinVelocity = 0;
    e.preventDefault();
  }

  /* Manina solo sopra il cartellino: si controlla col raycast sia quando il
     mouse si muove sia a ogni frame, perché il cartellino oscilla e può
     spostarsi sotto (o via da) un mouse fermo. */
  const hoverNDC = new THREE.Vector2();
  let pointerInside = false;
  let hovering = false;
  function updateHover() {
    const over = pointerInside && !dragging &&
      (raycaster.setFromCamera(hoverNDC, camera), raycaster.intersectObject(cardMesh, false).length > 0);
    if (over !== hovering) {
      hovering = over;
      container.classList.toggle('is-hover', over);
    }
  }

  function onPointerMove(e) {
    if (!dragging) {
      if (e.pointerType !== 'mouse') return;
      const rect = renderer.domElement.getBoundingClientRect();
      hoverNDC.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      pointerInside = true;
      updateHover();
      return;
    }
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointerNDC, camera);
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      points[points.length - 1].pos.copy(dragPoint);

      const now = performance.now();
      const dt = now - lastMoveTime;
      if (dt > 0) {
        /* Normalizzata a "unita' per frame" a 60fps: cosi' la velocità non
           dipende dalla frequenza con cui il browser invia i pointermove. */
        const norm = dt / 16.6667;
        dragVelocity.set(
          (dragPoint.x - lastMovePos.x) / norm,
          (dragPoint.y - lastMovePos.y) / norm,
          (dragPoint.z - lastMovePos.z) / norm
        );
        peakVelocity.multiplyScalar(0.85);
        if (dragVelocity.lengthSq() > peakVelocity.lengthSq()) {
          peakVelocity.copy(dragVelocity);
        }
      }
      lastMoveTime = now;
      lastMovePos.copy(dragPoint);
    }
    e.preventDefault();
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    container.classList.remove('is-dragging');
    suppressClickUntil = performance.now() + 400;
    updateHover();
    const last = points[points.length - 1];
    last.pinned = false;
    /* Al rilascio si "scongela" il punto e gli si dà la velocita' misurata
       nell'ultimo movimento, cosi' il cartellino continua a oscillare in
       modo naturale invece di fermarsi di scatto. */
    last.old.copy(last.pos).sub(dragVelocity);

    /* Uno strappo forte fa girare il cartellino su se stesso; si usa il
       picco recente (non l'ultimo istante, spesso già rallentato) per
       decidere direzione e intensità della rotazione. */
    const flingSpeed = peakVelocity.length();
    if (flingSpeed > SPIN_FLING_THRESHOLD) {
      const direction = peakVelocity.x !== 0 ? Math.sign(peakVelocity.x) : 1;
      const kick = direction * Math.min(flingSpeed * SPIN_VELOCITY_SCALE, SPIN_MAX_VELOCITY);
      spinVelocity = THREE.MathUtils.clamp(spinVelocity + kick, -SPIN_MAX_VELOCITY, SPIN_MAX_VELOCITY);
    }
  }

  /* Il layer del cartellino copre tutto l'hero ma è "trasparente" ai click
     (pointer-events: none in style.css), così testo e CTA sotto restano
     cliccabili. Gli eventi si ascoltano quindi sull'hero e si decide col
     raycast se riguardano il cartellino. */
  const hero = container.parentElement;
  hero.addEventListener('pointerdown', onPointerDown);
  hero.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  hero.addEventListener('pointercancel', onPointerUp);
  hero.addEventListener('pointerleave', () => {
    pointerInside = false;
    updateHover();
  });

  /* Touch: il dito tocca l'elemento sotto il cartellino, non il canvas, quindi
     il browser proverebbe a scorrere la pagina. Se il tocco è partito sul
     cartellino si blocca lo scroll, così lo si può tirare in qualsiasi
     direzione (anche giù sopra il testo); toccando fuori la pagina scorre. */
  hero.addEventListener('touchmove', (e) => {
    if (dragging && e.cancelable) e.preventDefault();
  }, { passive: false });

  /* Un tap sul cartellino non deve far scattare anche il link che ci sta
     sotto (su touch il click arriva all'elemento sotto, non al canvas). */
  hero.addEventListener('click', (e) => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* ---------------- loop ---------------- */
  /* La fisica avanza a passo fisso di 60 step/sec, indipendente dagli fps:
     prima faceva uno step per frame disegnato, quindi se la pagina scendeva
     sotto i 60fps (video, altre animazioni) il cartellino andava al
     rallentatore, e su schermi a 120Hz andava al doppio della velocità. */
  const STEP_MS = 1000 / 60;
  const MAX_STEPS = 5; // evita la "spirale" di recupero dopo una pausa lunga
  let lastTime = performance.now();
  let accumulator = 0;
  let visible = true;

  /* Il cartellino (con moschettone e anello) segue l'ultimo punto della
     corda: il gruppo sta sempre nel punto di aggancio ed e' il cartellino
     (figlio, spostato in basso) a ruotarci attorno, quindi il punto di
     aggancio non si sposta mai. */
  const ropeDir = new THREE.Vector3();
  function placeCard() {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    ropeDir.subVectors(last.pos, prev.pos).normalize();
    cardGroup.position.copy(last.pos);
    cardGroup.rotation.z = Math.atan2(ropeDir.x, -ropeDir.y);
    cardGroup.rotation.y = THREE.MathUtils.clamp(-ropeDir.x * 0.6, -0.5, 0.5) + spinAngle;
  }

  // Spigoli della faccia davanti del cartellino, nel suo sistema locale
  const cardCorners = [
    new THREE.Vector3(-CARD_W / 2, CARD_H / 2, CARD_D / 2),
    new THREE.Vector3(CARD_W / 2, CARD_H / 2, CARD_D / 2),
    new THREE.Vector3(CARD_W / 2, -CARD_H / 2, CARD_D / 2),
    new THREE.Vector3(-CARD_W / 2, -CARD_H / 2, CARD_D / 2)
  ];
  const corner = new THREE.Vector3();
  let lastCardCenter = null;
  /* Le collisioni valgono da subito: al caricamento il cartellino scende
     dall'alto oscillando e, se passa sul testo, lo urta già da solo. */
  camera.updateMatrixWorld();

  function stepPills() {
    if (!pillsPxPerUnit || !pills.length || prefersReducedMotion) return;

    // Il cartellino in px dall'hero, e la sua velocità in px/passo
    cardGroup.updateMatrixWorld(true);
    const card = cardCorners.map((c) => {
      corner.copy(c);
      cardMesh.localToWorld(corner).project(camera);
      return { x: (corner.x + 1) / 2 * width, y: (1 - corner.y) / 2 * height };
    });
    const center = centroid(card);
    const cvx = lastCardCenter ? center.x - lastCardCenter.x : 0;
    const cvy = lastCardCenter ? center.y - lastCardCenter.y : 0;
    lastCardCenter = center;

    pillClock++;
    for (const p of pills) {
      p.poly = pillPolygon(p);
      if (p.moving && !p.returning &&
          (pillClock - p.lastHit > PILL_RETURN_STEPS || pillClock - p.startedAt > PILL_MAX_STEPS)) {
        p.returning = true;
        p.returnAt = pillClock;
      }
    }

    // Cartellino contro pillole
    const last = points[points.length - 1];
    for (const p of pills) {
      const hit = overlap(card, p.poly);
      p.touching = !!hit;
      if (!hit || p.returning) continue;
      const { nx, ny, depth } = hit;
      p.x += nx * depth * PILL_SHARE;
      p.y += ny * depth * PILL_SHARE;
      if (!p.moving) { p.moving = true; p.startedAt = p.lastHit = pillClock; }
      if (!dragging) {
        // Il cartellino rimbalza indietro (in scena la y va verso l'alto)
        const back = depth * (1 - PILL_SHARE) / pillsPxPerUnit;
        last.pos.x -= nx * back;
        last.pos.y += ny * back;
      }
      const rvx = cvx - p.vx, rvy = cvy - p.vy;
      const rn = rvx * nx + rvy * ny;
      if (rn <= 0) continue; // si stanno già allontanando
      // Solo un colpo vero fa ripartire il conto alla rovescia del
      // rientro: il cartellino tenuto sopra (anche col dito che trema
      // un po') non lo rinnova
      if (rn > 2) p.lastHit = pillClock;
      const tx = -ny, ty = nx;
      const rt = rvx * tx + rvy * ty;
      const jx = nx * rn * (1 + PILL_BOUNCE) * PILL_SHARE + tx * rt * 0.25;
      const jy = ny * rn * (1 + PILL_BOUNCE) * PILL_SHARE + ty * rt * 0.25;
      p.vx += jx; p.vy += jy;
      // Colpita lontano dal centro, la pillola gira
      const c = contactPoint(card, p.poly);
      const rx = c.x - (p.hx + p.x), ry = c.y - (p.hy + p.y);
      p.va = THREE.MathUtils.clamp(p.va + (rx * jy - ry * jx) * 0.00018, -0.25, 0.25);
      // Si schiaccia nel verso del colpo (positivo = più larga e più bassa)
      const strength = Math.hypot(jx, jy);
      const vertical = Math.abs(ny * Math.cos(p.a) - nx * Math.sin(p.a)) > 0.5;
      p.vs += Math.min(strength * 0.012, 0.1) * (vertical ? 1 : -1);
      if (strength > 1.5) pulse(p, strength);
    }

    // Pillole contro pillole, a catena
    for (let i = 0; i < pills.length; i++) {
      for (let k = i + 1; k < pills.length; k++) {
        const A = pills[i], B = pills[k];
        if (!A.moving && !B.moving) continue;
        if (A.returning || B.returning) continue;
        const hit = overlap(pillPolygon(A), pillPolygon(B));
        if (!hit) continue;
        const { nx, ny, depth } = hit;
        A.x -= nx * depth / 2; A.y -= ny * depth / 2;
        B.x += nx * depth / 2; B.y += ny * depth / 2;
        const rn = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
        if (rn <= 0) continue;
        const j = rn * (1 + 0.4) / 2;
        A.vx -= nx * j; A.vy -= ny * j;
        B.vx += nx * j; B.vy += ny * j;
        B.va += (A.x - B.x > 0 ? -1 : 1) * j * 0.01;
        // Colpita di rimbalzo, rientra insieme a chi l'ha colpita
        for (const [P, Q] of [[A, B], [B, A]]) {
          if (!P.moving) { P.moving = true; P.lastHit = Q.lastHit; P.startedAt = Q.startedAt; }
        }
        if (j > 1.5) { pulse(A, j); pulse(B, j); }
      }
    }

    // Molle verso il posto
    for (const p of pills) {
      if (!p.moving) continue;
      if (p.returning) {
        // Rientro senza oscillare: molla più forte e molto smorzata
        p.vx = (p.vx - p.x * 0.06) * 0.7;
        p.vy = (p.vy - p.y * 0.06) * 0.7;
        p.va = (p.va - p.a * 0.08) * 0.7;
        p.vs = (p.vs - p.s * 0.08) * 0.7;
        p.x += p.vx; p.y += p.vy; p.a += p.va; p.s += p.vs;
        const home = Math.abs(p.x) + Math.abs(p.y) < 0.3 && Math.abs(p.a) + Math.abs(p.s) < 0.002;
        if (home || pillClock - p.returnAt > PILL_SNAP_STEPS) {
          p.x = p.y = p.vx = p.vy = p.a = p.va = p.s = p.vs = 0;
          p.moving = false;
          // Resta "fantasma" finché il cartellino non se ne va, così
          // rimetterlo giù fermo sopra di lei non la ricolpisce
          p.returning = p.touching;
        }
        continue;
      }
      p.vx = (p.vx - p.x * PILL_SPRING) * PILL_DAMPING;
      p.vy = (p.vy - p.y * PILL_SPRING) * PILL_DAMPING;
      p.x = THREE.MathUtils.clamp(p.x + p.vx, -PILL_MAX_X, PILL_MAX_X);
      p.y = THREE.MathUtils.clamp(p.y + p.vy, -PILL_MAX_Y, PILL_MAX_Y);
      // I bordi dello schermo fanno da sponda: la pillola rimbalza
      const minX = p.w / 2 + 4 - p.hx, maxX = width - p.w / 2 - 4 - p.hx;
      if (p.x < minX) { p.x = minX; p.vx = Math.abs(p.vx) * 0.5; p.va -= p.vy * 0.004; }
      else if (p.x > maxX) { p.x = maxX; p.vx = -Math.abs(p.vx) * 0.5; p.va += p.vy * 0.004; }
      p.va = (p.va - p.a * PILL_ANGLE_SPRING) * PILL_ANGLE_DAMPING;
      p.a = THREE.MathUtils.clamp(p.a + p.va, -PILL_MAX_ANGLE, PILL_MAX_ANGLE);
      p.vs = (p.vs - p.s * 0.22) * 0.78;
      p.s = THREE.MathUtils.clamp(p.s + p.vs, -0.15, 0.15);
      const still = Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.vx) + Math.abs(p.vy) < 0.05 &&
        Math.abs(p.a) + Math.abs(p.va) + Math.abs(p.s) + Math.abs(p.vs) < 0.001;
      if (still) {
        p.x = p.y = p.vx = p.vy = p.a = p.va = p.s = p.vs = 0;
        p.moving = false;
      }
    }
    // Una pillola già a posto ma "fantasma" torna a urtare quando il
    // cartellino si è staccato
    for (const p of pills) {
      if (!p.moving && p.returning && !p.touching) p.returning = false;
    }
  }

  // Le pillole si spostano solo con transform: niente ricalcolo del layout
  function drawPills() {
    for (const p of pills) {
      if (!p.moving && !p.el.style.transform) continue;
      p.el.style.transform = p.moving
        ? `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) rotate(${p.a.toFixed(4)}rad) scale(${(1 + p.s).toFixed(3)}, ${(1 - p.s).toFixed(3)})`
        : '';
    }
  }

  function step() {
    if (!prefersReducedMotion || dragging) simulate();

    if (spinVelocity !== 0) {
      spinAngle += spinVelocity;
      spinVelocity *= SPIN_DAMPING;
      if (Math.abs(spinVelocity) < 0.0008) spinVelocity = 0;
    } else if (spinAngle !== 0) {
      /* Spin esaurito: spinAngle e' rimasto a un valore qualsiasi di radianti
         (non necessariamente un giro completo), quindi il cartellino
         resterebbe girato a caso invece di tornare a fronte in avanti. Lo si
         completa fino al PROSSIMO multiplo di 2*PI nella stessa direzione in
         cui stava già girando (mai al multiplo precedente, altrimenti si
         vedrebbe tornare indietro): visivamente e' lo stesso orientamento
         "a riposo" di sempre, raggiunto continuando il giro in corso. */
      const turns = spinAngle / (Math.PI * 2);
      const nextTurn = spinAngle >= 0 ? Math.ceil(turns) : Math.floor(turns);
      const target = nextTurn * Math.PI * 2;
      const diff = target - spinAngle;
      if (Math.abs(diff) < 0.002) spinAngle = 0;
      else spinAngle += diff * SPIN_SETTLE_EASE;
    }

    placeCard();
    stepPills();
  }

  function animate(now) {
    requestAnimationFrame(animate);
    if (!visible) { lastTime = now; return; }

    accumulator += Math.min(now - lastTime, STEP_MS * MAX_STEPS);
    lastTime = now;
    let steps = 0;
    while (accumulator >= STEP_MS && steps < MAX_STEPS) {
      step();
      accumulator -= STEP_MS;
      steps++;
    }
    if (steps === 0 && !dragging) return; // niente di nuovo da disegnare

    // Il rimbalzo sulle pillole può aver spostato il cartellino dopo placeCard
    placeCard();
    updateStrap();
    placeShadow();
    drawPills();

    renderer.render(scene, camera);
    if (pointerInside) updateHover();
  }

  /* Fuori viewport non si simula né si disegna: libera GPU/CPU per il
     resto della pagina. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
    }).observe(container);
  }

  onResize();
  requestAnimationFrame(animate);
})();
