document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('reservation-form');

  if (!form) {
    console.error('Reservation form not found.');
    return;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const data = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      date: document.getElementById('date').value,
      time: document.getElementById('time').value,
      partySize: document.getElementById('party-size').value,
      notes: document.getElementById('notes').value
    };

    try {
      const response = await fetch('/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        window.location.href = 'thankyou.html';
      } else {
        alert(result.message || "Something went wrong.");
      }
    } catch (err) {
      console.error('Client fetch error:', err);
      alert('There was a network or server error.');
    }
  });
});
