/* =========================================================
   shop.js — Fetches the shop catalog (products + live stock)
   from /api/shop-catalog and renders it, replacing the old
   hardcoded-markup + separate /api/inventory approach.
   ========================================================= */

(function () {

  let catalog = [];        // full product list from the API
  let catalogByKey = {};   // productKey -> product
  let sections = [];       // collections in page order: { key, label, style, order, hidden }

  /* ── Helpers ── */

  function isEditorMode() {
    return document.body.classList.contains('editor-enabled');
  }

  // Shared with script.js (loaded first on every page) rather than
  // redefined here, so there's one escaping implementation to keep correct.
  const escapeHtml = window.AKO.escapeHtml;

  function formatPrice(cents) {
    const dollars = (Number(cents) || 0) / 100;
    return dollars % 1 === 0 ? String(dollars) : dollars.toFixed(2);
  }

  function hexToRgba(hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return `rgba(0,0,0,${alpha})`;
    const int = parseInt(m[1], 16);
    const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function skuFor(product, size) {
    return `${product.productKey}|${size}`;
  }

  function stockLabel(stock) {
    if (typeof stock !== 'number') return { text: '', cls: '' };
    if (stock === 0) return { text: 'Sold out', cls: 'sold-out' };
    if (stock <= 3)  return { text: `Only ${stock} left`, cls: 'low-stock' };
    return             { text: 'In stock', cls: 'in-stock' };
  }

  function slugify(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'section';
  }

  /* ── Card templates (markup/classes match the site's existing CSS exactly) ── */

  function productSizes(p) {
    return Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['NOSIZE'];
  }

  function firstAvailableSize(p, sizes) {
    return sizes.find(s => (p.stock?.[s] ?? 0) > 0) || sizes[0];
  }

  function sizeButtonsHtml(p, sizes, activeSize) {
    return sizes.map(size => {
      const stock = p.stock?.[size] ?? 0;
      const cls = ['sz', size === activeSize ? 'active' : '', stock === 0 ? 'out-of-stock' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="${cls}" data-size="${escapeHtml(size)}" data-sku="${escapeHtml(skuFor(p, size))}">${escapeHtml(size)}</button>`;
    }).join('');
  }

  function renderShirtCard(p) {
    const sizes = productSizes(p);
    const firstAvailable = firstAvailableSize(p, sizes);
    const sizeButtons = sizeButtonsHtml(p, sizes, firstAvailable);

    const initialStock = p.stock?.[firstAvailable] ?? 0;
    const { text: statusText, cls: statusCls } = stockLabel(initialStock);
    const specsHtml = p.specs ? escapeHtml(p.specs).replace(/\n/g, '<br>\n') : '';

    return `
      <div class="shirt-card${p.active === false ? ' shop-card-inactive' : ''}" data-productkey="${escapeHtml(p.productKey)}">
        <div class="shirt-visual">
          <img src="${escapeHtml(p.image || '')}" alt="${escapeHtml(p.name)}" class="shirt-photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
          <div class="shirt-placeholder">👕</div>
          ${p.tagLabel ? `<div class="shirt-tag">${escapeHtml(p.tagLabel)}</div>` : ''}
          <div class="shirt-overlay">
            <div class="overlay-name">${escapeHtml(p.name)}</div>
            <div class="overlay-price">$${formatPrice(p.price)}</div>
            <div class="size-row">${sizeButtons}</div>
            <div class="stock-status${statusCls ? ' ' + statusCls : ''}">${statusText}</div>
            ${specsHtml ? `<div class="shirt-specs">${specsHtml}</div>` : ''}
            <button type="button" class="size-guide-link">Size Guide ↗</button>
            <button type="button" class="overlay-btn add-to-cart" ${initialStock === 0 ? 'disabled' : ''}>Add to cart</button>
          </div>
        </div>
        <div class="shirt-info">
          <span class="shirt-name">${escapeHtml(p.name)}</span>
          <span class="shirt-price">$${formatPrice(p.price)}</span>
        </div>
      </div>`;
  }

  // Bag and bandana cards show size buttons only for multi-size products
  // (e.g. a hoodie in a staff-created section); single-size items need none.
  function renderBagCard(p) {
    const sizes = productSizes(p);
    const size = firstAvailableSize(p, sizes);
    const stock = p.stock?.[size] ?? 0;
    const { text: badgeText, cls: badgeCls } = stockLabel(stock);
    const bg = hexToRgba(p.colorHex, p.colorHex ? 0.12 : 0);

    return `
      <div class="bag-card${p.active === false ? ' shop-card-inactive' : ''}" data-productkey="${escapeHtml(p.productKey)}">
        <div class="bag-visual" style="background:${bg}">
          ${p.colorHex ? `<div class="bag-color-strip" style="background:${escapeHtml(p.colorHex)}"></div>` : ''}
          <img src="${escapeHtml(p.image || '')}" alt="${escapeHtml(p.name)}" class="bag-photo" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
          <span class="bag-placeholder">🛍</span>
        </div>
        <div class="bag-body">
          <div class="bag-name">${escapeHtml(p.name)}</div>
          <div class="bag-desc">${escapeHtml(p.description || '')}</div>
          ${sizes.length > 1 ? `<div class="size-row size-row-light">${sizeButtonsHtml(p, sizes, size)}</div>` : ''}
          <div class="bag-stock-row">
            <span class="stock-badge${badgeCls ? ' ' + badgeCls : ''}">${badgeText}</span>
          </div>
        </div>
        <div class="bag-action">
          <div class="bag-price">$${formatPrice(p.price)}</div>
          <button type="button" class="bag-btn add-to-cart" ${stock === 0 ? 'disabled' : ''}>Add to cart</button>
        </div>
      </div>`;
  }

  function renderBandanaCard(p) {
    const sizes = productSizes(p);
    const size = firstAvailableSize(p, sizes);
    const stock = p.stock?.[size] ?? 0;
    const { text: badgeText, cls: badgeCls } = stockLabel(stock);

    return `
      <div class="bandana-card${p.active === false ? ' shop-card-inactive' : ''}" data-productkey="${escapeHtml(p.productKey)}">
        <div class="bandana-visual" style="background:${escapeHtml(p.colorHex || '#e8e0d4')}">
          <img src="${escapeHtml(p.image || '')}" alt="${escapeHtml(p.name)} bandana" class="bandana-photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
          <div class="bandana-bg">
            <div class="bandana-diamond" style="background:${escapeHtml(p.accentHex || '#1a1a1a')}"></div>
          </div>
        </div>
        <div class="bandana-body">
          <div class="bandana-name">${escapeHtml(p.name)}</div>
          <div class="bandana-desc">${escapeHtml(p.description || '')}</div>
          ${sizes.length > 1 ? `<div class="size-row size-row-light">${sizeButtonsHtml(p, sizes, size)}</div>` : ''}
          <div class="bandana-footer">
            <div>
              <span class="bandana-price">$${formatPrice(p.price)}${p.presale ? ' <span class="presale-tag">presale</span>' : ''}</span>
              <span class="stock-badge${badgeCls ? ' ' + badgeCls : ''}">${badgeText}</span>
            </div>
            <button type="button" class="bandana-btn add-to-cart" ${stock === 0 ? 'disabled' : ''}>Add to cart</button>
          </div>
        </div>
      </div>`;
  }

  // Each collection picks one of three card styles.
  const STYLE_LAYOUTS = {
    grid: { gridClass: 'shirts-grid', render: renderShirtCard, emoji: '👕' },
    row:  { gridClass: 'bags-grid', render: renderBagCard, emoji: '🛍' },
    tile: { gridClass: 'bandana-grid', render: renderBandanaCard, emoji: '🎽' },
  };
  const layoutFor = section => STYLE_LAYOUTS[section?.style] || STYLE_LAYOUTS.row;

  /* ── Rendering orchestration ── */

  function productsBySection() {
    const map = new Map();
    catalog.forEach(p => {
      if (!map.has(p.section)) map.set(p.section, []);
      map.get(p.section).push(p);
    });
    return map;
  }

  // Customers see a collection only if it isn't hidden and has something to
  // buy; staff see every collection, including empty and hidden ones.
  function shownSections(bySection, editor) {
    if (editor) return sections;
    return sections.filter(s => !s.hidden && (bySection.get(s.key) || []).some(p => p.available !== false && p.active !== false));
  }

  function sectionToolsHtml(section, index, count) {
    const name = escapeHtml(section.label);
    return `
      <div class="section-tools">
        <button type="button" class="section-drag" draggable="true" data-section-action="drag" title="Drag to move" aria-label="Drag ${name} to move it">⠿</button>
        <button type="button" data-section-action="up" aria-label="Move ${name} up" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-section-action="down" aria-label="Move ${name} down" ${index === count - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" data-section-action="edit">Rename / style</button>
        <button type="button" data-section-action="delete">Delete</button>
      </div>`;
  }

  function sectionHtml(section, products, editor, index, count) {
    const layout = layoutFor(section);
    const visible = products.filter(p => editor || (p.available !== false && p.active !== false));
    const cards = visible.length ? visible.map(layout.render).join('') : '<p class="shop-empty">Nothing here yet.</p>';
    return `
      <section class="shop-section${section.hidden ? ' shop-section-hidden' : ''}" id="sec-${escapeHtml(slugify(section.key))}" data-section="${escapeHtml(section.key)}">
        <div class="section-header">
          <div class="section-label">${escapeHtml(section.label)}${section.hidden ? ' <span class="section-hidden-tag">Hidden from customers</span>' : ''}</div>
          ${editor ? sectionToolsHtml(section, index, count) : ''}
        </div>
        <div class="${layout.gridClass}">${cards}</div>
      </section>`;
  }

  function activeFilter() {
    return document.querySelector('.filter-row .filter-btn.active')?.dataset.filter || 'all';
  }

  function applyFilter(filter) {
    document.querySelectorAll('.shop-section').forEach(sec => {
      sec.classList.toggle('hidden', filter !== 'all' && filter !== sec.dataset.section);
    });
  }

  function rebuildFilterRow(visibleSections, forceFilter) {
    const row = document.querySelector('.filter-row');
    if (!row) return;
    let current = forceFilter || activeFilter();
    if (current !== 'all' && !visibleSections.some(s => s.key === current)) current = 'all';

    const entries = [{ key: 'all', label: 'All' }, ...visibleSections.map(s => ({ key: s.key, label: s.label.replace(/\s*—.*$/, '') }))];
    row.innerHTML = entries.map(({ key, label }) => {
      const activeCls = key === current ? ' active' : '';
      return `<button type="button" class="filter-btn${activeCls}" data-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
    }).join('');

    row.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilter(btn.dataset.filter);
      });
    });
    applyFilter(current);
  }

  function bindCardInteractions() {
    // Size selection, on any card that has size buttons
    document.querySelectorAll('[data-productkey]').forEach(card => {
      const product = catalogByKey[card.dataset.productkey];
      if (!product) return;
      const statusEl = card.querySelector('.stock-status, .stock-badge');
      const statusBase = statusEl?.classList.contains('stock-badge') ? 'stock-badge' : 'stock-status';
      const addBtn = card.querySelector('.add-to-cart');

      card.querySelectorAll('.size-row .sz').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.classList.contains('out-of-stock')) return;
          card.querySelectorAll('.sz').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const stock = product.stock?.[btn.dataset.size] ?? 0;
          const { text, cls } = stockLabel(stock);
          if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = statusBase + (cls ? ' ' + cls : '');
          }
          if (addBtn) addBtn.disabled = (stock === 0);
        });
      });
    });

    document.querySelectorAll('.shirt-card').forEach(card => {
      // Touch screens have no hover, so the first tap opens the overlay (its
      // buttons ignore taps until it is visible) and the next tap uses it.
      card.addEventListener('click', () => {
        if (!window.matchMedia('(hover: none)').matches) return;
        document.querySelectorAll('.shirt-card.overlay-open').forEach(other => {
          if (other !== card) other.classList.remove('overlay-open');
        });
        card.classList.add('overlay-open');
      });

      card.querySelectorAll('.size-guide-link').forEach(link => {
        link.addEventListener('click', e => {
          e.stopPropagation();
          document.getElementById('sizeModal')?.classList.add('open');
        });
      });
    });

    // Add to cart — works for every card type via the shared [data-productkey] ancestor
    document.querySelectorAll('.add-to-cart').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.disabled) return;

        const card = btn.closest('[data-productkey]');
        const product = card && catalogByKey[card.dataset.productkey];
        if (!product) return;

        const sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['NOSIZE'];
        let size, variant;

        if (sizes.length > 1) {
          const activeSz = card.querySelector('.sz.active:not(.out-of-stock)');
          if (!activeSz) return;
          size = activeSz.dataset.size;
          variant = size;
        } else {
          size = sizes[0];
          variant = product.productKey.split('|').slice(1).join('|') || '';
        }

        const stock = product.stock?.[size] ?? 0;
        if (stock === 0) return;

        window.AKO?.addToCart({
          sku: skuFor(product, size),
          name: product.name,
          variant,
          price: product.price,
          emoji: layoutFor(sections.find(s => s.key === product.section)).emoji,
          image: product.image || '',
          maxQty: stock,
        });
      });
    });
  }

  let renderedEditorMode = null;

  // showAll resets the filter to "All" — done whenever editor mode switches,
  // so staff never work on (or create collections into) a filtered page.
  function renderAll({ showAll = false } = {}) {
    const container = document.getElementById('shopSections');
    if (!container) return;
    const bySection = productsBySection();
    const editor = isEditorMode();
    const modeChanged = renderedEditorMode !== null && renderedEditorMode !== editor;
    renderedEditorMode = editor;
    const visibleSections = shownSections(bySection, editor);

    container.innerHTML = visibleSections.length
      ? visibleSections.map((section, index) => sectionHtml(section, bySection.get(section.key) || [], editor, index, visibleSections.length)).join('')
      : `<p class="shop-empty">${editor ? 'No collections yet. Use Create Collection to add one.' : 'Nothing here yet — check back soon.'}</p>`;

    bindCardInteractions();
    rebuildFilterRow(visibleSections, showAll || modeChanged ? 'all' : undefined);

    // Let the shop editor (if loaded) re-bind card selection after every
    // render, since the render replaces innerHTML and drops listeners.
    if (window.AKOEditor && typeof window.AKOEditor.refreshMenuEditorState === 'function') {
      window.AKOEditor.refreshMenuEditorState();
    }
  }

  /* ── Load ── */

  async function loadCatalog() {
    try {
      const res = await fetch('/api/shop-catalog');
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) throw new Error(payload.error || 'Failed to load shop catalog');

      catalog = Array.isArray(payload.products) ? payload.products : [];
      sections = Array.isArray(payload.sections) ? payload.sections : [];
      // Derived fresh from catalog every load, never mutated independently,
      // so the two can't drift out of sync with each other.
      catalogByKey = Object.fromEntries(catalog.map(p => [p.productKey, p]));

      renderAll();
      // A cart saved on an earlier visit may hold old prices or items that
      // are gone or sold out; bring it up to date (it says what changed).
      window.AKO?.reconcileCart?.(catalog);
    } catch (err) {
      console.error('[shop] catalog load failed:', err);
      document.querySelectorAll('.shop-loading').forEach(el => {
        el.textContent = 'Unable to load the shop right now — please refresh.';
      });
    }
  }

  loadCatalog();

  // On touch screens, tapping anywhere outside a shirt closes its overlay.
  document.addEventListener('click', event => {
    if (event.target.closest?.('.shirt-card')) return;
    document.querySelectorAll('.shirt-card.overlay-open').forEach(card => card.classList.remove('overlay-open'));
  });

  // Exposed for shop-editor.js: reload() re-fetches the catalog and re-renders;
  // getProduct() looks up a currently-loaded product's full data by productKey;
  // getSections() lists every collection in page order; renderIfModeChanged()
  // re-renders after editor mode is switched (editor-only parts appear/vanish).
  window.AKOShop = {
    reload: loadCatalog,
    getProduct: (productKey) => catalogByKey[productKey],
    getAllProducts: () => catalog.slice(),
    getSections: () => sections.map(section => ({ ...section })),
    renderIfModeChanged: () => {
      if (renderedEditorMode !== null && renderedEditorMode !== isEditorMode()) renderAll();
    },
    showAll: () => renderAll({ showAll: true }),
  };

})();
