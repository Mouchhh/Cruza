// Accueil : une photo du club dans le bandeau « Bonjour coach », sous un dégradé foncé qui garde le texte lisible.
// Les photos viennent de la bibliothèque du club (Mon club → Photos) ; sans photo, le bandeau garde son fond uni actuel.
// La photo change chaque jour (parmi celles de la bibliothèque).
(() => {
  let applied = "";
  const GRADIENT = "linear-gradient(90deg, rgba(10,24,46,.95) 0%, rgba(10,24,46,.82) 45%, rgba(10,24,46,.42) 100%)";
  function pick() {
    try {
      const rows = (window.clubPhotoLibrary?.cached?.() || []).filter((row) => typeof row.data === "string" && /^data:image\/jpeg;base64,/.test(row.data));
      if (!rows.length) return "";
      const day = Math.floor(Date.now() / 86400000);
      return rows[day % rows.length].data;
    } catch {
      return "";
    }
  }
  function apply() {
    const hero = document.querySelector("body.home-mode .home-hero");
    if (!hero) return;
    const photo = pick();
    if (!photo) {
      if (applied) {
        hero.style.removeProperty("background");
        hero.classList.remove("home-hero-has-photo");
        applied = "";
      }
      return;
    }
    // Styles directs : le thème du club ne les réécrit pas, et ils passent devant les fonds de l'interface.
    if (applied !== photo || !hero.classList.contains("home-hero-has-photo")) {
      hero.style.setProperty("background", GRADIENT + ', url("' + photo + '") center 30% / cover no-repeat', "important");
      hero.classList.add("home-hero-has-photo");
      applied = photo;
    }
  }
  function load() {
    Promise.resolve(window.clubPhotoLibrary?.list?.()).then(apply).catch(() => {});
  }
  document.addEventListener("DOMContentLoaded", load);
  document.addEventListener("club-session-ready", load);
  setInterval(apply, 1500);
})();
