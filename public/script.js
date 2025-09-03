document.addEventListener('DOMContentLoaded', () => {
  const cartToggle = document.getElementById('cart-toggle');
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartClose = document.getElementById('cart-close');
  const cartItemsContainer = document.getElementById('cart-items');
  const addToCartButtons = document.querySelectorAll('.add-to-cart');
  const totalDisplay = document.getElementById('cart-total');
  const checkoutBtn = document.getElementById('checkout-btn');
  const badge = document.getElementById('cart-badge');

  // ─── OPEN / CLOSE CART ───────────────────────────
  cartToggle.addEventListener('click', e => {
    e.preventDefault();
    cartSidebar.classList.add('open');
    cartSidebar.setAttribute('aria-hidden', 'false');
  });

  cartClose.addEventListener('click', () => {
    cartSidebar.classList.remove('open');
    cartSidebar.setAttribute('aria-hidden', 'true');
  });

  // ─── ADD TO CART BUTTON ───────────────────────────
  addToCartButtons.forEach(button => {
    button.addEventListener('click', () => {
      const productCard = button.closest('.product-card');
      const productInfo = productCard.querySelector('.product-info');
      const name = productInfo.querySelector('h1').innerText;
      const price = productInfo.querySelector('.price-tag')?.innerText || '$0';
      const color = productInfo.querySelector('label:nth-of-type(1) select')?.value || '';
      const size = productInfo.querySelector('label:nth-of-type(2) select')?.value || '';
      const imageEl = productCard.querySelector('.product-image img');
      const image = imageEl ? new URL(imageEl.getAttribute('src'), window.location.origin).href : 'placeholder.jpg';




      const currentCart = JSON.parse(localStorage.getItem('cart')) || [];

      const existingItem = currentCart.find(item =>
        item.name === name && item.color === color && item.size === size
      );

      if (existingItem) {
        existingItem.quantity++;
        } else {
      currentCart.push({ name, price, color, size, quantity: 1, image });
        }

      localStorage.setItem('cart', JSON.stringify(currentCart));
      showToast();
      renderCart();

      cartToggle.classList.add('pulse');
      setTimeout(() => cartToggle.classList.remove('pulse'), 300);
    });
  });

  // ─── CHECKOUT BUTTON ──────────────────────────────
  // ===== Inject checkout modal markup (once) =====
const checkoutModalHTML = `
<div id="checkout-modal" class="ck-modal hidden" aria-hidden="true" role="dialog" aria-modal="true">
  <div class="ck-dialog">
    <button type="button" class="ck-close" id="ck-close" aria-label="Close">×</button>
    <h2>Checkout</h2>
    <form id="checkout-form" novalidate>
      <fieldset class="ck-section">
        <legend>Contact</legend>
        <label>Full Name
          <input type="text" name="name" required autocomplete="name" />
        </label>
        <label>Email
          <input type="email" name="email" required autocomplete="email" />
        </label>
        <label>Phone
          <input type="tel" name="phone" required autocomplete="tel" />
        </label>
      </fieldset>

      <fieldset class="ck-section">
        <legend>Shipping Address</legend>
        <label>Address Line 1
          <input type="text" name="line1" required autocomplete="address-line1" />
        </label>
        <label>Address Line 2 (optional)
          <input type="text" name="line2" autocomplete="address-line2" />
        </label>
        <div class="ck-grid-3">
          <label>City
            <input type="text" name="city" required autocomplete="address-level2" />
          </label>
          <label>State/Province
            <input type="text" name="state" required autocomplete="address-level1" />
          </label>
          <label>ZIP/Postal
            <input type="text" name="postal_code" required autocomplete="postal-code" />
          </label>
        </div>
        <label>Country
          <select name="country" required autocomplete="country">
            <option value="US" selected>United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
            <option value="JP">Japan</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="MX">Mexico</option>
            <option value="SG">Singapore</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </fieldset>

      <fieldset class="ck-section">
        <legend>Select Shipping</legend>
        <label class="ck-radio">
          <input type="radio" name="shipping_zone" value="US" checked />
          <span>US — $5</span>
        </label>
        <label class="ck-radio">
          <input type="radio" name="shipping_zone" value="WORLD" />
          <span>Worldwide — $15</span>
        </label>
      </fieldset>

      <div class="ck-summary">
        <div class="ck-row"><span>Subtotal</span><span id="ck-subtotal">$0.00</span></div>
        <div class="ck-row"><span>Shipping</span><span id="ck-ship">$5.00</span></div>
        <div class="ck-row ck-total"><span>Total</span><span id="ck-total">$0.00</span></div>
      </div>

      <label class="ck-terms">
        <input type="checkbox" id="ck-terms" /> I agree to the
        <a href="/terms.html" target="_blank" rel="noopener">Terms &amp; Conditions</a>
      </label>

      <div class="ck-actions">
        <button type="button" class="btn-outline" id="ck-cancel">Cancel</button>
        <button type="submit" class="btn-outline" id="ck-continue">Continue to Payment</button>
      </div>
      <p class="ck-hint">Taxes are calculated at payment.</p>
    </form>
  </div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', checkoutModalHTML);

// ===== Modal elements & config =====
const checkoutModal = document.getElementById('checkout-modal');
const ckClose = document.getElementById('ck-close');
const ckCancel = document.getElementById('ck-cancel');
const ckForm = document.getElementById('checkout-form');
const ckSubtotal = document.getElementById('ck-subtotal');
const ckShip = document.getElementById('ck-ship');
const ckTotal = document.getElementById('ck-total');
const ckTerms = document.getElementById('ck-terms');
const SHIPPING_RATES = { US: 500, WORLD: 1500 }; // cents

// ===== Replace your existing checkout click handler =====
checkoutBtn.addEventListener('click', () => {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  if (!cart.length) {
    alert('Your cart is empty.');
    return;
  }
  // Prefill from prior attempt (nice UX)
  const saved = JSON.parse(localStorage.getItem('customer_info') || 'null');
  if (saved) {
    const f = ckForm.elements;
    f.name.value = saved.name || '';
    f.email.value = saved.email || '';
    f.phone.value = saved.phone || '';
    f.line1.value = saved.address?.line1 || '';
    f.line2.value = saved.address?.line2 || '';
    f.city.value = saved.address?.city || '';
    f.state.value = saved.address?.state || '';
    f.postal_code.value = saved.address?.postal_code || '';
    f.country.value = saved.address?.country || 'US';
    const zone = saved.shippingZone || 'US';
    ckForm.querySelectorAll('input[name="shipping_zone"]').forEach(r => r.checked = (r.value === zone));
  }

  updateCheckoutSummary(getSelectedShippingZone());
  openCheckoutModal();
});

ckClose.addEventListener('click', closeCheckoutModal);
ckCancel.addEventListener('click', closeCheckoutModal);

// Live update totals when shipping changes
ckForm.addEventListener('change', (e) => {
  if (e.target.name === 'shipping_zone') {
    updateCheckoutSummary(e.target.value);
  }
});

// Submit -> validate -> call your backend (keeps your /create-checkout-session)
ckForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!ckTerms.checked) {
    showToast('Please agree to the Terms & Conditions.');
    return;
  }
  const errs = validateCheckoutForm();
  if (errs.length) {
    showToast(errs[0]);
    return;
  }

  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const { shippingZone, customer } = buildCustomerPayload();

  // Build line items from your cart (same as your current approach)
  const items = cart.map(item => {
    const numericPrice = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
    return {
      name: item.name + (item.color ? ` - ${item.color}` : '') + (item.size ? ` (${item.size})` : ''),
      price: Math.round(numericPrice * 100), // cents
      quantity: item.quantity
    };
  });

  // Add shipping as its own line item
  items.push({
    name: shippingZone === 'US' ? 'Shipping (US)' : 'Shipping (Worldwide)',
    price: SHIPPING_RATES[shippingZone] ?? SHIPPING_RATES.US,
    quantity: 1
  });

  // Persist for prefill next time
  localStorage.setItem('customer_info', JSON.stringify(customer));

  // Disable to prevent double submit
  const continueBtn = document.getElementById('ck-continue');
  continueBtn.classList.add('btn-disabled');

  try {
    const res = await fetch('/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, customer })
    });
    const data = await res.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      console.error('No session URL:', data);
      showToast('Could not start checkout. Please try again.');
      continueBtn.classList.remove('btn-disabled');
    }
  } catch (err) {
    console.error('Checkout error:', err);
    showToast('Checkout failed. Please try again later.');
    continueBtn.classList.remove('btn-disabled');
  }
});

// ===== Helpers =====
function openCheckoutModal() {
  checkoutModal.classList.remove('hidden');
  checkoutModal.setAttribute('aria-hidden', 'false');
}
function closeCheckoutModal() {
  checkoutModal.classList.add('hidden');
  checkoutModal.setAttribute('aria-hidden', 'true');
}
function getSelectedShippingZone() {
  const r = ckForm.querySelector('input[name="shipping_zone"]:checked');
  return r ? r.value : 'US';
}
function updateCheckoutSummary(zone) {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  let subtotal = 0;
  cart.forEach(it => {
    const p = parseFloat(it.price.replace(/[^0-9.]/g, '')) || 0;
    subtotal += p * it.quantity;
  });
  const shipCents = SHIPPING_RATES[zone] ?? SHIPPING_RATES.US;
  ckSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  ckShip.textContent = `$${(shipCents/100).toFixed(2)}`;
  ckTotal.textContent = `$${(subtotal + shipCents/100).toFixed(2)}`;
}
function validateCheckoutForm() {
  const f = ckForm.elements;
  const req = ['name','email','phone','line1','city','state','postal_code','country'];
  const errors = [];
  for (const key of req) if (!f[key].value.trim()) errors.push(`Please enter your ${key.replace('_',' ')}.`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) errors.push('Please enter a valid email address.');
  if (f.phone.value.replace(/[^\d]/g,'').length < 7) errors.push('Please enter a valid phone number.');
  return errors;
}
function buildCustomerPayload() {
  const f = ckForm.elements;
  const shippingZone = getSelectedShippingZone();
  const customer = {
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    phone: f.phone.value.trim(),
    shippingZone,
    address: {
      line1: f.line1.value.trim(),
      line2: f.line2.value.trim(),
      city: f.city.value.trim(),
      state: f.state.value.trim(),
      postal_code: f.postal_code.value.trim(),
      country: f.country.value
    }
  };
  return { shippingZone, customer };
}


  // ─── RENDER CART ──────────────────────────────────
  function renderCart() {
    cartItemsContainer.innerHTML = '';
    const cart = JSON.parse(localStorage.getItem('cart')) || [];

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
      if (totalDisplay) totalDisplay.textContent = 'Total: $0.00';
      if (checkoutBtn) checkoutBtn.style.display = 'none';
      if (badge) badge.style.display = 'none';
      return;
    } else {
      if (checkoutBtn) checkoutBtn.style.display = 'block';
    }

    cart.forEach((item, index) => addCartItemToDOM(item, index));

    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const index = Number(e.target.closest('.cart-item').dataset.index);
        const cart = JSON.parse(localStorage.getItem('cart')) || [];

        cart.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
        renderCart();
      });
    });

    document.querySelectorAll('.qty-plus').forEach(btn => {
      btn.addEventListener('click', e => {
        const index = Number(e.target.closest('.cart-item').dataset.index);
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        cart[index].quantity++;
        localStorage.setItem('cart', JSON.stringify(cart));
        renderCart();
      });
    });

    document.querySelectorAll('.qty-minus').forEach(btn => {
      btn.addEventListener('click', e => {
        const index = Number(e.target.closest('.cart-item').dataset.index);
        const cart = JSON.parse(localStorage.getItem('cart')) || [];

        if (cart[index].quantity > 1) {
          cart[index].quantity--;
        } else {
          cart.splice(index, 1);
        }

        localStorage.setItem('cart', JSON.stringify(cart));
        renderCart();
      });
    });

    let total = 0;
    cart.forEach(item => {
      const numericPrice = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
      total += numericPrice * item.quantity;
    });

    if (totalDisplay) {
      totalDisplay.textContent = `Total: $${total.toFixed(2)}`;
    }

    if (badge) {
      const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
      badge.style.display = itemCount ? 'inline-block' : 'none';
      badge.textContent = itemCount;
    }
  }

  // ─── ADD CART ITEM TO DOM ─────────────────────────
  function addCartItemToDOM(item, index) {
    const div = document.createElement('div');
    div.classList.add('cart-item');
    div.dataset.index = index;

    div.innerHTML = `
      <div class="cart-item-content">
        <img src="${item.image || 'placeholder.jpg'}" alt="${item.name}" class="cart-thumb" />
        <div class="cart-details">
          <p><strong>${item.name}</strong> - ${item.price}</p>
          ${item.color ? `<p>Color: ${item.color}</p>` : ''}
          ${item.size ? `<p>Size: ${item.size}</p>` : ''}
          <div class="qty-controls">
            <button class="qty-minus">−</button>
            <span class="item-qty">${item.quantity}</span>
            <button class="qty-plus">+</button>
          </div>
          <button class="remove-btn">Remove</button>
        </div>
      </div>
      <hr>
    `;

    cartItemsContainer.appendChild(div);
  }

  // ─── TOAST ─────────────────────────────────────────
  function showToast(message = 'Added to cart!') {
    const toast = document.getElementById('cart-toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2000);
  }

  // ─── INITIAL RENDER ───────────────────────────────
  renderCart();
});
