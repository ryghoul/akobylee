 document.getElementById('contact-form').addEventListener('submit', async function(e) {
      e.preventDefault();

      const data = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        message: document.getElementById('message').value
      };

      try {
        const response = await fetch('/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
          alert("Message sent successfully!");
          document.getElementById('contact-form').reset();
        } else {
          alert(result.message || "Something went wrong.");
        }
      } catch (err) {
        alert("Error sending message.");
        console.error(err);
      }
    });