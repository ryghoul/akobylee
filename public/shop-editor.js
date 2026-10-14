/* =========================================================
   shop-editor.js — Staff editor for the Shop page.
   Mirrors menu.js's editor pattern: real <form> modals (reusing
   the shared .menu-editor-modal/.menu-editor-form CSS), click-to-
   select cards, and merges its API onto window.AKOEditor exactly
   like menu.js does, so script.js's shared staff-login/toolbar
   shell can drive it without knowing which page it's on.
   ========================================================= */

(function () {

  // Shared with script.js (loaded first on every page) rather than
  // redefined here, so there's one escaping implementation to keep correct.
  const escapeHtml = window.AKO.escapeHtml;

  const getSections = () => window.AKOShop?.getSections?.() || [];
  const sectionOptionLabel = section => section.label + (section.hidden ? ' (hidden from customers)' : '');

  // The item form's collection list, in page order. New collections are made
  // with Create Collection, so every item lands in a named collection.
  function populateSectionSelect(selected) {
    const select = document.getElementById('shopItemSection');
    if (!select) return;
    const sections = getSections();
    select.innerHTML = sections.length
      ? sections.map(s => `<option value="${escapeHtml(s.key)}">${escapeHtml(sectionOptionLabel(s))}</option>`).join('')
      : '<option value="">No collections yet — use Create Collection first</option>';
    if (selected && sections.some(s => s.key === selected)) select.value = selected;
  }

  function getSelectedCard() {
    return document.querySelector('.shirt-card.is-selected, .bag-card.is-selected, .bandana-card.is-selected');
  }

  function clearSelection() {
    document.querySelectorAll('.shirt-card.is-selected, .bag-card.is-selected, .bandana-card.is-selected')
      .forEach(el => el.classList.remove('is-selected'));
  }

  /* ── Card click-to-select (editor mode only) ── */
  // Cards are fully replaced (innerHTML) on every shop.js render, so this is
  // safe to call repeatedly — but it can also run again on the *same* nodes
  // when editor mode is toggled without a re-render, so we assign .onclick
  // (which replaces) rather than addEventListener (which would stack).
  function bindShopCardSelection() {
    const isEditor = document.body.classList.contains('editor-enabled');

    document.querySelectorAll('.shirt-card, .bag-card, .bandana-card').forEach(card => {
      card.onclick = null;
      if (!isEditor) return;

      card.onclick = (e) => {
        // Buttons inside the card (add-to-cart, size buttons, size-guide
        // link) already call stopPropagation() in shop.js, so a click that
        // reaches here is always on the card body itself, not a control.
        e.preventDefault();
        const alreadySelected = card.classList.contains('is-selected');
        clearSelection();
        if (!alreadySelected) card.classList.add('is-selected');
      };
    });

    if (!isEditor) clearSelection();
  }

  /* ── Add/Edit Item modal ── */

  // Fields that map straightforwardly between the form and a product's
  // payload (read: value + coerce; write: the corresponding value back) —
  // shared between the submit handler and editSelectedShopItem's populate
  // step so a field can't silently drift out of sync between what's saved
  // and what's shown when editing. productKey/section/sizes/price/active
  // all have real business logic beyond simple assignment, so they stay
  // handled explicitly at each call site instead of going in this table.
  const SHOP_ITEM_SIMPLE_FIELDS = [
    { key: 'name', id: 'shopItemName', type: 'text' },
    { key: 'description', id: 'shopItemDescription', type: 'text' },
    { key: 'image', id: 'shopItemImage', type: 'text' },
    { key: 'tagLabel', id: 'shopItemTagLabel', type: 'text' },
    { key: 'colorHex', id: 'shopItemColorHex', type: 'text' },
    { key: 'accentHex', id: 'shopItemAccentHex', type: 'text' },
    { key: 'specs', id: 'shopItemSpecs', type: 'text' },
    { key: 'presale', id: 'shopItemPresale', type: 'checkbox' },
    { key: 'order', id: 'shopItemOrder', type: 'number' },
  ];

  function readSimpleShopItemFields() {
    const out = {};
    for (const f of SHOP_ITEM_SIMPLE_FIELDS) {
      const el = document.getElementById(f.id);
      if (f.type === 'checkbox') out[f.key] = el.checked;
      else if (f.type === 'number') out[f.key] = Number(el.value) || 0;
      else out[f.key] = el.value.trim();
    }
    return out;
  }

  function writeSimpleShopItemFields(product) {
    for (const f of SHOP_ITEM_SIMPLE_FIELDS) {
      const el = document.getElementById(f.id);
      if (f.type === 'checkbox') el.checked = !!product[f.key];
      else el.value = product[f.key] ?? (f.type === 'number' ? 0 : '');
    }
  }

  const MAX_SHOP_IMAGE_BYTES = 5 * 1024 * 1024;
  const STAGED_IMAGE_PREFIX = '/api/staged-images/';

  function showShopItemPreview(src) {
    const preview = document.getElementById('shopItemImagePreview');
    if (src) {
      preview.src = src;
      preview.classList.add('visible');
    } else {
      preview.removeAttribute('src');
      preview.classList.remove('visible');
    }
  }

  // While a picked photo uploads, Save Item waits so the item keeps that photo.
  function setShopPhotoUpload(form, token) {
    if (token) form.dataset.uploadToken = token;
    else delete form.dataset.uploadToken;
    const submitBtn = document.getElementById('shopItemSubmit');
    if (!submitBtn) return;
    submitBtn.disabled = !!token;
    submitBtn.textContent = token ? 'Uploading photo...' : 'Save Item';
  }

  async function stageShopImage(dataUrl) {
    const res = await fetch('/api/staged-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ dataUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || typeof data.path !== 'string') {
      throw new Error(data.error || (res.status === 413 ? 'That photo is too large.' : 'The photo could not be uploaded.'));
    }
    return data.path;
  }

  function ensureShopItemModal() {
    if (document.getElementById('shopItemModal')) return;

    const modal = document.createElement('div');
    modal.id = 'shopItemModal';
    modal.className = 'menu-editor-modal hidden';
    modal.innerHTML = `
      <div class="menu-editor-panel" role="dialog" aria-modal="true" aria-labelledby="shopItemModalTitle">
        <button type="button" class="menu-editor-close" aria-label="Close editor">×</button>
        <h3 id="shopItemModalTitle">Add Item</h3>
        <form id="shopItemForm" class="menu-editor-form">
          <label>
            Product Key
            <input id="shopItemProductKey" name="productKey" type="text" placeholder="shirt|V3" />
          </label>
          <label>
            Collection
            <select id="shopItemSection" name="section"></select>
          </label>
          <label>
            Name
            <input id="shopItemName" name="name" type="text" />
          </label>
          <label>
            Description
            <textarea id="shopItemDescription" rows="3"></textarea>
          </label>
          <label>
            Image path
            <input id="shopItemImage" name="image" type="text" placeholder="Pictures/merch/your-item.png" />
          </label>
          <label>
            Upload new image
            <input id="shopItemImageUpload" name="imageUpload" type="file" accept="image/*" />
          </label>
          <img id="shopItemImagePreview" class="menu-editor-preview" alt="Item preview" />
          <label>
            Price (USD)
            <input id="shopItemPrice" name="price" type="number" min="0" step="0.01" />
          </label>
          <label>
            Sizes (comma separated — use NOSIZE if it has no sizes)
            <input id="shopItemSizes" name="sizes" type="text" placeholder="S, M, L, XL" />
          </label>
          <label>
            Colorway / tag label
            <input id="shopItemTagLabel" name="tagLabel" type="text" />
          </label>
          <label>
            Color hex
            <input id="shopItemColorHex" name="colorHex" type="text" placeholder="#1a1a1a" />
          </label>
          <label>
            Accent hex
            <input id="shopItemAccentHex" name="accentHex" type="text" placeholder="#cbc0b2" />
          </label>
          <label>
            Specs
            <textarea id="shopItemSpecs" rows="3"></textarea>
          </label>
          <label>
            <input id="shopItemPresale" type="checkbox" /> Presale
          </label>
          <label>
            <input id="shopItemActive" type="checkbox" checked /> Active (visible on storefront)
          </label>
          <label>
            Sort order
            <input id="shopItemOrder" type="number" step="1" value="0" />
          </label>
          <div class="menu-editor-actions">
            <button type="button" class="secondary-btn" id="shopItemCancel">Cancel</button>
            <button type="submit" id="shopItemSubmit">Save Item</button>
          </div>
        </form>
      </div>
    `;

    // Picking a file stages it on the server right away (so item saves carry a
    // short /api/staged-images/ URL, not the whole photo). It isn't committed
    // to GitHub until Publish is clicked (see publishShopCatalogToGitHub).
    modal.querySelector('#shopItemImageUpload').addEventListener('change', (event) => {
      const fileInput = event.target;
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const form = document.getElementById('shopItemForm');
      const imageInput = document.getElementById('shopItemImage');
      const previousImage = imageInput.value.trim();
      const reject = message => {
        fileInput.value = '';
        alert(message);
      };
      if (!IMAGE_MIME_EXTENSIONS[file.type]) {
        reject('Choose a PNG, JPEG, WebP, GIF, or SVG photo.');
        return;
      }
      if (file.size > MAX_SHOP_IMAGE_BYTES) {
        reject(`That photo is larger than ${MAX_SHOP_IMAGE_BYTES / (1024 * 1024)}MB. Choose a smaller photo.`);
        return;
      }

      const token = `${Date.now()}-${Math.random()}`;
      setShopPhotoUpload(form, token);
      const finish = errorMessage => {
        // The form was reopened or another photo was picked meanwhile.
        if (form.dataset.uploadToken !== token) return;
        setShopPhotoUpload(form, null);
        if (errorMessage) {
          showShopItemPreview(previousImage);
          reject(`${errorMessage} The previous photo was kept.`);
        }
      };

      const reader = new FileReader();
      reader.onerror = () => finish('The photo could not be read.');
      reader.onload = async () => {
        if (form.dataset.uploadToken !== token) return;
        showShopItemPreview(reader.result);
        try {
          const stagedPath = await stageShopImage(reader.result);
          if (form.dataset.uploadToken === token) imageInput.value = stagedPath;
          finish('');
        } catch (error) {
          finish(error.message || 'The photo could not be uploaded.');
        }
      };
      reader.readAsDataURL(file);
    });

    window.AKO.wireModalDismiss(modal, 'shopItemCancel');

    modal.querySelector('#shopItemForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.dataset.uploadToken) return;
      const isEdit = !!form.dataset.editKey;

      const productKey = isEdit
        ? form.dataset.editKey
        : document.getElementById('shopItemProductKey').value.trim();
      if (!productKey) { alert('Product Key is required.'); return; }

      const sizes = document.getElementById('shopItemSizes').value
        .split(',').map(s => s.trim()).filter(Boolean);
      const priceDollars = parseFloat(document.getElementById('shopItemPrice').value);
      const price = Number.isFinite(priceDollars) ? Math.round(priceDollars * 100) : 0;

      const section = document.getElementById('shopItemSection').value;
      if (!section) { alert('Create a collection first (Create Collection in the toolbar), then add the item to it.'); return; }

      const payload = {
        ...readSimpleShopItemFields(),
        section,
        price,
        sizes,
        active: document.getElementById('shopItemActive').checked,
      };
      if (!isEdit) payload.productKey = productKey;

      const submitBtn = document.getElementById('shopItemSubmit');
      submitBtn.disabled = true;
      try {
        const res = await fetch(
          isEdit ? `/api/shop-catalog/${encodeURIComponent(productKey)}` : '/api/shop-catalog',
          {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save item.');

        modal.classList.add('hidden');
        form.reset();
        await window.AKOShop?.reload();
      } catch (err) {
        alert(err.message || 'Failed to save item.');
      } finally {
        submitBtn.disabled = false;
      }
    });

    document.body.appendChild(modal);
  }

  function addShopItem() {
    ensureShopItemModal();
    const modal = document.getElementById('shopItemModal');
    const form = document.getElementById('shopItemForm');

    form.reset();
    setShopPhotoUpload(form, null);
    delete form.dataset.editKey;
    document.getElementById('shopItemModalTitle').textContent = 'Add Item';
    document.getElementById('shopItemProductKey').disabled = false;
    document.getElementById('shopItemActive').checked = true;
    populateSectionSelect();

    const preview = document.getElementById('shopItemImagePreview');
    preview.removeAttribute('src');
    preview.classList.remove('visible');

    modal.classList.remove('hidden');
  }

  function editSelectedShopItem() {
    const selected = getSelectedCard();
    if (!selected) { alert('Select an item first.'); return; }

    const productKey = selected.dataset.productkey;
    const product = window.AKOShop?.getProduct(productKey);
    if (!product) { alert('Could not find that item — try refreshing.'); return; }

    ensureShopItemModal();
    const modal = document.getElementById('shopItemModal');
    const form = document.getElementById('shopItemForm');
    form.reset();
    setShopPhotoUpload(form, null);
    form.dataset.editKey = productKey;
    document.getElementById('shopItemModalTitle').textContent = 'Edit Item';

    document.getElementById('shopItemProductKey').value = productKey;
    document.getElementById('shopItemProductKey').disabled = true;
    populateSectionSelect(product.section || '');
    writeSimpleShopItemFields(product);
    document.getElementById('shopItemPrice').value = ((product.price || 0) / 100).toFixed(2);
    document.getElementById('shopItemSizes').value = (product.sizes || []).join(', ');
    document.getElementById('shopItemActive').checked = product.active !== false;

    const preview = document.getElementById('shopItemImagePreview');
    if (product.image) {
      preview.src = product.image;
      preview.classList.add('visible');
    } else {
      preview.removeAttribute('src');
      preview.classList.remove('visible');
    }

    modal.classList.remove('hidden');
  }

  async function deleteSelectedShopItem() {
    const selected = getSelectedCard();
    if (!selected) { alert('Select an item first.'); return; }

    const productKey = selected.dataset.productkey;
    const product = window.AKOShop?.getProduct(productKey);
    const label = product?.name || productKey;
    if (!confirm(`Delete "${label}" from the shop? This can't be undone (existing stock records are kept).`)) return;

    try {
      const res = await fetch(`/api/shop-catalog/${encodeURIComponent(productKey)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to delete item.');
      await window.AKOShop?.reload();
    } catch (err) {
      alert(err.message || 'Failed to delete item.');
    }
  }

  /* ── Edit Stock modal ── */

  function ensureShopStockModal() {
    if (document.getElementById('shopStockModal')) return;

    const modal = document.createElement('div');
    modal.id = 'shopStockModal';
    modal.className = 'menu-editor-modal hidden';
    modal.innerHTML = `
      <div class="menu-editor-panel" role="dialog" aria-modal="true" aria-labelledby="shopStockModalTitle">
        <button type="button" class="menu-editor-close" aria-label="Close editor">×</button>
        <h3 id="shopStockModalTitle">Edit Stock</h3>
        <form id="shopStockForm" class="menu-editor-form">
          <div id="shopStockFields"></div>
          <div class="menu-editor-actions">
            <button type="button" class="secondary-btn" id="shopStockCancel">Cancel</button>
            <button type="submit" id="shopStockSubmit">Save Stock</button>
          </div>
        </form>
      </div>
    `;

    window.AKO.wireModalDismiss(modal, 'shopStockCancel');

    modal.querySelector('#shopStockForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const productKey = form.dataset.productKey;
      if (!productKey) return;

      const stocks = {};
      form.querySelectorAll('[data-stock-size]').forEach(input => {
        stocks[input.dataset.stockSize] = Number(input.value) || 0;
      });

      const submitBtn = document.getElementById('shopStockSubmit');
      submitBtn.disabled = true;
      try {
        const res = await fetch(`/api/shop-catalog/${encodeURIComponent(productKey)}/stock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ stocks }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update stock.');

        modal.classList.add('hidden');
        await window.AKOShop?.reload();
      } catch (err) {
        alert(err.message || 'Failed to update stock.');
      } finally {
        submitBtn.disabled = false;
      }
    });

    document.body.appendChild(modal);
  }

  function editSelectedShopItemStock() {
    const selected = getSelectedCard();
    if (!selected) { alert('Select an item first.'); return; }

    const productKey = selected.dataset.productkey;
    const product = window.AKOShop?.getProduct(productKey);
    if (!product) { alert('Could not find that item — try refreshing.'); return; }

    ensureShopStockModal();
    const modal = document.getElementById('shopStockModal');
    const form = document.getElementById('shopStockForm');
    form.dataset.productKey = productKey;
    document.getElementById('shopStockModalTitle').textContent = `Edit Stock — ${product.name || productKey}`;

    const sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['NOSIZE'];
    document.getElementById('shopStockFields').innerHTML = sizes.map(size => `
      <label>
        ${escapeHtml(size)}
        <input type="number" min="0" step="1" data-stock-size="${escapeHtml(size)}" value="${Number(product.stock?.[size] ?? 0)}" />
      </label>
    `).join('');

    modal.classList.remove('hidden');
  }

  /* ── Publish to GitHub ── */
  // Mirrors menu.js's publishMenuStateToGitHub: resolve any staged (base64)
  // images to real committed files first, then publish the catalog snapshot.
  // MongoDB stays the live source of truth throughout — this is a backup/
  // version-history mirror, not a change to what serves the site.
  const IMAGE_MIME_EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };

  // Uploads one product's staged image and updates its Mongo record with the
  // resolved path. GitHub Contents API writes share one branch tip, so callers
  // intentionally publish these in order to avoid competing ref updates.
  // Handles photos staged on the server and older base64 data: URLs alike.
  async function resolveStagedImageForProduct(product) {
    const image = product.image || '';
    const dataMatch = /^data:([^;]+);base64,/.exec(image);
    if (!dataMatch && !image.startsWith(STAGED_IMAGE_PREFIX)) return;

    const ext = dataMatch ? (IMAGE_MIME_EXTENSIONS[dataMatch[1]] || 'png') : image.split('.').pop();
    const filename = `${product.productKey.replace(/\|/g, '-')}.${ext}`;
    const source = dataMatch ? { dataUrl: image } : { stagedImage: image };

    const uploadRes = await fetch('/api/github/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...source, folder: 'Pictures/merch', filename }),
    });
    const uploadData = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !uploadData.ok) {
      throw new Error(uploadData.error || `Failed to upload image for "${product.productKey}".`);
    }

    const updateRes = await fetch(`/api/shop-catalog/${encodeURIComponent(product.productKey)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ image: uploadData.path }),
    });
    const updateData = await updateRes.json().catch(() => ({}));
    if (!updateRes.ok || !updateData.ok) {
      throw new Error(updateData.error || `Failed to save resolved image path for "${product.productKey}".`);
    }
  }

  async function publishShopCatalogToGitHub() {
    const products = window.AKOShop?.getAllProducts() || [];
    for (const product of products) {
      await resolveStagedImageForProduct(product);
    }

    const publishRes = await fetch('/api/shop-catalog/publish', { method: 'POST', credentials: 'same-origin' });
    const publishData = await publishRes.json().catch(() => ({}));
    if (!publishRes.ok || !publishData.ok) {
      throw new Error(publishData.error || 'GitHub publish failed.');
    }

    await window.AKOShop?.reload();

    const commitSha = publishData.publishResult?.commitSha;
    alert(commitSha ? `Published to GitHub. Commit ${commitSha.slice(0, 7)}.` : 'Published to GitHub.');
    return publishData;
  }

  /* ── Collections: create, rename/style, delete, reorder ── */

  const COLLECTION_STYLES = [
    { value: 'grid', name: 'Grid', hint: 'photo grid; sizes and Add to cart appear on hover (like Shirts)' },
    { value: 'row', name: 'Row', hint: 'wide rows with description and price (like Bags)' },
    { value: 'tile', name: 'Tile', hint: 'compact colored tiles (like Bandanas)' },
  ];
  const ARCHIVED_KEY = 'archived';

  async function sendCollectionRequest(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      window.AKO?.editor?.setEditorMode?.(false);
      window.AKO?.editor?.openLoginModal?.();
    }
    return { res, data };
  }

  function showFormError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function ensureCollectionModal() {
    if (document.getElementById('shopCollectionModal')) return;
    const modal = document.createElement('div');
    modal.id = 'shopCollectionModal';
    modal.className = 'menu-editor-modal hidden';
    modal.innerHTML = `
      <div class="menu-editor-panel" role="dialog" aria-modal="true" aria-labelledby="shopCollectionTitle">
        <button type="button" class="menu-editor-close" aria-label="Close">×</button>
        <h3 id="shopCollectionTitle">Create Collection</h3>
        <form id="shopCollectionForm" class="menu-editor-form" novalidate>
          <label>
            Collection name
            <input id="shopCollectionName" type="text" maxlength="60" placeholder="e.g. Fall Drop 2026" />
          </label>
          <fieldset class="collection-style-picker">
            <legend>Card style</legend>
            ${COLLECTION_STYLES.map(style => `
              <label class="collection-style-option">
                <input type="radio" name="collectionStyle" value="${style.value}" />
                <span><strong>${style.name}</strong> — ${style.hint}</span>
              </label>`).join('')}
          </fieldset>
          <p id="shopCollectionError" class="collection-error" role="alert" hidden></p>
          <div class="menu-editor-actions">
            <button type="button" class="secondary-btn" id="shopCollectionCancel">Cancel</button>
            <button type="submit" id="shopCollectionSubmit">Create Collection</button>
          </div>
        </form>
      </div>`;
    window.AKO.wireModalDismiss(modal, 'shopCollectionCancel');

    modal.querySelector('#shopCollectionForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const editKey = form.dataset.editKey || '';
      const label = document.getElementById('shopCollectionName').value.trim();
      const style = form.querySelector('input[name="collectionStyle"]:checked')?.value;
      if (!label) { showFormError('shopCollectionError', 'Give the collection a name.'); return; }
      if (!style) { showFormError('shopCollectionError', 'Choose a card style.'); return; }
      showFormError('shopCollectionError', '');

      const submitBtn = document.getElementById('shopCollectionSubmit');
      submitBtn.disabled = true;
      try {
        const { res, data } = editKey
          ? await sendCollectionRequest(`/api/shop-sections/${encodeURIComponent(editKey)}`, 'PUT', { label, style })
          : await sendCollectionRequest('/api/shop-sections', 'POST', { label, style });
        if (!res.ok || !data.ok) {
          showFormError('shopCollectionError', data.error || 'Could not save the collection.');
          return;
        }
        modal.classList.add('hidden');
        await window.AKOShop?.reload();
        // A filter left on from browsing could hide the collection just saved.
        window.AKOShop?.showAll?.();
        const key = data.section?.key || editKey;
        document.querySelector(`.shop-section[data-section="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } catch (error) {
        showFormError('shopCollectionError', 'Network error. Please try again.');
      } finally {
        submitBtn.disabled = false;
      }
    });

    document.body.appendChild(modal);
  }

  function openCollectionModal(section) {
    ensureCollectionModal();
    const form = document.getElementById('shopCollectionForm');
    form.reset();
    showFormError('shopCollectionError', '');
    if (section) form.dataset.editKey = section.key; else delete form.dataset.editKey;
    document.getElementById('shopCollectionTitle').textContent = section ? `Rename / style — ${section.label}` : 'Create Collection';
    document.getElementById('shopCollectionSubmit').textContent = section ? 'Save' : 'Create Collection';
    document.getElementById('shopCollectionName').value = section?.label || '';
    const radio = section && form.querySelector(`input[name="collectionStyle"][value="${section.style}"]`);
    if (radio) radio.checked = true;
    document.getElementById('shopCollectionModal').classList.remove('hidden');
    document.getElementById('shopCollectionName').focus();
  }

  // New collections go to the top of the page.
  function createShopCollection() {
    openCollectionModal(null);
  }

  function ensureCollectionDeleteModal() {
    if (document.getElementById('shopCollectionDeleteModal')) return;
    const modal = document.createElement('div');
    modal.id = 'shopCollectionDeleteModal';
    modal.className = 'menu-editor-modal hidden';
    modal.innerHTML = `
      <div class="menu-editor-panel" role="dialog" aria-modal="true" aria-labelledby="shopCollectionDeleteTitle">
        <button type="button" class="menu-editor-close" aria-label="Close">×</button>
        <h3 id="shopCollectionDeleteTitle">Delete collection</h3>
        <form id="shopCollectionDeleteForm" class="menu-editor-form">
          <p id="shopCollectionDeleteMessage"></p>
          <label id="shopCollectionMoveLabel">
            <span id="shopCollectionMoveText"></span>
            <select id="shopCollectionMoveTo"></select>
          </label>
          <p id="shopCollectionDeleteError" class="collection-error" role="alert" hidden></p>
          <div class="menu-editor-actions">
            <button type="button" class="secondary-btn" id="shopCollectionDeleteCancel">Cancel</button>
            <button type="submit" id="shopCollectionDeleteSubmit">Delete</button>
          </div>
        </form>
      </div>`;
    window.AKO.wireModalDismiss(modal, 'shopCollectionDeleteCancel');

    modal.querySelector('#shopCollectionDeleteForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const key = form.dataset.deleteKey;
      const moveLabel = document.getElementById('shopCollectionMoveLabel');
      const moveTo = moveLabel.hidden ? undefined : document.getElementById('shopCollectionMoveTo').value;
      const submitBtn = document.getElementById('shopCollectionDeleteSubmit');
      submitBtn.disabled = true;
      try {
        const { res, data } = await sendCollectionRequest(`/api/shop-sections/${encodeURIComponent(key)}`, 'DELETE', moveTo ? { moveTo } : {});
        if (!res.ok || !data.ok) {
          // e.g. items were added since this dialog opened: refresh it.
          showFormError('shopCollectionDeleteError', data.error || 'Could not delete the collection.');
          if (data.needsMove) {
            await window.AKOShop?.reload();
            fillCollectionDeleteForm(key);
            showFormError('shopCollectionDeleteError', data.error);
          }
          return;
        }
        modal.classList.add('hidden');
        await window.AKOShop?.reload();
      } catch (error) {
        showFormError('shopCollectionDeleteError', 'Network error. Please try again.');
      } finally {
        submitBtn.disabled = false;
      }
    });

    document.body.appendChild(modal);
  }

  // A collection with items asks where they go: the Archived collection
  // (hidden from customers) or another collection the staff member picks.
  function fillCollectionDeleteForm(key) {
    const sections = getSections();
    const section = sections.find(s => s.key === key);
    if (!section) return false;
    const items = (window.AKOShop?.getAllProducts() || []).filter(p => p.section === key);
    const form = document.getElementById('shopCollectionDeleteForm');
    form.dataset.deleteKey = key;
    showFormError('shopCollectionDeleteError', '');
    document.getElementById('shopCollectionDeleteTitle').textContent = `Delete "${section.label}"`;

    const moveLabel = document.getElementById('shopCollectionMoveLabel');
    const submitBtn = document.getElementById('shopCollectionDeleteSubmit');
    if (!items.length) {
      document.getElementById('shopCollectionDeleteMessage').textContent = `Delete the empty collection "${section.label}"?`;
      moveLabel.hidden = true;
      submitBtn.textContent = 'Delete collection';
      return true;
    }

    const archived = sections.find(s => s.key === ARCHIVED_KEY);
    const options = [];
    if (key !== ARCHIVED_KEY) {
      options.push({ value: ARCHIVED_KEY, label: archived ? sectionOptionLabel(archived) : 'Archived (hidden from customers)' });
    }
    sections.filter(s => s.key !== key && s.key !== ARCHIVED_KEY)
      .forEach(s => options.push({ value: s.key, label: sectionOptionLabel(s) }));
    if (!options.length) {
      document.getElementById('shopCollectionDeleteMessage').textContent = `"${section.label}" still has ${items.length} item${items.length === 1 ? '' : 's'}, and there is no other collection to move them to. Create another collection first.`;
      moveLabel.hidden = true;
      submitBtn.disabled = true;
      return true;
    }
    submitBtn.disabled = false;
    document.getElementById('shopCollectionDeleteMessage').textContent =
      `"${section.label}" has ${items.length} item${items.length === 1 ? '' : 's'}. They will be moved before the collection is deleted.`;
    document.getElementById('shopCollectionMoveText').textContent = 'Move its items to';
    document.getElementById('shopCollectionMoveTo').innerHTML = options
      .map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('');
    moveLabel.hidden = false;
    submitBtn.textContent = 'Move items and delete';
    return true;
  }

  function deleteShopCollection(key) {
    ensureCollectionDeleteModal();
    document.getElementById('shopCollectionDeleteSubmit').disabled = false;
    if (!fillCollectionDeleteForm(key)) return;
    document.getElementById('shopCollectionDeleteModal').classList.remove('hidden');
    document.getElementById('shopCollectionDeleteCancel').focus();
  }

  // Saves a full new order; baseKeys lets the server refuse it if someone
  // else reordered meanwhile. Either way the page shows the saved order.
  let savingOrder = false;
  async function saveCollectionOrder(keys) {
    const baseKeys = getSections().map(s => s.key);
    if (savingOrder || JSON.stringify(keys) === JSON.stringify(baseKeys)) return;
    savingOrder = true;
    try {
      const { res, data } = await sendCollectionRequest('/api/shop-sections/order', 'POST', { keys, baseKeys });
      if (!res.ok || !data.ok) alert(data.error || 'Could not save the new order.');
    } catch (error) {
      alert('Network error. The order was not saved.');
    } finally {
      savingOrder = false;
      await window.AKOShop?.reload();
    }
  }

  function moveCollection(key, delta) {
    const keys = getSections().map(s => s.key);
    const from = keys.indexOf(key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= keys.length) return;
    [keys[from], keys[to]] = [keys[to], keys[from]];
    saveCollectionOrder(keys);
  }

  // Collection header buttons and drag handles, handled once on the
  // container (it survives re-renders; its contents don't).
  function bindCollectionTools() {
    const container = document.getElementById('shopSections');
    if (!container || container.dataset.collectionToolsBound) return;
    container.dataset.collectionToolsBound = '1';
    const isEditor = () => document.body.classList.contains('editor-enabled');
    let dragKey = null;
    const clearDropMarks = () => container.querySelectorAll('.drop-before, .drop-after, .section-dragging')
      .forEach(el => el.classList.remove('drop-before', 'drop-after', 'section-dragging'));

    container.addEventListener('click', (event) => {
      const button = event.target.closest('[data-section-action]');
      if (!button || !isEditor()) return;
      event.stopPropagation();
      const key = button.closest('.shop-section')?.dataset.section;
      const action = button.dataset.sectionAction;
      if (!key) return;
      if (action === 'up') moveCollection(key, -1);
      else if (action === 'down') moveCollection(key, 1);
      else if (action === 'edit') openCollectionModal(getSections().find(s => s.key === key));
      else if (action === 'delete') deleteShopCollection(key);
    });

    container.addEventListener('dragstart', (event) => {
      const handle = event.target.closest?.('.section-drag');
      if (!handle || !isEditor()) return;
      const section = handle.closest('.shop-section');
      dragKey = section.dataset.section;
      section.classList.add('section-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragKey);
      event.dataTransfer.setDragImage(section, 24, 24);
    });

    const dropPosition = (event, target) => {
      const rect = target.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    };

    container.addEventListener('dragover', (event) => {
      if (!dragKey) return;
      const target = event.target.closest?.('.shop-section');
      if (!target || target.dataset.section === dragKey) return;
      event.preventDefault();
      container.querySelectorAll('.drop-before, .drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
      target.classList.add(dropPosition(event, target) === 'before' ? 'drop-before' : 'drop-after');
    });

    container.addEventListener('drop', (event) => {
      if (!dragKey) return;
      event.preventDefault();
      const target = event.target.closest?.('.shop-section');
      const movedKey = dragKey;
      dragKey = null;
      clearDropMarks();
      if (!target || target.dataset.section === movedKey) return;
      const keys = getSections().map(s => s.key).filter(key => key !== movedKey);
      const at = keys.indexOf(target.dataset.section) + (dropPosition(event, target) === 'after' ? 1 : 0);
      keys.splice(at, 0, movedKey);
      saveCollectionOrder(keys);
    });

    container.addEventListener('dragend', () => {
      dragKey = null;
      clearDropMarks();
    });
  }

  /* ── Editor-mode hook (called by script.js after every toolbar toggle,
        and by shop.js after every catalog render) ── */
  function refreshMenuEditorState() {
    // Entering or leaving editor mode shows or hides the editor-only parts
    // (collection tools, empty and hidden collections).
    window.AKOShop?.renderIfModeChanged?.();
    bindCollectionTools();
    bindShopCardSelection();
  }

  const shopEditorApi = {
    addShopItem,
    editSelectedShopItem,
    editSelectedShopItemStock,
    deleteSelectedShopItem,
    createShopCollection,
    publishShopCatalogToGitHub,
    refreshMenuEditorState,
  };

  window.AKOEditor = window.AKOEditor || (window.AKO && window.AKO.editor) || {};
  Object.assign(window.AKOEditor, shopEditorApi);

  refreshMenuEditorState();

})();
