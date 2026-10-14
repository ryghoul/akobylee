/* =========================================================
   AKO — script.js
   Site-wide JS: nav drawer + cart drawer open/close.
   ========================================================= */

(function () {

  /* ── NAV DRAWER ── */
  const logoBtn   = document.getElementById('logoBtn');
  const navDrawer = document.getElementById('navDrawer');
  const navOverlay= document.getElementById('navOverlay');

  function openNav() {
    document.body.classList.add('nav-open');
    if (logoBtn)   logoBtn.setAttribute('aria-expanded', 'true');
    if (navDrawer) navDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeNav() {
    document.body.classList.remove('nav-open');
    if (logoBtn)   logoBtn.setAttribute('aria-expanded', 'false');
    if (navDrawer) navDrawer.setAttribute('aria-hidden', 'true');
  }

  if (logoBtn)    logoBtn.addEventListener('click', () => document.body.classList.contains('nav-open') ? closeNav() : openNav());
  if (navOverlay) navOverlay.addEventListener('click', closeNav);

  /* ── CART DRAWER ── */
  const cartDrawer  = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartBtn     = document.getElementById('cartBtn');
  const cartClose   = document.getElementById('cartClose');

  function openCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.add('open');
    if (cartOverlay) cartOverlay.classList.add('open');
    closeNav(); // close nav if open
  }

  function closeCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('open');
    if (cartOverlay) cartOverlay.classList.remove('open');
  }

  if (cartBtn)     cartBtn.addEventListener('click', openCart);
  if (cartClose)   cartClose.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  /* ── Escape key closes both ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeNav(); closeCart(); }
  });

  // Wires the standard editor-modal dismiss trio (× button, a named Cancel
  // button, click-on-backdrop) — used by every modal in menu.js/shop-editor.js.
  function wireModalDismiss(modal, cancelBtnId) {
    modal.querySelector('.menu-editor-close')?.addEventListener('click', () => modal.classList.add('hidden'));
    if (cancelBtnId) {
      modal.querySelector('#' + cancelBtnId)?.addEventListener('click', () => modal.classList.add('hidden'));
    }
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.add('hidden');
    });
  }

  /* ── Expose cart open/close globally for shop.js ── */
  window.AKO = window.AKO || {};
  window.AKO.openCart  = openCart;
  window.AKO.closeCart = closeCart;
  window.AKO.wireModalDismiss = wireModalDismiss;

})();


/* =========================================================
   AKO — cart.js (bundled into script.js)
   Cart state, render, badge update.
   ========================================================= */

(function () {

  /* ── Cart state (persisted to localStorage so it survives page navigation) ── */
  const CART_STORAGE_KEY = 'ako_cart_v1';

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(i => i && typeof i.sku === 'string' && Number.isFinite(i.qty) && i.qty > 0);
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // localStorage unavailable (private browsing, quota, etc.) — cart just
      // won't survive navigation this time, not worth surfacing to the user.
    }
  }

  let cart = loadCart(); // [{ sku, name, variant, price, qty, emoji, image }]

  /* ── DOM refs ── */
  const itemsEl    = document.getElementById('cartItems');
  const badgeEl    = document.getElementById('cartBadge');
  const countEl    = document.getElementById('cartCount');
  const totalEl    = document.getElementById('cartTotal');
  const checkoutEl = document.getElementById('cartCheckoutBtn');

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Messages about changes the customer didn't make themselves (a price
  // update, a sold-out item removed...). Shown at the top of the cart until
  // the cart is next changed.
  let cartNotices = [];
  const formatMoney = cents => '$' + (cents / 100).toFixed(2);
  const itemTitle = item => item.name + (item.variant ? ` (${item.variant})` : '');

  /* ── Add item to cart ── */
  // maxQty is the stock the shop page knew about when the item was added.
  function addToCart({ sku, name, variant, price, emoji = '🛍', image = '', maxQty }) {
    cartNotices = [];
    const existing = cart.find(i => i.sku === sku);
    const limit = Number.isFinite(maxQty) ? maxQty : existing?.maxQty;
    if (existing) {
      if (Number.isFinite(maxQty)) existing.maxQty = maxQty;
      if (Number.isFinite(limit) && existing.qty >= limit) {
        cartNotices = [`Only ${limit} of ${itemTitle(existing)} available.`];
      } else {
        existing.qty += 1;
      }
    } else {
      cart.push({ sku, name, variant, price, qty: 1, emoji, image, ...(Number.isFinite(maxQty) ? { maxQty } : {}) });
    }
    render();
    if (window.AKO?.openCart) window.AKO.openCart();
  }

  /* ── Remove item ── */
  function removeItem(sku) {
    cartNotices = [];
    cart = cart.filter(i => i.sku !== sku);
    render();
  }

  /* ── Clear cart (called by success.js after a completed purchase) ── */
  function clearCart() {
    cartNotices = [];
    cart = [];
    render();
  }

  /* ── Change qty ── */
  function changeQty(sku, delta) {
    const item = cart.find(i => i.sku === sku);
    if (!item) return;
    cartNotices = [];
    if (delta > 0 && Number.isFinite(item.maxQty) && item.qty >= item.maxQty) {
      cartNotices = [`Only ${item.maxQty} of ${itemTitle(item)} available.`];
      render();
      return;
    }
    item.qty += delta;
    if (item.qty <= 0) removeItem(sku);
    else render();
  }

  /* ── Bring the cart up to date with the live catalog ── */
  // Prices, names and stock in a saved cart can be days old. Removes items
  // that are gone, hidden or sold out, lowers quantities to what's in stock,
  // and refreshes prices. Returns true if anything changed (and says what).
  function reconcileCart(products) {
    const bySku = new Map();
    (Array.isArray(products) ? products : []).forEach(product => {
      (product.sizes || []).forEach(size => bySku.set(`${product.productKey}|${size}`, { product, size }));
    });
    const notices = [];
    const next = [];
    cart.forEach(item => {
      const match = bySku.get(item.sku);
      if (!match || match.product.active === false) {
        notices.push(`${itemTitle(item)} is no longer available and was removed.`);
        return;
      }
      const stock = Math.max(0, Number(match.product.stock?.[match.size]) || 0);
      if (stock === 0) {
        notices.push(`${itemTitle(item)} sold out and was removed.`);
        return;
      }
      const price = Number(match.product.price) || 0;
      if (price !== item.price) notices.push(`${itemTitle(item)} is now ${formatMoney(price)} each.`);
      if (item.qty > stock) notices.push(`Only ${stock} of ${itemTitle(item)} left, so your quantity was lowered.`);
      next.push({
        ...item,
        name: match.product.name || item.name,
        image: match.product.image || item.image,
        price,
        qty: Math.min(item.qty, stock),
        maxQty: stock,
      });
    });
    cart = next;
    if (notices.length) cartNotices = notices;
    render();
    return notices.length > 0;
  }

  async function refreshCartFromCatalog() {
    const res = await fetch('/api/shop-catalog', { cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.ok) throw new Error(payload.error || 'Failed to load shop catalog');
    return reconcileCart(payload.products);
  }

  /* ── Render cart drawer ── */
  function render() {
    saveCart();

    const total    = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const count    = cart.reduce((s, i) => s + i.qty, 0);
    const totalFmt = '$' + (total / 100).toFixed(2);

    // Badge
    if (badgeEl) {
      badgeEl.textContent = count;
      badgeEl.classList.toggle('visible', count > 0);
    }

    // Count label
    if (countEl) countEl.textContent = count === 0 ? '' : `${count} item${count !== 1 ? 's' : ''}`;

    // Total
    if (totalEl) totalEl.textContent = totalFmt;

    // Checkout button
    if (checkoutEl) checkoutEl.disabled = cart.length === 0;

    // Items list
    if (!itemsEl) return;

    const noticeHtml = cartNotices.length
      ? `<div class="cart-notice" role="status">${cartNotices.map(text => `<p>${escapeHtml(text)}</p>`).join('')}</div>`
      : '';

    if (cart.length === 0) {
      itemsEl.innerHTML = noticeHtml + `
        <div class="cart-empty">
          <div class="cart-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#7e6961" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6z"/>
            </svg>
          </div>
          <div class="cart-empty-text">Your cart is empty</div>
          <div class="cart-empty-sub">Add something to get started</div>
        </div>`;
      return;
    }

    itemsEl.innerHTML = noticeHtml + cart.map(item => `
      <div class="cart-item" data-sku="${escapeHtml(item.sku)}">
        <div class="cart-item-thumb">${item.image
          ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="cart-item-emoji">${escapeHtml(item.emoji)}</span>`
          : escapeHtml(item.emoji)}</div>
        <div>
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-variant">${escapeHtml(item.variant)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-sku="${escapeHtml(item.sku)}" data-delta="-1">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" data-sku="${escapeHtml(item.sku)}" data-delta="1">+</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <div class="cart-item-price">$${(item.price * item.qty / 100).toFixed(2)}</div>
          <button class="cart-item-remove" data-sku="${escapeHtml(item.sku)}" aria-label="Remove">×</button>
        </div>
      </div>`).join('');

    // Qty buttons
    itemsEl.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => changeQty(btn.dataset.sku, parseInt(btn.dataset.delta)));
    });

    // Remove buttons
    itemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => removeItem(btn.dataset.sku));
    });
  }

  /* ── Checkout ── */
  function resetCheckoutButton() {
    if (!checkoutEl) return;
    checkoutEl.textContent = 'Checkout';
    checkoutEl.disabled = cart.length === 0;
  }

  if (checkoutEl) {
    checkoutEl.addEventListener('click', async () => {
      if (!cart.length) return;
      checkoutEl.disabled = true;
      checkoutEl.textContent = 'Loading…';

      // Check the cart against the live catalog first; if anything changed,
      // stop so the customer sees what changed before paying. If the check
      // itself fails, carry on: the server checks prices and stock anyway.
      try {
        if (await refreshCartFromCatalog()) {
          if (window.AKO?.openCart) window.AKO.openCart();
          resetCheckoutButton();
          return;
        }
      } catch (err) {
        console.warn('[cart] could not refresh the cart before checkout:', err);
      }
      if (!cart.length) {
        resetCheckoutButton();
        return;
      }
      checkoutEl.disabled = true; // the refresh above re-rendered the cart

      try {
        const res = await fetch('/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map(i => ({
              sku:      i.sku,
              name:     i.name + (i.variant ? ` — ${i.variant}` : ''),
              price:    i.price,
              quantity: i.qty,
            }))
          })
        });

        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.error || 'Unable to start checkout.');
          resetCheckoutButton();
        }
      } catch (err) {
        console.error('[cart] checkout error:', err);
        alert('Network error. Please try again.');
        resetCheckoutButton();
      }
    });
  }

  // Pressing Back from Stripe can restore this page exactly as it was left —
  // with the button still on "Loading…" — and with a cart that another tab
  // may have changed (or emptied after a purchase). Reset both.
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    cart = loadCart();
    cartNotices = [];
    render();
    resetCheckoutButton();
  });

  /* ── Expose globally so shop.js can call addToCart ── */
  window.AKO = window.AKO || {};
  window.AKO.addToCart = addToCart;
  window.AKO.clearCart = clearCart;
  window.AKO.reconcileCart = reconcileCart;
  window.AKO.escapeHtml = escapeHtml;

  render(); // initial render — reflects any cart restored from localStorage above
})();

/* =========================================================
   AKO — staff editor login + editor mode
   ========================================================= */
(function () {
  const STORAGE_KEY = 'ako_editor_enabled';
  const ADMIN_LOGIN_URL = '/api/admin/login';
  const ADMIN_STATUS_URL = '/api/admin/status';

  async function loginAsStaff(username, password) {
    const response = await fetch(ADMIN_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Invalid staff credentials.');
    }

    return payload;
  }

  async function getAdminStatus() {
    try {
      const response = await fetch(ADMIN_STATUS_URL, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => ({}));
      return !!(response.ok && payload.authenticated);
    } catch {
      return false;
    }
  }

  function isDesktopViewport() {
    return window.matchMedia('(min-width: 769px)').matches;
  }

  function isPage(filename, selector) {
    const path = window.location.pathname.split('/').pop() || '';
    return path.toLowerCase() === filename || !!document.querySelector(selector);
  }

  function isMenuPage() {
    return isPage('menu.html', '.menu-tab');
  }

  function isShopPage() {
    return isPage('shop.html', '.shop-wrap');
  }

  function ensureStaffControls() {
    // While editing, keep the login modal: an expired session reopens it.
    if (!isDesktopViewport() && !document.body.classList.contains('editor-enabled')) {
      const button = document.getElementById('staffLoginBtn');
      const modal = document.getElementById('staffLoginModal');
      if (button) button.remove();
      if (modal) modal.remove();
      return;
    }

    if (document.getElementById('staffLoginBtn')) return;

    const navLinks = document.getElementById('navLinks');
    const button = document.createElement('button');
    button.id = 'staffLoginBtn';
    button.type = 'button';
    button.className = 'staff-login-btn';
    button.textContent = 'Staff Login';

    if (navLinks) {
      const listItem = document.createElement('li');
      listItem.appendChild(button);
      navLinks.appendChild(listItem);
    } else {
      button.style.position = 'fixed';
      button.style.right = '20px';
      button.style.top = '20px';
      button.style.zIndex = '100';
      document.body.appendChild(button);
    }

    const modal = document.createElement('div');
    modal.id = 'staffLoginModal';
    modal.className = 'staff-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="staff-modal-panel" role="dialog" aria-modal="true" aria-labelledby="staffLoginTitle">
        <button type="button" class="staff-modal-close" aria-label="Close login">×</button>
        <h3 id="staffLoginTitle">Staff Access</h3>
        <form id="staffLoginForm" class="staff-login-form">
          <label>
            Username
            <input id="staffUser" name="username" type="text" required />
          </label>
          <label>
            Password
            <input id="staffPass" name="password" type="password" required />
          </label>
          <p id="staffLoginError" class="staff-login-error" hidden></p>
          <button type="submit">Enter Editor Mode</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.staff-modal-close');
    const form = modal.querySelector('#staffLoginForm');

    button.addEventListener('click', openLoginModal);
    closeBtn.addEventListener('click', closeLoginModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeLoginModal();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      const errorEl = document.getElementById('staffLoginError');
      const username = document.getElementById('staffUser').value.trim();
      const password = document.getElementById('staffPass').value;

      if (submitBtn) submitBtn.disabled = true;
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }

      try {
        await loginAsStaff(username, password);
        setEditorMode(true);
        closeLoginModal();
        form.reset();
      } catch (error) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = error.message || 'Invalid staff credentials.';
        } else {
          alert(error.message || 'Invalid staff credentials.');
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeLoginModal();
      }
    });
  }

  function openLoginModal() {
    const modal = document.getElementById('staffLoginModal');
    const menuOverlay = document.getElementById('modalOverlay');
    if (menuOverlay) {
      menuOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeLoginModal() {
    const modal = document.getElementById('staffLoginModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function callEditor(fnName, ...args) {
    if (window.AKOEditor && typeof window.AKOEditor[fnName] === 'function') {
      return window.AKOEditor[fnName](...args);
    }
  }

  function makeToolbarButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // "Publish GitHub" is identical in both toolbars — only which
  // window.AKOEditor method it calls differs.
  function makePublishButton(methodName) {
    const btn = makeToolbarButton('Publish GitHub', async () => {
      if (!window.AKOEditor || typeof window.AKOEditor[methodName] !== 'function') return;
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = 'Publishing...';
      try {
        await window.AKOEditor[methodName]();
      } catch (error) {
        console.error('[editor] publish failed:', error);
        alert(`Publish failed. ${error?.message || 'Please try again.'}`);
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
    return btn;
  }

  function buildMenuToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'editorToolbar';
    toolbar.className = 'editor-toolbar';

    const undoBtn = makeToolbarButton('Undo', () => callEditor('undoMenuChange'));
    const redoBtn = makeToolbarButton('Redo', () => callEditor('redoMenuChange'));
    const addBtn = makeToolbarButton('Add Drink', () => callEditor('addDrinkFromPrompt'));
    const editBtn = makeToolbarButton('Edit Selected', () => callEditor('editSelectedDrink'));
    const moveCurrentBtn = makeToolbarButton('Move to Current', () => callEditor('moveSelectedArchiveItem'));
    const moveArchiveBtn = makeToolbarButton('Move to Archive', () => callEditor('moveSelectedCurrentItemToArchive'));
    const deleteBtn = makeToolbarButton('Delete', () => callEditor('toggleMenuDeleteMode'));
    deleteBtn.id = 'menuDeleteButton';
    deleteBtn.setAttribute('aria-pressed', 'false');
    deleteBtn.title = 'Toggle delete mode, then click a drink or section';
    const sectionBtn = makeToolbarButton('Create Section', () => callEditor('createMenuSection'));

    const publishBtn = makePublishButton('publishMenuStateToGitHub');

    const exitBtn = makeToolbarButton('Exit Editor', () => setEditorMode(false));

    toolbar.append(undoBtn, redoBtn, addBtn, editBtn, moveCurrentBtn, moveArchiveBtn, deleteBtn, sectionBtn, publishBtn, exitBtn);
    return toolbar;
  }

  function buildShopToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'editorToolbar';
    toolbar.className = 'editor-toolbar';

    const addBtn = makeToolbarButton('Add Item', () => callEditor('addShopItem'));
    const editBtn = makeToolbarButton('Edit Selected', () => callEditor('editSelectedShopItem'));
    const stockBtn = makeToolbarButton('Edit Stock', () => callEditor('editSelectedShopItemStock'));
    const deleteBtn = makeToolbarButton('Delete Selected', () => callEditor('deleteSelectedShopItem'));

    const publishBtn = makePublishButton('publishShopCatalogToGitHub');

    const exitBtn = makeToolbarButton('Exit Editor', () => setEditorMode(false));

    toolbar.append(addBtn, editBtn, stockBtn, deleteBtn, publishBtn, exitBtn);
    return toolbar;
  }

  function setEditorMode(enabled) {
    document.body.classList.toggle('editor-enabled', enabled);
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');

    const detailModal = document.getElementById('modalOverlay');
    if (detailModal) detailModal.classList.remove('open');
    const editModal = document.getElementById('menuEditorModal');
    if (editModal) editModal.classList.add('hidden');

    const toolbar = document.getElementById('editorToolbar');
    if (toolbar) toolbar.remove();

    const onMenu = isMenuPage();
    const onShop = !onMenu && isShopPage();

    if (!enabled || (!onMenu && !onShop)) {
      if (window.AKOEditor && typeof window.AKOEditor.refreshMenuEditorState === 'function') {
        window.AKOEditor.refreshMenuEditorState();
      }
      return;
    }

    if (!document.getElementById('editorToolbar')) {
      document.body.appendChild(onMenu ? buildMenuToolbar() : buildShopToolbar());
    }

    // Shop's catalog render filters out inactive products when not in editor
    // mode, so a page that loaded before login needs a re-fetch now that
    // staff should be able to see (and restock/re-enable) hidden items too.
    if (onShop && window.AKOShop && typeof window.AKOShop.reload === 'function') {
      window.AKOShop.reload();
    }

    if (window.AKOEditor && typeof window.AKOEditor.refreshMenuEditorState === 'function') {
      window.AKOEditor.refreshMenuEditorState();
    }
  }

  ensureStaffControls();

  // Narrow screens only lose the way in (the Staff Login button). An active
  // editor session stays open: leaving it here closed open edit forms and lost
  // typed changes whenever the window narrowed — browser zoom included.
  window.addEventListener('resize', ensureStaffControls);

  (async () => {
    if (localStorage.getItem(STORAGE_KEY) !== '1') return;
    const isAuthenticated = await getAdminStatus();
    if (isAuthenticated) {
      setEditorMode(true);
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    setEditorMode(false);
  })();

  window.AKO = window.AKO || {};
  window.AKO.editor = {
    setEditorMode,
    openLoginModal,
    closeLoginModal,
  };
  window.AKOEditor = window.AKO.editor;
})();
