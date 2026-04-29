function initAnimations() {
  if (!window.anime) return;

  anime({
    targets: ".panel, .card",
    opacity: [0, 1],
    translateY: [14, 0],
    delay: anime.stagger(70),
    duration: 450,
    easing: "easeOutQuad",
  });

  anime({
    targets: ".sidebar a, .sidebar button",
    opacity: [0, 1],
    translateX: [-10, 0],
    delay: anime.stagger(45),
    duration: 350,
    easing: "easeOutQuad",
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAnimations);
} else {
  initAnimations();
}
