/* Run in the head so returning visitors never see the landing overlay. */
(function () {
  let returning = false;
  try {
    returning = Boolean(localStorage.getItem('ako_visited'));
    localStorage.setItem('ako_visited', '1');
  } catch (_) {
    // Storage may be disabled; keep the entry button usable in that case.
  }
  window.akoReturningVisitor = returning;
  if (returning) document.documentElement.classList.add('returning-visitor');
})();
