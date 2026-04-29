function getCookie(name) {
  let v = null;
  if (document.cookie && document.cookie !== "") {
    const parts = document.cookie.split(";");
    for (let i = 0; i < parts.length; i++) {
      const c = parts[i].trim();
      if (c.startsWith(name + "=")) {
        v = decodeURIComponent(c.slice(name.length + 1));
        break;
      }
    }
  }
  return v;
}

function bbFetch(url, options = {}) {
  const opts = { credentials: "same-origin", ...options };
  const method = (opts.method || "GET").toUpperCase();
  const headers = { ...(opts.headers || {}) };
  if (!headers["Content-Type"] && opts.body && typeof opts.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = getCookie("csrftoken");
    if (token) headers["X-CSRFToken"] = token;
  }
  return fetch(url, { ...opts, headers }).then((res) => {
    if (res.status === 401 || res.status === 403) {
      window.location.href = "/login/?next=" + encodeURIComponent(window.location.pathname);
    }
    return res;
  });
}

function getStoredMode() {
  return {
    mode: localStorage.getItem("journal_mode") || "normal",
    activeProfileId: localStorage.getItem("active_profile_id") || "",
  };
}

function applyTheme() {
  const theme = localStorage.getItem("theme") || "dark-mode";
  document.body.classList.remove("dark-mode", "light-mode");
  document.body.classList.add(theme);
}

function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("toggleSidebar");
  if (sidebar && toggle) {
    toggle.addEventListener("click", () => {
      if (window.innerWidth <= 900) {
        sidebar.classList.toggle("open");
      } else {
        sidebar.classList.toggle("collapsed");
      }
    });
    sidebar.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 900) sidebar.classList.remove("open");
      });
    });
  }
  const modeSwitch = document.getElementById("modeSwitch");
  if (modeSwitch) {
    modeSwitch.addEventListener("click", () => {
      const next = document.body.classList.contains("dark-mode") ? "light-mode" : "dark-mode";
      localStorage.setItem("theme", next);
      applyTheme();
    });
  }
}

function applyPageFadeIn() {
  const main = document.querySelector(".main-content");
  if (main) main.classList.add("fade-in");
}

applyTheme();
initSidebar();
applyPageFadeIn();
