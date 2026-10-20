/* =========================================================
   AKO — index.js
   Index-page JS: landing entry animation, orbit links,
   and mouse parallax effect.
   ========================================================= */

(function () {
  const enterBtn     = document.getElementById('enterBtn');
  const landing      = document.getElementById('landing');
  const home         = document.getElementById('home');
  const flyingLogo   = document.getElementById('flyingLogo');
  const headlineWrap = document.getElementById('headlineWrap');
  const navLogoSlot  = document.getElementById('navLogoSlot');
  const navLinks     = document.getElementById('navLinks');
  const homeContent  = document.getElementById('homeContent');
  const logoBtn      = document.getElementById('logoBtn');

  /* Moved up so the skip block can reference it */
  let parallaxActive = false;

  /* Pre-measure the nav slot at page load by briefly making the home shell
     layout-visible (but it's behind the landing overlay so the user sees nothing).
     This means we never need to reveal home mid-animation just to get coords,
     which was causing the logo button to flash in.                              */
  home.setAttribute('aria-hidden', 'false');
  const toRectCache = navLogoSlot.getBoundingClientRect();
  home.setAttribute('aria-hidden', 'true');

  /* ── Skip landing on return visits ── */
  if (window.akoReturningVisitor) {
    landing.style.display       = 'none';
    home.setAttribute('aria-hidden', 'false');
    logoBtn.style.transition    = 'none';
    logoBtn.style.pointerEvents = 'auto';
    logoBtn.style.opacity       = '1';
    navLinks.classList.add('visible');
    homeContent.classList.add('visible');
    parallaxActive = true;
    positionOrbitLinks();
  }

  /* ── Entry animation ── */
  enterBtn.addEventListener('click', () => {
    enterBtn.disabled = true;

    /* STEP 1: Wipe text left → right */
    headlineWrap.classList.add('wipe-out');

    /* STEP 2: Logo flies to nav after wipe completes (~550ms) */
    setTimeout(() => {

      /* Reveal home shell — logoBtn stays opacity:0 (CSS default) until clone lands */
      home.setAttribute('aria-hidden', 'false');

      const fromRect = flyingLogo.getBoundingClientRect();
      const toRect   = toRectCache;

      const targetH = 56;
      const targetW = targetH * (fromRect.width / fromRect.height);

      flyingLogo.style.visibility = 'hidden';

      const clone = flyingLogo.cloneNode(true);
      clone.removeAttribute('id');
      clone.style.cssText = `
        position: fixed;
        left:   ${fromRect.left}px;
        top:    ${fromRect.top}px;
        width:  ${fromRect.width}px;
        height: ${fromRect.height}px;
        object-fit: contain;
        z-index: 9999;
        pointer-events: none;
        transition: left   0.65s cubic-bezier(0.76,0,0.24,1),
                    top    0.65s cubic-bezier(0.76,0,0.24,1),
                    width  0.65s cubic-bezier(0.76,0,0.24,1),
                    height 0.65s cubic-bezier(0.76,0,0.24,1);
      `;
      document.body.appendChild(clone);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          clone.style.left   = `${toRect.left}px`;
          clone.style.top    = `${toRect.top + (toRect.height - targetH) / 2}px`;
          clone.style.width  = `${targetW}px`;
          clone.style.height = `${targetH}px`;
        });
      });

      setTimeout(() => {
        landing.style.transition = 'opacity 0.4s ease';
        landing.style.opacity    = '0';
      }, 350);

      setTimeout(() => {
        landing.style.display = 'none';

        /* Reveal real button instantly (no transition) BEFORE removing the clone
           so there is never a frame where neither is visible                    */
        logoBtn.style.transition    = 'none';
        logoBtn.style.pointerEvents = 'auto';
        logoBtn.style.opacity       = '1';

        requestAnimationFrame(() => {
          clone.remove();
        });

        navLinks.classList.add('visible');
        homeContent.classList.add('visible');

        positionOrbitLinks();
      }, 750);

    }, 550);
  });

  /* ── Orbit link positioning ── */
  function positionOrbitLinks() {
    const hub   = document.getElementById('hub');
    const links = hub ? hub.querySelectorAll('.orbit-link') : [];
    if (!links.length) return;

    const count  = links.length;
    const radius = window.innerWidth <= 520 ? 48 : 42; /* percent of hub size */

    links.forEach((link, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      const x     = 50 + radius * Math.cos(angle);
      const y     = 50 + radius * Math.sin(angle);
      link.style.left           = `${x}%`;
      link.style.top            = `${y}%`;
      link.style.animationDelay = `${i * 0.08}s`;
    });
  }

  window.addEventListener('resize', () => {
    if (document.getElementById('hub')) positionOrbitLinks();
  });

  /* ── Mouse parallax ── */
  let mouseX = 0, mouseY = 0;
  let currentX = 0, currentY = 0;
  let rafId = null;

  document.addEventListener('mousemove', (e) => {
    if (!parallaxActive) return;
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    if (!rafId) rafId = requestAnimationFrame(tickParallax);
  });

  function tickParallax() {
    rafId = null;
    currentX += (mouseX - currentX) * 0.07;
    currentY += (mouseY - currentY) * 0.07;

    const hub     = document.getElementById('hub');
    const homeNav = document.querySelector('.home-nav');
    const bgVideo = document.querySelector('.bg-video');

    if (hub)     hub.style.transform     = `translate(${currentX * 18}px, ${currentY * 14}px)`;
    if (homeNav) homeNav.style.transform = `translate(${currentX *  6}px, ${currentY *  4}px)`;
    if (bgVideo) bgVideo.style.transform = `translate(${currentX * -8}px, ${currentY * -6}px) scale(1.06)`;

    if (Math.abs(mouseX - currentX) > 0.001 || Math.abs(mouseY - currentY) > 0.001) {
      rafId = requestAnimationFrame(tickParallax);
    }
  }

  /* Activate parallax once home content is visible */
  const visibleObserver = new MutationObserver(() => {
    if (homeContent.classList.contains('visible')) {
      parallaxActive = true;
      visibleObserver.disconnect();
    }
  });
  visibleObserver.observe(homeContent, { attributes: true, attributeFilter: ['class'] });

})();
