document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('drink-modal');
  const modalImage = document.getElementById('modal-image');
  const modalTitle = document.getElementById('modal-title');
  const modalDescription = document.getElementById('modal-description');
  const modalClose = document.getElementById('modal-close');

  document.querySelectorAll('.menu-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      const image = card.dataset.image;
      const desc = card.dataset.description || '';

      if (name && image && desc) {
        modalTitle.textContent = name;
        modalDescription.textContent = desc;
        modalImage.src = image;
        modal.style.display = 'flex';
      } else {
        console.warn('Missing card data:', card);
      }
    });
  });

  modalClose.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
});
