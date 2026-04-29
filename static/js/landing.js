(function () {
  var THEME_KEY = "theme";

  function applyLandingTheme() {
    var t = localStorage.getItem(THEME_KEY) || "dark-mode";
    document.body.classList.remove("dark-mode", "light-mode");
    document.body.classList.add(t === "light-mode" ? "light-mode" : "dark-mode");
  }

  applyLandingTheme();

  var btn = document.getElementById("landingTheme");
  if (btn) {
    btn.addEventListener("click", function () {
      var next = document.body.classList.contains("dark-mode") ? "light-mode" : "dark-mode";
      localStorage.setItem(THEME_KEY, next);
      applyLandingTheme();
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    var id = a.getAttribute("href");
    if (id.length > 1) {
      a.addEventListener("click", function (e) {
        var el = document.querySelector(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  });
})();
