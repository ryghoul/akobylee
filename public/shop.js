
(function () {
  const galleries = new Map();

  function initGallery(galleryEl) {
    const productKey = galleryEl.dataset.product;
    const track = galleryEl.querySelector('.pg-track');
    const viewport = galleryEl.querySelector('.pg-viewport');
    const allImgs = Array.from(track.querySelectorAll('img'));
    const prevBtn = galleryEl.querySelector('.pg-prev');
    const nextBtn = galleryEl.querySelector('.pg-next');
    const select = document.querySelector(`.variant-select[data-product="${productKey}"]`);

    const state = {
      productKey,
      index: 0,
      variant: select ? select.value : null,
      allImgs,
      track
    };
    galleries.set(productKey, state);

    function getSet() {
      if (!state.variant) return state.allImgs;
      const match = state.allImgs.filter(img => (img.dataset.variant || '') === state.variant);
      return match.length ? match : state.allImgs.filter(img => !img.dataset.variant);
    }

    function rebuildTrack() {
      const set = getSet();
      state.track.innerHTML = '';
      set.forEach(img => state.track.appendChild(img));
      state.index = Math.min(state.index, Math.max(0, set.length - 1));
      applyTransform();
    }

    function applyTransform() {
      const setLen = state.track.children.length || 1;
      if (state.index < 0) state.index = setLen - 1;
      if (state.index >= setLen) state.index = 0;
      state.track.style.transform = `translateX(-${state.index * 100}%)`;
    }

    // Cross-fade helper for option changes
    function crossFadeToNewVariant(newVariant) {
      // overlay with current visible slide
      const imgs = Array.from(state.track.children);
      const current = imgs[state.index] || imgs[0];
      if (current && viewport) {
        const fader = document.createElement('div');
        fader.className = 'pg-fader';
        const clone = current.cloneNode(true);
        fader.appendChild(clone);
        viewport.appendChild(fader);

        // swap underneath
        state.variant = newVariant;
        state.index = 0;
        rebuildTrack();

        // fade overlay out, then remove
        requestAnimationFrame(() => { fader.style.opacity = '0'; });
        fader.addEventListener('transitionend', () => fader.remove(), { once: true });
      } else {
        state.variant = newVariant;
        state.index = 0;
        rebuildTrack();
      }
    }

    // init
    rebuildTrack();

    // arrows
    prevBtn?.addEventListener('click', () => {
      state.index -= 1;
      applyTransform();
    });
    nextBtn?.addEventListener('click', () => {
      state.index += 1;
      applyTransform();
    });

    // variant change WITH fade
    if (select) {
      select.addEventListener('change', (e) => {
        crossFadeToNewVariant(e.target.value);
      });
    }

    // drag / swipe
    let startX = null, lastX = null, dragging = false;

    function onStart(e) {
      dragging = true;
      startX = lastX = (e.touches ? e.touches[0].clientX : e.clientX);
      state.track.style.transition = 'none';
    }
    function onMove(e) {
      if (!dragging) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      const dx = x - startX;
      lastX = x;
      state.track.style.transform = `translateX(calc(${-state.index * 100}% + ${dx}px))`;
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      const dx = lastX - startX;
      state.track.style.transition = ''; // restore CSS transition
      const threshold = 40;
      if (dx > threshold) state.index -= 1;
      else if (dx < -threshold) state.index += 1;
      applyTransform();
    }

    viewport.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    viewport.addEventListener('touchstart', onStart, { passive: true });
    viewport.addEventListener('touchmove', onMove, { passive: true });
    viewport.addEventListener('touchend', onEnd);
  }

  document.querySelectorAll('.product-gallery').forEach(initGallery);
})();

