document.addEventListener('DOMContentLoaded', () => {
  const imageFolder = 'Pictures/gallery/';
  const imageList = [
    '1.jpg','2.jpg','3.jpg','4.jpg','5.JPG','6.JPG','7.JPG','8.JPG','9.JPG','10.JPG',
    '11.JPG','12.JPG','13.JPG','14.JPG','15.JPG','16.PNG','17.JPG','18.jpg','19.jpg','20.JPG',
    '21.JPG','22.jpg','23.jpg','24.jpg','25.jpg','26.jpg','27.jpg','28.jpg','29.jpg','30.jpg',
    '31.jpg','32.jpg','33.jpg','34.jpg','35.jpg','36.jpg','37.jpg','38.jpg','39.jpg','40.jpg',
    '41.jpg','42.jpg','43.jpg','44.jpg'
  ];
  // Build the masonry images
  const galleryGrid = document.querySelector('.gallery-grid');
  imageList.forEach((filename, i) => {
    const img = document.createElement('img');
    img.src = `${imageFolder}${filename}`;
    img.alt = `Gallery image ${i + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.index = i;
    img.style.cursor = 'zoom-in';
    galleryGrid.appendChild(img);
  });

  // ------- Lightbox logic -------
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbStage = document.getElementById('lb-stage');
  const lbCaption = document.getElementById('lb-caption');
  const btnClose = lb.querySelector('.lb-close');
  const btnPrev  = lb.querySelector('.lb-prev');
  const btnNext  = lb.querySelector('.lb-next');

  let current = 0;
  let zoom = 1;           // 1 or 2
  let panX = 0, panY = 0; // current translate
  let startX = 0, startY = 0; // drag start
  let dragging = false;

  function filenameToCaption(name) {
    // Nice caption from filename (e.g., "16.PNG" -> "16")
    return name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g,' ').trim();
  }

  function openLightbox(index) {
    current = index;
    setImage(current);
    lb.classList.add('open');
    lb.setAttribute('aria-hidden','false');
    btnClose.focus({preventScroll:true});
    document.body.style.overflow = 'hidden'; // prevent background scroll
  }

  function closeLightbox() {
    lb.classList.remove('open','zoomed');
    lb.setAttribute('aria-hidden','true');
    zoom = 1; panX = 0; panY = 0;
    applyTransform();
    document.body.style.overflow = '';
  }

function setImage(index) {
  const src = imageFolder + imageList[index];
  lbImg.src = src;
  lbImg.alt = `Gallery image ${index + 1}`;
  lbCaption.textContent = filenameToCaption(imageList[index]);

  // reset zoom/pan
  zoom = 1; panX = 0; panY = 0;
  lb.classList.remove('zoomed');
  applyTransform();

  // ensure tall/contained layout after image loads
  lbImg.onload = () => {
    lbStage.style.maxHeight = '90vh';
    lbImg.style.maxHeight = '90vh';
  };

  preload(index + 1);
  preload(index - 1);
}


  function preload(i) {
    if (i < 0 || i >= imageList.length) return;
    const temp = new Image();
    temp.src = imageFolder + imageList[i];
  }

  function next() {
    current = (current + 1) % imageList.length;
    setImage(current);
  }
  function prev() {
    current = (current - 1 + imageList.length) % imageList.length;
    setImage(current);
  }

  function toggleZoom(cx, cy) {
    if (zoom === 1) {
      zoom = 2;
      // center zoom around click point: compute relative offset
      const rect = lbStage.getBoundingClientRect();
      const offsetX = cx - rect.left - rect.width  / 2;
      const offsetY = cy - rect.top  - rect.height / 2;
      panX = -offsetX / 2; // divide by scale to feel centered
      panY = -offsetY / 2;
      lb.classList.add('zoomed');
    } else {
      zoom = 1; panX = 0; panY = 0;
      lb.classList.remove('zoomed');
    }
    applyTransform();
  }

  function applyTransform() {
    lbImg.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`;
  }

  // Drag-to-pan when zoomed
  function startDrag(x, y) {
    if (zoom === 1) return;
    dragging = true;
    startX = x - panX;
    startY = y - panY;
  }
  function moveDrag(x, y) {
    if (!dragging) return;
    panX = x - startX;
    panY = y - startY;
    applyTransform();
  }
  function endDrag() { dragging = false; }

  // Wire up gallery clicks
  galleryGrid.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) return;
    const index = parseInt(img.dataset.index, 10);
    flyOpenFromThumb(img, index);
  });

  function flyOpenFromThumb(thumbEl, index) {
    const rect = thumbEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Target “contained” size (matches your lightbox: max 80vw / 1100px, 90vh)
    const maxW = Math.min(vw * 0.80, 1100);
    const maxH = vh * 0.90;

    const ar = (thumbEl.naturalWidth && thumbEl.naturalHeight)
      ? thumbEl.naturalWidth / thumbEl.naturalHeight
      : (rect.width / rect.height || 1);

    let finalW = maxW;
    let finalH = finalW / ar;
    if (finalH > maxH) {
      finalH = maxH;
      finalW = maxH * ar;
    }
    const targetLeft = (vw - finalW) / 2;
    const targetTop  = (vh - finalH) / 2;

    // Create overlay + clone
    const overlay = document.createElement('div');
    overlay.className = 'fly-overlay';

    const clone = thumbEl.cloneNode(true);
    clone.className = 'fly-clone';
    Object.assign(clone.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      opacity: '1'
    });

    document.body.appendChild(overlay);
    document.body.appendChild(clone);

    // Start animations on next frame
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      Object.assign(clone.style, {
        top: `${targetTop}px`,
        left: `${targetLeft}px`,
        width: `${finalW}px`,
        height: `${finalH}px`
      });
    });

    // When clone finishes moving, open the real lightbox and clean up
    const onDone = () => {
      clone.removeEventListener('transitionend', onDone);
      openLightbox(index);          // your existing function
      clone.remove();
      overlay.remove();
    };
    clone.addEventListener('transitionend', onDone);
  }

  // Controls
  btnClose.addEventListener('click', closeLightbox);
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);
  lb.addEventListener('click', (e) => {
    // click outside image closes
    if (e.target === lb) closeLightbox();
  });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  // Zoom toggle (double-click / double-tap)
  let lastTap = 0;
  lbStage.addEventListener('dblclick', (e) => toggleZoom(e.clientX, e.clientY));
  lbStage.addEventListener('click', (e) => {
    const now = Date.now();
    if (now - lastTap < 300) { // double-tap
      toggleZoom(e.clientX, e.clientY);
    }
    lastTap = now;
  });

  // Mouse drag
  lbStage.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);

  // Touch drag (pointer events)
  lbStage.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, {passive:true});
  lbStage.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, {passive:true});
  lbStage.addEventListener('touchend', endDrag);

  let lastThumbEl = null; // remember which thumbnail we opened from

function computeCenteredRect(aspect) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const maxW = Math.min(vw * 0.80, 1100);
  const maxH = vh * 0.90;
  let width = maxW, height = width / aspect;
  if (height > maxH) { height = maxH; width = maxH * aspect; }
  return {
    width, height,
    left: (vw - width) / 2,
    top:  (vh - height) / 2
  };
}

});

