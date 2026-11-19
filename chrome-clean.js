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
  document.addEventListener("DOMContentLoaded", () => {
    build();
    const title = document.querySelector("title");
    if (title) new MutationObserver(updateCrumb).observe(title, { childList: true, characterData: true, subtree: true });
  });
})();
