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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
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
  function updateAnchorX() {
    const dist = camera.position.z;
    const halfHeight = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfWidth = halfHeight * camera.aspect;
    // Su mobile (vedi style.css) il cartellino ha una fascia tutta sua sopra
    // il titolo: lì sta meglio centrato.
    if (container.clientWidth <= 980) { ANCHOR.x = 0; return; }
    ANCHOR.x = THREE.MathUtils.clamp(halfWidth * 0.62, 0.5, 3.2);
  }
  updateAnchorX();
  const GRAVITY_Y = -0.03;
  const DAMPING = 0.98;

  const points = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const y = prefersReducedMotion ? ANCHOR.y - i * REST_LEN : ANCHOR.y - i * 0.06;
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
        const diff = (dist - REST_LEN) / dist;
        const ox = dx * 0.5 * diff, oy = dy * 0.5 * diff, oz = dz * 0.5 * diff;
        if (!a.pinned) { a.pos.x += ox; a.pos.y += oy; a.pos.z += oz; }
        if (!b.pinned) { b.pos.x -= ox; b.pos.y -= oy; b.pos.z -= oz; }
      }
    }
  }

  /* ---------------- laccetto (mesh) ---------------- */
  const strapMaterial = new THREE.MeshStandardMaterial({ color: 0x3b4b99, roughness: 0.65, metalness: 0.05 });
  let strapMesh = null;
  const strapCurvePts = points.map(p => p.pos.clone());
  const strapCurve = new THREE.CatmullRomCurve3(strapCurvePts);
  function updateStrap() {
    for (let i = 0; i < points.length; i++) strapCurvePts[i].copy(points[i].pos);
    const curve = strapCurve;
    const geo = new THREE.TubeGeometry(curve, 24, 0.055, 8, false);
    if (strapMesh) {
      strapMesh.geometry.dispose();
      strapMesh.geometry = geo;
    } else {
      strapMesh = new THREE.Mesh(geo, strapMaterial);
      scene.add(strapMesh);
    }
  }

  /* ---------------- moschettone ---------------- */
  const clipMaterial = new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.4, metalness: 0.3 });
  const clipGroup = new THREE.Group();
  clipGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), clipMaterial));
  const clipTab = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), clipMaterial);
  clipTab.position.y = -0.18;
  clipGroup.add(clipTab);
  scene.add(clipGroup);

  /* ---------------- cartellino ---------------- */
  const CARD_W = 2.05, CARD_H = 2.7, CARD_D = 0.1;
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xefebe2, roughness: 0.9 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.9 });
  const frontMat = new THREE.MeshStandardMaterial({ color: 0xefebe2, roughness: 0.55 });
  const cardGeo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D);
  const cardMesh = new THREE.Mesh(cardGeo, [sideMat, sideMat, sideMat, sideMat, frontMat, backMat]);
  /* Il cartellino è figlio del gruppo, spostato in basso rispetto
     all'origine: l'origine del gruppo è il punto di aggancio al laccetto
     (lo stesso punto dove sta il moschettone), non il centro del
     cartellino. Così qualsiasi rotazione applicata al gruppo (oscillazione,
     spin, ecc.) avviene attorno al punto di aggancio, che quindi non si
     sposta mai: il moschettone non può più "staccarsi" dal cartellino. */
  cardMesh.position.y = -(CARD_H * 0.5 + 0.28);
  const cardGroup = new THREE.Group();
  cardGroup.add(cardMesh);
  scene.add(cardGroup);

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCover(ctx, img, w, h) {
    const ir = img.width / img.height, cr = w / h;
    let sw, sh, sx, sy;
    if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  }

  const loader = new THREE.ImageLoader();
  loader.load('assets/images/VITO.JPG', (img) => {
    const w = 512, h = Math.round(512 * (CARD_H / CARD_W));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#EFEBE2';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    roundRectPath(ctx, 6, 6, w - 12, h - 12, 26);
    ctx.clip();
    drawCover(ctx, img, w, h);
    ctx.restore();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#F7F5F0';
    roundRectPath(ctx, 6, 6, w - 12, h - 12, 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#17140F';
    ctx.arc(w / 2, 26, 7, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    frontMat.map = tex;
    frontMat.color.set(0xffffff);
    frontMat.needsUpdate = true;
  });

  /* ---------------- resize ---------------- */
  function onResize() {
    width = container.clientWidth; height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    updateAnchorX();
  }
  new ResizeObserver(onResize).observe(container);

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

  function onPointerMove(e) {
    if (!dragging) return;
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

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);

  /* ---------------- loop ---------------- */
  function animate() {
    requestAnimationFrame(animate);

    const last = points[points.length - 1];

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

    updateStrap();

    const prev = points[points.length - 2];
    const dir = new THREE.Vector3().subVectors(last.pos, prev.pos).normalize();

    clipGroup.position.copy(last.pos);

    /* Il gruppo del cartellino sta sempre nello stesso punto del
       moschettone: e' il cartellino (figlio, spostato in basso) a ruotarci
       attorno, quindi il punto di aggancio non si sposta mai. */
    cardGroup.position.copy(last.pos);

    cardGroup.rotation.z = Math.atan2(dir.x, -dir.y);
    cardGroup.rotation.y = THREE.MathUtils.clamp(-dir.x * 0.6, -0.5, 0.5) + spinAngle;

    renderer.render(scene, camera);
  }

  onResize();
  animate();
})();
