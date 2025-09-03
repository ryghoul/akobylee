// Wait for the DOM to finish loading
document.addEventListener("DOMContentLoaded", function () {
  const landing = document.getElementById("landing");
  const mainContent = document.getElementById("main-content");
  const enterButton = document.getElementById("enter-button");

  // Show landing, keep main hidden initially
  landing.style.display = "flex";
  mainContent.style.display = "none";

  enterButton.addEventListener("click", () => {
    // Optional: remember they entered
    localStorage.setItem("hasVisited", "true");

    // Prepare main content to fade in behind the overlay
    mainContent.style.display = "block";
    mainContent.classList.add("pre-reveal"); // opacity:0; blur(8px)
    document.body.classList.add("no-scroll");

    // Start the cross-fade on the next frame so CSS can apply pre-reveal first
    requestAnimationFrame(() => {
      mainContent.classList.add("reveal");   // animate to opacity:1; blur(0)
      landing.classList.add("dissolve-out"); // fade out overlay
    });

    // Clean up classes after animations end
    mainContent.addEventListener("animationend", () => {
      mainContent.classList.remove("pre-reveal", "reveal");
    }, { once: true });

    landing.addEventListener("animationend", () => {
      landing.style.display = "none";
      landing.setAttribute("aria-hidden", "true");
      document.body.classList.remove("no-scroll");
    }, { once: true });
  });
});
