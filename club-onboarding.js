// Première connexion : une fenêtre pour régler le minimum de l'apparence du site (nom, logo, couleurs).
// Elle s'affiche tant que le club n'a jamais été configuré sur ce compte, une seule fois ; tout reste modifiable
// ensuite dans Paramètres → Mon club.
(() => {
  const DONE_KEY = "vestiaire-club-onboarding-done";
  let shown = false;
  const text = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
  };
  function needed() {
    if (shown || document.querySelector("dialog[open]")) return false;
    const root = document.documentElement;
    if (root.classList.contains("club-private-request") && !root.classList.contains("club-authenticated")) return false;
    try {
      if (typeof coachStorageGet !== "function" || typeof coachClubDetailsKey === "undefined") return false;
      if (coachStorageGet(DONE_KEY)) return false;
      return !coachStorageGet(coachClubDetailsKey);
    } catch {
      return false;
    }
  }
  const markDone = () => {
    try {
      coachStorageSet(DONE_KEY, "1");
    } catch {
      /* Without storage the window may come back on the next visit. */
    }
  };
  async function shrinkLogo(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const side = 256,
        scale = Math.min(side / bitmap.width, side / bitmap.height),
        canvas = document.createElement("canvas");
      canvas.width = canvas.height = side;
      const w = Math.round(bitmap.width * scale),
        h = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, (side - w) / 2, (side - h) / 2, w, h);
      let value = canvas.toDataURL("image/png");
      if (value.length > 200000) value = canvas.toDataURL("image/jpeg", 0.85);
      return value;
    } finally {
      bitmap.close();
    }
  }
  function open() {
    if (!needed()) return;
    shown = true;
    const dialog = text("dialog", "club-onboarding"),
      form = text("form", "club-onboarding-form"),
      title = text("h2", "", "Bienvenue sur Cruza"),
      intro = text("p", "club-onboarding-intro", "Donnez une identité à votre espace. Cela ne prend qu’une minute et reste modifiable à tout moment dans Paramètres → Mon club."),
      status = text("p", "club-onboarding-status");
    dialog.setAttribute("aria-labelledby", "club-onboarding-title");
    title.id = "club-onboarding-title";
    status.setAttribute("role", "status");
    const field = (label, input) => {
      const wrap = text("label", "club-onboarding-field", label);
      input.setAttribute("aria-label", label);
      wrap.append(input);
      return wrap;
    };
    const name = document.createElement("input");
    name.type = "text";
    name.maxLength = 70;
    name.required = true;
    name.autocomplete = "organization";
    name.placeholder = "Ex. : FC Les Lilas";
    const primary = document.createElement("input"),
      secondary = document.createElement("input");
    primary.type = secondary.type = "color";
    primary.value = (window.clubTheme?.defaults?.primary || "#2855a2").toLowerCase();
    secondary.value = (window.clubTheme?.defaults?.secondary || "#e41f28").toLowerCase();
    const colors = text("div", "club-onboarding-colors");
    colors.append(field("Couleur principale", primary), field("Couleur secondaire", secondary));
    const logoInput = document.createElement("input"),
      preview = document.createElement("img");
    logoInput.type = "file";
    logoInput.accept = "image/png,image/jpeg,image/webp";
    preview.className = "club-onboarding-logo";
    preview.alt = "";
    preview.hidden = true;
    let logoValue = "";
    logoInput.onchange = async () => {
      const file = logoInput.files[0];
      status.textContent = "";
      if (!file) return;
      if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
        status.textContent = "Choisissez une image de moins de 15 Mo.";
        return;
      }
      try {
        logoValue = await shrinkLogo(file);
        preview.src = logoValue;
        preview.hidden = false;
      } catch {
        status.textContent = "Image illisible : essayez un PNG ou un JPEG.";
      }
    };
    const logoWrap = field("Logo du club (facultatif)", logoInput);
    const actions = text("div", "club-onboarding-actions"),
      save = text("button", "primary", "Enregistrer et commencer"),
      skip = text("button", "export", "Passer pour l’instant");
    save.type = "submit";
    skip.type = "button";
    actions.append(save, skip);
    form.append(title, intro, field("Nom du club", name), colors, logoWrap, preview, status, actions);
    dialog.append(form);
    document.body.append(dialog);
    const finish = () => {
      markDone();
      dialog.close();
      dialog.remove();
    };
    skip.onclick = finish;
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish();
    });
    form.onsubmit = (event) => {
      event.preventDefault();
      if (!name.value.trim()) {
        status.textContent = "Indiquez le nom de votre club.";
        name.focus();
        return;
      }
      try {
        const value = {
          ...coachClubDetailsDefaults(),
          name: name.value.trim(),
          ...(primary.value.toLowerCase() !== clubTheme.defaults.primary ? { primaryColor: primary.value.toLowerCase() } : {}),
          ...(secondary.value.toLowerCase() !== clubTheme.defaults.secondary ? { secondaryColor: secondary.value.toLowerCase() } : {}),
          ...(logoValue ? { logo: logoValue } : {}),
        };
        if (!coachClubDetailsValid(value)) throw new Error("invalid");
        coachStorageSet(coachClubDetailsKey, JSON.stringify(value));
        clubTheme.apply(value);
        window.clubNameRefresh?.();
        finish();
      } catch {
        status.textContent = "Enregistrement impossible : vérifiez le nom du club.";
      }
    };
    dialog.showModal();
    name.focus();
  }
  const check = () => setTimeout(open, 600);
  document.addEventListener("DOMContentLoaded", check);
  document.addEventListener("club-session-ready", check);
})();
