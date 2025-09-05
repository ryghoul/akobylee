document.addEventListener("DOMContentLoaded", function () {
  const landing = document.getElementById("landing");
  const mainContent = document.getElementById("main-content");
  const enterButton = document.getElementById("enter-button");

  // Check if URL has ?from=home
  const urlParams = new URLSearchParams(window.location.search);
  const fromHome = urlParams.get("from") === "home";

  if (fromHome) {
    // Skip landing if navigated via Home button
    landing.style.display = "none";
    landing.setAttribute("aria-hidden", "true");
    mainContent.style.display = "block";
    return;
  }

  // Otherwise, show landing
  landing.style.display = "flex";
  mainContent.style.display = "none";

  enterButton.addEventListener("click", () => {
    mainContent.style.display = "block";
    mainContent.classList.add("pre-reveal");
    document.body.classList.add("no-scroll");

    requestAnimationFrame(() => {
      mainContent.classList.add("reveal");
      landing.classList.add("dissolve-out");
    });

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
