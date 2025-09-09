document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('drink-modal');
  const modalImage = document.getElementById('modal-image');
  const modalTitle = document.getElementById('modal-title');
  const modalDescription = document.getElementById('modal-description');
  const modalClose = document.getElementById('modal-close');

  const openModal = ({ name, image, desc }) => {
    modalTitle.textContent = name;
    modalDescription.textContent = desc || '';
    modalImage.src = image;
    modal.style.display = 'flex';               // make it participate in layout

    // next frame: add the visible class so transitions run
    requestAnimationFrame(() => {
      modal.classList.add('is-visible');
    });
  };

  const closeModal = () => {
    // remove the class to play the reverse animation
    modal.classList.remove('is-visible');

    // wait for the fade-out to finish, then hide it
    const onEnd = (e) => {
      if (e.target !== modal) return;           // only listen on the backdrop
      modal.style.display = 'none';
      modal.removeEventListener('transitionend', onEnd);
    };
    modal.addEventListener('transitionend', onEnd);
  };

  document.querySelectorAll('.menu-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      const image = card.dataset.image;
      const desc = card.dataset.description || '';
      if (name && image) {
        openModal({ name, image, desc });
      } else {
        console.warn('Missing card data:', card);
      }
    });
  });

  modalClose.addEventListener('click', closeModal);

  // click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
  });
});
