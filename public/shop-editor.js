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

  const KNOWN_SECTION_LABELS = { shirts: 'Shirts', bags: 'Bags', bandanas: 'Bandanas' };
  const NEW_SECTION_VALUE = '__new__';

  function sectionLabel(section) {
    return KNOWN_SECTION_LABELS[section] || (section.charAt(0).toUpperCase() + section.slice(1));
  }

  // Sections currently rendered on the page (built-in + any custom ones
  // staff have already created) — read straight from the DOM rather than
  // adding another shop.js API, since every section already carries a
  // data-section attribute.
  function knownSections() {
    return [...document.querySelectorAll('.shop-section[data-section]')]
      .map(el => el.dataset.section)
      .filter(Boolean)
      .sort((a, b) => sectionLabel(a).localeCompare(sectionLabel(b)));
  }

  function populateSectionSelect(selected) {
    const select = document.getElementById('shopItemSection');
    const newLabel = document.getElementById('shopItemNewSectionLabel');
    const newInput = document.getElementById('shopItemNewSection');
    if (!select) return;

    const sections = knownSections();
    select.innerHTML = sections.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(sectionLabel(s))}</option>`).join('')
      + `<option value="${NEW_SECTION_VALUE}">+ Create new section...</option>`;

    if (selected && sections.includes(selected)) {
      select.value = selected;
    } else if (selected) {
      // Selected item's section isn't in the known list for some reason —
      // fall back to "new section" so the value isn't silently dropped.
      select.value = NEW_SECTION_VALUE;
      if (newInput) newInput.value = selected;
    }

    const isNew = select.value === NEW_SECTION_VALUE;
    if (newLabel) newLabel.style.display = isNew ? '' : 'none';
    if (newInput && !isNew) newInput.value = '';
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
            Section
            <select id="shopItemSection" name="section"></select>
          </label>
          <label id="shopItemNewSectionLabel" style="display:none">
            New section name
            <input id="shopItemNewSection" type="text" placeholder="e.g. hats" />
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

    // Picking a file just stages it locally as a base64 preview — it isn't
    // committed to GitHub until Publish is clicked (see publishShopCatalogToGitHub).
    modal.querySelector('#shopItemImageUpload').addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await window.AKO.readImageFileAsDataUrl(file);
        document.getElementById('shopItemImage').value = dataUrl;
        const preview = document.getElementById('shopItemImagePreview');
        preview.src = dataUrl;
        preview.classList.add('visible');
      } catch (error) {
        console.error('[shop-editor] image read failed:', error);
        alert('Could not read that image. Try a JPG or PNG.');
      }
    });

    window.AKO.wireModalDismiss(modal, 'shopItemCancel');

    modal.querySelector('#shopItemSection').addEventListener('change', (event) => {
      const isNew = event.target.value === NEW_SECTION_VALUE;
      const newLabel = document.getElementById('shopItemNewSectionLabel');
      const newInput = document.getElementById('shopItemNewSection');
      if (newLabel) newLabel.style.display = isNew ? '' : 'none';
      if (isNew && newInput) newInput.focus();
    });

    modal.querySelector('#shopItemForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const isEdit = !!form.dataset.editKey;

      const productKey = isEdit
        ? form.dataset.editKey
        : document.getElementById('shopItemProductKey').value.trim();
      if (!productKey) { alert('Product Key is required.'); return; }

      const sizes = document.getElementById('shopItemSizes').value
        .split(',').map(s => s.trim()).filter(Boolean);
      const priceDollars = parseFloat(document.getElementById('shopItemPrice').value);
      const price = Number.isFinite(priceDollars) ? Math.round(priceDollars * 100) : 0;

      const sectionSelectValue = document.getElementById('shopItemSection').value;
      const section = sectionSelectValue === NEW_SECTION_VALUE
        ? document.getElementById('shopItemNewSection').value.trim()
        : sectionSelectValue;
      if (!section) { alert('Enter a name for the new section.'); return; }

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
  async function resolveStagedImageForProduct(product) {
    const match = /^data:([^;]+);base64,/.exec(product.image || '');
    if (!match) return;

    const ext = IMAGE_MIME_EXTENSIONS[match[1]] || 'png';
    const filename = `${product.productKey.replace(/\|/g, '-')}.${ext}`;

    const uploadRes = await fetch('/api/github/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ dataUrl: product.image, folder: 'Pictures/merch', filename }),
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

  /* ── Editor-mode hook (called by script.js after every toolbar toggle,
        and by shop.js after every catalog render) ── */
  function refreshMenuEditorState() {
    bindShopCardSelection();
  }

  const shopEditorApi = {
    addShopItem,
    editSelectedShopItem,
    editSelectedShopItemStock,
    deleteSelectedShopItem,
    publishShopCatalogToGitHub,
    refreshMenuEditorState,
  };

  window.AKOEditor = window.AKOEditor || (window.AKO && window.AKO.editor) || {};
  Object.assign(window.AKOEditor, shopEditorApi);

  refreshMenuEditorState();

})();
