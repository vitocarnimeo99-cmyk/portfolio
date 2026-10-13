// ============ Pillow pack 3D (busta sticker WKZ) ============
// Richiede il global THREE caricato prima di questo script (build UMD non-module,
// cosi' la pagina funziona anche aperta come file:// senza server locale).
(function () {
  const container = document.getElementById('wkz-pack');
  if (!container || !window.WebGLRenderingContext) return;

  const shadowEl = document.getElementById('wkz-pack-shadow');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = container.clientWidth || 300;
  let height = container.clientHeight || 390;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
  camera.position.set(0, 0, 8.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  /* Il colore di base è "unlit" (vedi MeshBasicMaterial più sotto): il jpg
     si vede sempre identico, non modulato da luci o tone mapping. Queste
     luci servono solo a disegnare il riflesso sulla mesh "sheen" sovrapposta
     (vedi sotto), quindi possiamo tenerle vivaci senza rischio di ritingere
     l'immagine. */
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(3, 5, 6);
  scene.add(key);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.32);
  fillLight.position.set(-4, -2, 4);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.32);
  rimLight.position.set(-1, -3, -6);
  scene.add(rimLight);

  /* ---------------- geometria "a cuscino" ---------------- */
  /* La busta è un piano deformato in Z: rettangolo con angoli arrotondati,
     bordo piatto (il lembo termosaldato) e un rigonfiamento centrale morbido.
     Usiamo la signed distance function di un rettangolo arrotondato per
     ricavare, per ogni vertice, la distanza dal bordo: quella distanza guida
     sia la sagoma (angoli arrotondati) sia il rilievo (piatto vicino al
     bordo, a cupola verso il centro). */
  const PACK_W = 2.6;
  const PACK_H = PACK_W * (3898 / 3000); // stesso rapporto delle immagini fronte/retro
  const PACK_DEPTH = 0.42;
  const CORNER_R = 0.4;
  const SEAL_WIDTH = 0.07;
  const SEG_X = 48, SEG_Y = 62;

  function roundedRectDist(x, y, halfW, halfH, r) {
    const qx = Math.abs(x) - (halfW - r);
    const qy = Math.abs(y) - (halfH - r);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;
  }

  function reshapeCorner(x, y, halfW, halfH, r) {
    const sx = x < 0 ? -1 : 1, sy = y < 0 ? -1 : 1;
    const ax = Math.abs(x), ay = Math.abs(y);
    const qx = ax - (halfW - r), qy = ay - (halfH - r);
    if (qx > 0 && qy > 0) {
      const dist = Math.sqrt(qx * qx + qy * qy);
      if (dist > r) {
        const scale = r / dist;
        return [sx * (halfW - r + qx * scale), sy * (halfH - r + qy * scale)];
      }
    }
    return [x, y];
  }

  function smoothstep(edge0, edge1, x) {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function buildPillowGeometry(sign) {
    const halfW = PACK_W / 2, halfH = PACK_H / 2;
    const geo = new THREE.PlaneGeometry(PACK_W, PACK_H, SEG_X, SEG_Y);
    const pos = geo.attributes.position;
    const refDist = Math.min(halfW, halfH);
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x0 = pos.getX(i), y0 = pos.getY(i);
      const d = roundedRectDist(x0, y0, halfW, halfH, CORNER_R);
      const [x1, y1] = reshapeCorner(x0, y0, halfW, halfH, CORNER_R);
      const inset = Math.max(0, -d);
      const t = THREE.MathUtils.clamp(inset / refDist, 0, 1);
      const seal = smoothstep(0, SEAL_WIDTH, t);
      const dome = Math.sin(Math.min(t, 1) * Math.PI * 0.5);
      const z = sign * PACK_DEPTH * seal * dome;
      pos.setXYZ(i, x1, y1, z);

      /* Ombreggiatura "baked" (finta AO): il lembo termosaldato e la curva
         appena sopra restano piatti, quindi non catturano luce come il
         rigonfiamento centrale. Scuriamo quella fascia in base alla stessa
         distanza dal bordo già usata per il rilievo, cosi' il volume si
         legge anche se il materiale del fronte/retro resta "unlit". */
      const rim = 1 - smoothstep(0, 0.55, t);
      const ao = THREE.MathUtils.clamp(1 - rim * 0.45 - (1 - seal) * 0.2, 0.4, 1);
      colors[i * 3] = ao;
      colors[i * 3 + 1] = ao;
      colors[i * 3 + 2] = ao;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    /* Il retro specchia la U direttamente sulla mesh (invece di usare
       RepeatWrapping+offset sulla texture): cosi' la texture resta sempre
       CLAMP_TO_EDGE, senza dipendere da un modo di wrapping che alcuni
       motori WebGL applicano in modo incoerente sulle texture NPOT. */
    if (sign < 0) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setX(i, 1 - uv.getX(i));
      }
      uv.needsUpdate = true;
    }

    /* Fronte e retro nascono dalla stessa griglia (winding invariato): senza
       invertire l'ordine dei vertici del retro, le sue normali punterebbero
       nella stessa direzione locale del fronte invece che verso l'esterno,
       facendo sparire entrambe le facce (culling) non appena la busta viene
       ruotata oltre i ~90°. */
    if (sign < 0) {
      const idx = geo.index;
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1);
        const c = idx.getX(i + 2);
        idx.setX(i + 1, c);
        idx.setX(i + 2, b);
      }
      idx.needsUpdate = true;
    }

    geo.computeVertexNormals();
    return geo;
  }

  const frontGeo = buildPillowGeometry(1);
  const backGeo = buildPillowGeometry(-1);

  /* ---------------- ombra colorata sotto la busta ---------------- */
  /* Campiona il colore medio della texture fronte per tingere il gradiente
     dell'ombra (vedi .wkz-pack-shadow in style.css) invece di lasciarla
     grigia: cosi' riprende i colori della grafica della busta stessa. Il
     campionamento passa da un <canvas>, che su file:// puo' risultare
     "tainted" e bloccare getImageData: in quel caso teniamo semplicemente il
     grigio di default già definito in CSS. */
  if (shadowEl) {
    const sampleImg = new Image();
    sampleImg.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const ctx = c.getContext('2d');
        ctx.drawImage(sampleImg, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        /* Scuriamo parecchio il colore campionato (l'ombra deve leggersi come
           ombra, non come una macchia colorata chiara): lo tingiamo verso il
           nero mantenendo solo una traccia della tinta della busta. */
        const dr = Math.min(255, Math.round(r * 0.35 + 70)), dg = Math.round(g * 0.3), db = Math.round(b * 0.3);
        shadowEl.style.setProperty('--wkz-shadow-c1', `rgba(${dr},${dg},${db},0.85)`);
        shadowEl.style.setProperty('--wkz-shadow-c2', `rgba(${dr},${dg},${db},0.45)`);
      } catch (e) {
        /* canvas tainted (file://) o altro errore: resta il grigio di default */
      }
    };
    sampleImg.src = 'assets/images/wkz-web/SHOP/SHOP_FRONTE_3D.jpg';
  }

  const loader = new THREE.TextureLoader();
  const frontTex = loader.load('assets/images/wkz-web/SHOP/SHOP_FRONTE_3D.jpg');
  const backTex = loader.load('assets/images/wkz-web/SHOP/SHOP_RETRO_3D.jpg');
  /* minFilter/generateMipmaps espliciti: le immagini non sono POT (potenza
     di due), e su alcuni motori WebGL il mipmapping automatico su texture
     NPOT non viene generato in modo affidabile, lasciando la mesh senza
     immagine. LinearFilter senza mipmap funziona in modo identico ovunque
     per una texture che non si rimpicciolisce mai molto. Lo specchiamento
     del retro è ora fatto sulle UV della mesh (vedi buildPillowGeometry),
     quindi qui basta il wrapping di default (ClampToEdge). */
  [frontTex, backTex].forEach((tex) => {
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
  });

  /* Il colore di base è "unlit" (MeshBasicMaterial): mostra il jpg tale e
     quale, senza che luci/tone mapping lo modulino o lo tingano. I riflessi
     vivono in una seconda mesh trasparente sovrapposta, nera con solo
     clearcoat/specular: in blending additivo somma luce bianca sopra il
     colore invece di mescolarsi con esso, quindi si vede il "lucido" senza
     alterare mai i colori dell'immagine sotto. */
  const frontMat = new THREE.MeshBasicMaterial({ map: frontTex, toneMapped: false, vertexColors: true });
  const backMat = new THREE.MeshBasicMaterial({ map: backTex, toneMapped: false, vertexColors: true });

  const sheenOpts = {
    color: 0x000000,
    roughness: 0.25,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  };
  const frontSheenMat = new THREE.MeshPhysicalMaterial(sheenOpts);
  const backSheenMat = new THREE.MeshPhysicalMaterial(sheenOpts);

  const packGroup = new THREE.Group();
  packGroup.add(new THREE.Mesh(frontGeo, frontMat));
  packGroup.add(new THREE.Mesh(backGeo, backMat));
  const frontSheen = new THREE.Mesh(frontGeo, frontSheenMat);
  const backSheen = new THREE.Mesh(backGeo, backSheenMat);
  frontSheen.renderOrder = 1;
  backSheen.renderOrder = 1;
  packGroup.add(frontSheen, backSheen);
  packGroup.rotation.y = 0.32;
  packGroup.rotation.x = -0.08;
  scene.add(packGroup);

  /* ---------------- resize ---------------- */
  function onResize() {
    width = container.clientWidth; height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  new ResizeObserver(onResize).observe(container);

  /* ---------------- drag per ruotare la busta in mano ---------------- */
  let rotY = packGroup.rotation.y, rotX = packGroup.rotation.x;
  const REST_ROT_X = rotX;
  let velY = 0, velX = 0;
  let dragging = false, lastX = 0, lastY = 0;

  function onPointerDown(e) {
    dragging = true;
    velY = 0; velX = 0;
    container.classList.add('is-dragging');
    lastX = e.clientX; lastY = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velY = dx * 0.008;
    velX = dy * 0.008;
    rotY += velY;
    rotX = THREE.MathUtils.clamp(rotX + velX, -0.6, 0.6);
    e.preventDefault();
  }

  function onPointerUp() {
    dragging = false;
    container.classList.remove('is-dragging');
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);

  /* ---------------- loop ---------------- */
  function animate() {
    requestAnimationFrame(animate);
    const t = performance.now() * 0.001;

    if (!dragging) {
      velY *= 0.94;
      velX *= 0.94;
      rotY += velY;
      rotX = THREE.MathUtils.clamp(rotX + velX, -0.6, 0.6);
      if (Math.abs(velX) < 0.0003) rotX += (REST_ROT_X - rotX) * 0.02;
      if (!prefersReducedMotion && Math.abs(velY) < 0.0006) rotY += 0.0025;
    }

    packGroup.rotation.y = rotY;
    packGroup.rotation.x = rotX;
    const bobAmp = 0.16;
    const bobY = prefersReducedMotion ? 0 : Math.sin(t * 0.9) * bobAmp;
    packGroup.position.y = bobY;

    /* L'ombra reagisce in controfase al bobbing: quando la busta sale si
       rimpicciolisce e schiarisce (si allontana dal "suolo"), quando scende
       si allarga e scurisce. Resta sempre centrata orizzontalmente sotto
       la busta, qualunque sia la rotazione. */
    if (shadowEl) {
      const liftT = (bobY + bobAmp) / (bobAmp * 2);
      const scale = THREE.MathUtils.lerp(1.15, 0.6, liftT);
      const opacity = THREE.MathUtils.lerp(1, 0.35, liftT);
      shadowEl.style.transform = `translate(-50%, 0) scale(${scale.toFixed(3)})`;
      shadowEl.style.opacity = opacity.toFixed(3);
    }

    renderer.render(scene, camera);
  }

  onResize();
  animate();
})();
