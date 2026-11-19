// Bandeau du haut épuré : le club seul à gauche (avec la page en cours), le logo Cruza passe dans la barre latérale.
(() => {
  function build() {
    const nav = document.querySelector(".app-navigation");
    if (nav && !nav.querySelector(".sidebar-cruza")) {
      const brand = document.createElement("a");
      brand.className = "sidebar-cruza";
      brand.href = "./";
      brand.setAttribute("aria-label", "Cruza");
      const word = document.createElement("span");
      word.textContent = "cruza";
      const dot = document.createElement("i");
      dot.setAttribute("aria-hidden", "true");
      brand.append(word, dot);
      nav.prepend(brand);
    }
    const header = document.querySelector("body>header");
    const clubBrand = header?.querySelector(".brand");
    if (clubBrand && !header.querySelector(".header-crumb")) {
      const crumb = document.createElement("span");
      crumb.className = "header-crumb";
      crumb.setAttribute("aria-hidden", "true");
      clubBrand.after(crumb);
    }
    updateCrumb();
  }
  // La page en cours = le début du titre de l'onglet (« Votre effectif · Mon club » → « Votre effectif »).
  function updateCrumb() {
    const crumb = document.querySelector("body>header .header-crumb");
    if (!crumb) return;
    const page = document.title.split(" · ")[0].trim();
    crumb.textContent = page ? page : "";
  }
  // Profil : « Coach principal · données existantes » devient « Coach principal » (le détail reste dans l'infobulle).
  function shortenProfile() {
    const trigger = document.querySelector("body>header #coach-profile-trigger");
    if (!trigger) return;
    for (const span of trigger.querySelectorAll("span")) {
      const full = span.textContent || "";
      if (full.includes(" · ") && !span.querySelector("*")) {
        span.title = full;
        span.textContent = full.split(" · ")[0];
      }
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    build();
    shortenProfile();
    // Le menu du profil est construit après ce script et ré-écrit quand le coach change : on surveille tout le bandeau.
    const header = document.querySelector("body>header");
    if (header) new MutationObserver(shortenProfile).observe(header, { childList: true, characterData: true, subtree: true });
    const title = document.querySelector("title");
    if (title) new MutationObserver(updateCrumb).observe(title, { childList: true, characterData: true, subtree: true });
  });
})();
