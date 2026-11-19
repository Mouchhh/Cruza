// Bannière d'accueil : invite à ajouter des photos du club dans la bibliothèque, tant qu'elle est vide.
// Fermable (la fermeture est mémorisée sur cet appareil).
(() => {
  const KEY = "cruza-photo-banner-dismissed";
  let banner = null,
    ready = false;
  const dismissed = () => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  };
  function build() {
    const box = document.createElement("div"),
      text = document.createElement("p"),
      link = document.createElement("button"),
      close = document.createElement("button");
    box.className = "home-photo-banner";
    // Toujours rouge, quelle que soit la couleur du club (le thème ne touche pas aux styles directs).
    box.style.setProperty("background", "#c62828", "important");
    box.style.setProperty("color", "#ffffff", "important");
    box.style.setProperty("opacity", "1", "important");
    box.setAttribute("role", "note");
    text.style.setProperty("color", "#ffffff", "important");
    text.textContent = "Ajoutez les photos de votre club dans la bibliothèque : elles servent à personnaliser vos causeries.";
    link.type = close.type = "button";
    link.className = "home-photo-banner-link";
    link.textContent = "Ouvrir la bibliothèque →";
    link.onclick = () => {
      if (typeof coachAccountOpen !== "function") return;
      coachAccountOpen("club");
      setTimeout(() => document.querySelector(".club-photo-library")?.scrollIntoView({ block: "start" }), 350);
    };
    close.className = "home-photo-banner-close";
    close.setAttribute("aria-label", "Fermer ce message");
    close.textContent = "×";
    close.onclick = () => {
      try {
        localStorage.setItem(KEY, "1");
      } catch {
        /* Private mode: it only hides until the next visit. */
      }
      update();
    };
    box.append(text, link, close);
    return box;
  }
  function wanted() {
    if (!ready || dismissed()) return false;
    try {
      return window.clubPhotoLibrary.cached().length === 0;
    } catch {
      return false;
    }
  }
  function update() {
    // Bandeau indépendant des widgets : posé sur la page elle-même, fixé en bas de l'écran, il ne bouge pas quand on défile.
    const onHome = document.body.classList.contains("home-mode") && !!document.getElementById("home-live-widgets");
    if (onHome && wanted()) {
      banner ||= build();
      if (banner.parentElement !== document.body) document.body.append(banner);
      document.body.classList.add("home-photo-banner-on");
    } else {
      banner?.remove();
      banner = null;
      document.body.classList.remove("home-photo-banner-on");
    }
  }
  function load() {
    Promise.resolve(window.clubPhotoLibrary?.list?.())
      .then(() => {
        ready = true;
        update();
      })
      .catch(() => {});
  }
  document.addEventListener("DOMContentLoaded", load);
  document.addEventListener("club-session-ready", load);
  setInterval(update, 1500);
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ["class"] });
})();
