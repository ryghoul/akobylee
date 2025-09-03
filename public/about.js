
  document.addEventListener('DOMContentLoaded', () => {
    const scrollElements = document.querySelectorAll('.animate-on-scroll');

    const elementInView = (el, offset = 100) => {
      const elementTop = el.getBoundingClientRect().top;
      return (
        elementTop <= (window.innerHeight - offset)
      );
    };

    const displayScrollElement = (element) => {
      element.classList.add('in-view');
    };

    const hideScrollElement = (element) => {
      element.classList.remove('in-view');
    };

    const handleScrollAnimation = () => {
      scrollElements.forEach((el) => {
        if (elementInView(el, 100)) {
          displayScrollElement(el);
        } else {
          hideScrollElement(el); // Optional: remove if you want animation only once
        }
      });
    };

    window.addEventListener('scroll', () => {
      handleScrollAnimation();
    });

    // Run on load
    handleScrollAnimation();

// Story video helpers: play/pause, mute/unmute, and pause when off-screen
  const vid = document.getElementById('brandVideo');
  const btnPlay = document.getElementById('videoTogglePlay');
  const btnMute = document.getElementById('videoToggleMute');
  const shell = document.querySelector('.story-video .video-shell');

  // Fade-in the shell when it mounts
  requestAnimationFrame(() => shell.classList.add('is-visible'));

  // Button wiring
  btnPlay?.addEventListener('click', () => {
    if (vid.paused) {
      vid.play();
      btnPlay.textContent = 'Pause';
    } else {
      vid.pause();
      btnPlay.textContent = 'Play';
    }
  });

  btnMute?.addEventListener('click', () => {
    vid.muted = !vid.muted;
    btnMute.textContent = vid.muted ? 'Unmute' : 'Mute';
  });

  // Auto-pause when scrolled far off-screen to save resources
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.intersectionRatio < 0.2) {
          // mostly off screen → pause
          if (!vid.paused) vid.pause();
          btnPlay.textContent = 'Play';
        } else {
          // back in view → play if user hasn't paused
          if (vid.muted && vid.paused) { // light auto resume (muted-autoplay safe)
            vid.play().catch(() => {/* ignore */});
            btnPlay.textContent = 'Pause';
          }
        }
      });
    }, { threshold: [0, 0.2, 0.6] });
    io.observe(vid);
  }
  });
