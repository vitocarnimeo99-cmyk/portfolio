// Caroselli della pagina progetto: scroll-snap nativo pilotato dai pulsanti
// prev/next, con loop infinito anche trascinando/scorrendo a mano. Per farlo
// senza reimplementare lo scroll nativo, cloniamo l'intera sequenza reale sia
// prima che dopo di essa: track = [copia][reali][copia]. Cosi', anche vicino
// ai due bordi (es. sull'ultima slide), si vedono gia' fisicamente le slide
// successive che "sbirciano" in coda (non solo la prima, anche la seconda,
// la terza...), e lo scroll puo' proseguire nella stessa direzione oltre il
// bordo. Quando l'utente si ferma su una copia, lo riportiamo (senza
// animazione, quindi invisibile) sulla slide reale corrispondente.
// Il contatore segue la slide il cui bordo sinistro e' piu' vicino allo
// scroll corrente (coerente con scroll-snap-align:start), invece che un
// IntersectionObserver: su schermi larghi piu' slide superano insieme la
// soglia di visibilita' e l'ultima osservata "vince" a caso, dando un numero
// sbagliato al primo render.
document.querySelectorAll('[data-carousel]').forEach(carousel => {
  const viewport = carousel.querySelector('.carousel-viewport');
  const track = carousel.querySelector('.carousel-track');
  const realSlides = Array.from(track.children);
  const prevBtn = carousel.querySelector('.prev');
  const nextBtn = carousel.querySelector('.next');
  const curEl = carousel.querySelector('.cur');
  const totEl = carousel.querySelector('.tot');
  const count = realSlides.length;

  // Alcuni caroselli (es. Lip-Sync) fissano quante slide devono stare
  // intere nel viewport (data-visible-slides). La larghezza in CSS non
  // puo' esprimere "esattamente N per riga senza tagli" perche' il track
  // e' largo quanto tutto il contenuto (serve per lo scroll), quindi la
  // calcoliamo qui dalla larghezza reale del viewport e la esponiamo come
  // variabile CSS che .carousel-slide usa per il proprio width.
  const visibleSlides = parseInt(carousel.dataset.visibleSlides, 10);
  if (visibleSlides > 0) {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
    const applySlideWidth = () => {
      const width = (viewport.clientWidth - gap * (visibleSlides - 1)) / visibleSlides;
      carousel.style.setProperty('--slide-w', `${width}px`);
    };
    applySlideWidth();
    window.addEventListener('resize', applySlideWidth);
  }

  if (totEl) totEl.textContent = String(count).padStart(2, '0');
  if (count < 2) return;

  const cloneAll = () => realSlides.map(s => {
    const c = s.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    return c;
  });

  const beforeFrag = document.createDocumentFragment();
  cloneAll().forEach(c => beforeFrag.appendChild(c));
  track.insertBefore(beforeFrag, track.firstChild);
  cloneAll().forEach(c => track.appendChild(c));

  // Con le copie, la slide reale i sta in posizione count+i; le posizioni
  // 0..count-1 sono la copia "prima" (stesso ordine, coincide con la reale
  // i), 2*count..3*count-1 la copia "dopo" (idem, indice i = pos-2*count).
  const slides = Array.from(track.children);
  const toDom = (i) => count + i;
  const toReal = (domIndex) => {
    if (domIndex < count) return domIndex;
    if (domIndex >= 2 * count) return domIndex - 2 * count;
    return domIndex - count;
  };

  // Scroll orizzontale manuale sul solo viewport del carosello: scrollIntoView
  // scrollerebbe anche gli antenati verticali (es. la pagina intera) se la
  // slide non e' ancora visibile, facendo "saltare" la pagina al caricamento
  // quando il carosello si trova piu' in basso nello schermo.
  const scrollToSlide = (slide, behavior) => {
    const left = viewport.scrollLeft + (slide.getBoundingClientRect().left - viewport.getBoundingClientRect().left);
    viewport.scrollTo({ left, behavior });
  };

  let index = 0;
  let domIndex = toDom(0);
  const settle = (di) => {
    scrollToSlide(slides[di], 'auto');
    domIndex = di;
  };
  settle(toDom(0));

  const updateCounter = () => {
    if (curEl) curEl.textContent = String(index + 1).padStart(2, '0');
  };

  // Il contatore si aggiorna subito al click, invece di aspettare la misura
  // via scroll (debounced piu' sotto): su alcuni browser lo smooth scroll
  // programmatico puo' "litigare" con lo scroll-snap e non arrivare mai a
  // riposo esattamente sulla slide target, lasciando il numero bloccato.
  // Ogni click sposta domIndex di una posizione nella track "estesa": se si
  // e' gia' vicino a un bordo, questo fa proseguire lo scroll dentro la
  // copia successiva (1, poi 2, poi 3...) invece di saltare indietro.
  const goTo = (delta) => {
    index = (index + delta + count) % count;
    updateCounter();
    domIndex = Math.min(Math.max(domIndex + delta, 0), slides.length - 1);
    scrollToSlide(slides[domIndex], 'smooth');
  };

  prevBtn && prevBtn.addEventListener('click', () => goTo(-1));
  nextBtn && nextBtn.addEventListener('click', () => goTo(1));

  let scrollTimer = null;
  const syncCounter = () => {
    let closest = 0;
    let minDist = Infinity;
    slides.forEach((slide, i) => {
      const dist = Math.abs(slide.offsetLeft - viewport.scrollLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    index = toReal(closest);
    domIndex = closest;
    if (closest < count || closest >= 2 * count) settle(toDom(index));
    updateCounter();
  };
  viewport.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(syncCounter, 80);
  });
  syncCounter();
});

// I video dei caroselli sono a play manuale (file pesanti, preload="metadata"):
// li mettiamo in pausa quando escono dallo schermo per non lasciarli a girare
// a vuoto fuori vista.
if ('IntersectionObserver' in window) {
  const videoPauseObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) entry.target.pause();
    });
  }, { threshold: 0 });
  document.querySelectorAll('.carousel-slide video').forEach(video => videoPauseObserver.observe(video));
}
