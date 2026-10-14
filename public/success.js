/* Confirms a paid Stripe session and reports the result to the customer. */
(function () {
  const statusEl = document.getElementById('successStatus');
  const detailEl = document.getElementById('successDetail');
  const CONFIRM_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 1500;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function showState(state, title, detail) {
    document.body.dataset.state = state;
    if (statusEl) statusEl.textContent = title;
    if (detailEl) detailEl.textContent = detail || '';
  }

  async function confirmOrder() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || params.get('sessionId');

    if (params.get('canceled')) {
      showState('canceled', 'Checkout canceled', 'Your cart is still saved — you can check out again any time.');
      return;
    }

    if (!sessionId) {
      showState('error', 'No order found', 'We couldn’t find an order to confirm. If you were charged, please contact us.');
      return;
    }

    showState(
      'loading',
      'Confirming your order…',
      'Please keep this page open. We’re updating inventory and finalizing your confirmation.'
    );

    for (let attempt = 1; attempt <= CONFIRM_ATTEMPTS; attempt += 1) {
      try {
        const res = await fetch(`/api/confirm-order?session_id=${encodeURIComponent(sessionId)}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to confirm your order.');

        // pending: the payment is confirmed and the server is still finishing
        // the order (it retries on its own), so the customer has nothing to do.
        showState('success', 'Thank you for your order!', data.pending
          ? 'Your payment went through. We’re finishing your order now, and your confirmation email will follow. You can safely leave this page.'
          : 'Your order is confirmed. You can safely leave this page.');
        window.AKO?.clearCart?.();
        return;
      } catch (err) {
        console.error(`[success] confirmation attempt ${attempt} failed:`, err);
        if (attempt < CONFIRM_ATTEMPTS) {
          showState('loading', 'Still confirming your order…', 'Please keep this page open. We’re retrying the final update.');
          await wait(RETRY_DELAY_MS);
          continue;
        }
        showState('error', 'Your payment needs attention', 'If you were charged, please contact us. Keep your confirmation details so we can finish the order.');
      }
    }
  }

  confirmOrder();
})();
