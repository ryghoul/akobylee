(function () {
  function getApiBase() {
    const isLocal =
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3000' : ''; // relative in prod
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(() => {
    const form = document.getElementById('contact-form');
    if (!form) {
      console.error('[contact] #contact-form not found');
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        name:    document.getElementById('name')?.value?.trim(),
        email:   document.getElementById('email')?.value?.trim(),
        message: document.getElementById('message')?.value?.trim(),
        // match server-side honeypot key; keep it empty
        website: ''
      };

      if (!data.name || !data.email || !data.message) {
        alert('Please fill out name, email, and message.');
        return;
      }

      const API = getApiBase();

      try {
        const resp = await fetch(`${API}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const bodyText = await resp.text();
        let payload = null;
        try { payload = JSON.parse(bodyText); } catch {}

        if (resp.ok) {
          alert(payload?.message || 'Message sent successfully!');
          form.reset();
        } else {
          const msg = payload?.message || bodyText || `Request failed (${resp.status})`;
          alert(msg);
          console.error('Contact error:', { status: resp.status, msg, bodyText, payload });
        }
      } catch (err) {
        alert('Network error sending message.');
        console.error('Fetch failed:', err);
      }
    });
  });
})();