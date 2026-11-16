// Club colours and logo applied to the whole site from the coach's club profile.
// Brand colours are written literally in many stylesheets: they are replaced in the
// CSSOM (hex, rgb()/rgba() and custom properties), originals kept to switch back.
(() => {
  const SOURCES = {
    primary: ["#2855a2", "#214fa0", "#244e95", "#214a90", "#245499", "#0055a5", "#0b2e8a", "#1b3f86", "#4777bd", "#79afe3"],
    // Navy shades, including the blue filter over the home page photos.
    dark: { "#142d50": 0.45, "#102e58": 0.45, "#17385d": 0.38, "#193c66": 0.35, "#0b192c": 0.8, "#071c55": 0.4, "#25456d": 0.25, "#23456d": 0.25, "#24466d": 0.25, "#18345b": 0.4, "#19365d": 0.4, "#193d71": 0.3, "#173d71": 0.3, "#1b2d52": 0.5, "#102c54": 0.45, "#19314c": 0.5, "#203958": 0.5, "#203e64": 0.4, "#345278": 0.2, "#1d3d68": 0.3, "#29466f": 0.3, "#294462": 0.3, "#2c476a": 0.35 },
    // Pale blue tints and light accents: the club colour, washed out.
    light: { "#b9c9e0": 0.78, "#dce7f7": 0.88, "#96b5e2": 0.45, "#bfd2f2": 0.72, "#d6e4fa": 0.84, "#d6e3f7": 0.84, "#d6e3f3": 0.84, "#e1eafa": 0.88, "#e1e8f4": 0.88, "#dce5f1": 0.86, "#eef3fb": 0.93, "#eef2fb": 0.93, "#eef2fa": 0.93, "#edf2f9": 0.93, "#f2f6fc": 0.95 },
    secondary: ["#e41f28", "#e31b23"],
  };
  const DEFAULTS = { primary: "#2855a2", secondary: "#e41f28" };
  const originals = new Map(); // CSSStyleDeclaration -> Map(prop -> [value, priority])
  const parse = (hex) => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrastWithWhite = (rgb) => 1.05 / (luminance(rgb) + 0.05);
  const mix = (rgb, other, t) => rgb.map((v, i) => v + (other[i] - v) * t);
  // Colours used as button backgrounds with white text: darkened until 4.5:1.
  function readable(hex) {
    let rgb = parse(hex);
    for (let i = 0; i < 40 && contrastWithWhite(rgb) < 4.5; i++) rgb = mix(rgb, [0, 0, 0], 0.06);
    return rgb;
  }
  // Bright colours (yellow, lime, cyan…) cannot carry white text: darkening them in RGB turns yellow into
  // olive mud. Lean towards amber/gold and keep them saturated instead.
  const toHsl = (rgb) => {
    const [r, g, b] = rgb.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    return [h < 0 ? h + 360 : h, s, l];
  };
  const fromHsl = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r + m, g + m, b + m].map((v) => v * 255);
  };
  const isBright = (rgb) => contrastWithWhite(rgb) < 3.2;
  function deepen(hex) {
    let [h, s, l] = toHsl(parse(hex));
    if (h >= 45 && h <= 100) h = 42 + (h - 42) * 0.25;
    s = Math.max(s, 0.8);
    let rgb = fromHsl(h, s, l);
    for (let i = 0; i < 70 && contrastWithWhite(rgb) < 3.4; i++) rgb = fromHsl(h, s, (l -= 0.01));
    return rgb;
  }
  function palette(details) {
    const primary = /^#[0-9a-f]{6}$/i.test(details?.primaryColor || "") ? details.primaryColor : DEFAULTS.primary,
      secondary = /^#[0-9a-f]{6}$/i.test(details?.secondaryColor || "") ? details.secondaryColor : DEFAULTS.secondary,
      custom = primary.toLowerCase() !== DEFAULTS.primary || secondary.toLowerCase() !== DEFAULTS.secondary,
      bright = isBright(parse(primary)),
      p = bright ? deepen(primary) : readable(primary),
      map = new Map();
    for (const h of SOURCES.primary) {
      // Keep the small lightness gaps between the original blues.
      const delta = luminance(parse(h)) - luminance(parse(DEFAULTS.primary));
      map.set(parse(h).join(","), delta > 0 ? mix(p, [255, 255, 255], Math.min(0.12, delta * 2)) : mix(p, [0, 0, 0], Math.min(0.12, -delta * 2)));
    }
    for (const [h, t] of Object.entries(SOURCES.dark)) {
      // Bright club colour: near-black charcoal with a faint warm tint instead of an olive/brown "dark yellow".
      if (bright) { const [ph, , ] = toHsl(p), [, , ol] = toHsl(parse(h)); map.set(parse(h).join(","), fromHsl(ph, 0.2, Math.max(0.07, ol * 0.55))); }
      else map.set(parse(h).join(","), mix(p, [0, 0, 0], t));
    }
    for (const [h, t] of Object.entries(SOURCES.light)) map.set(parse(h).join(","), mix(p, [255, 255, 255], t));
    for (const h of SOURCES.secondary) map.set(parse(h).join(","), readable(secondary));
    // Vivid/bright club colour: backgrounds become a soft pastel (with dark text), text and borders keep the deeper tone.
    let bgMap = null;
    const primaryKeys = new Set(SOURCES.primary.map((h) => parse(h).join(",")));
    if (bright) {
      const [ph, ps, pl] = toHsl(parse(primary)), base = fromHsl(ph, Math.min(ps, 0.78), Math.min(Math.max(pl, 0.68), 0.78));
      bgMap = new Map(map);
      for (const h of SOURCES.primary) {
        const delta = luminance(parse(h)) - luminance(parse(DEFAULTS.primary));
        bgMap.set(parse(h).join(","), delta > 0 ? mix(base, [255, 255, 255], Math.min(0.12, delta * 2)) : mix(base, [0, 0, 0], Math.min(0.08, -delta * 2)));
      }
    }
    return { custom, map, bgMap, primaryKeys, pastel: bgMap ? toHex(bgMap.get(parse(DEFAULTS.primary).join(","))) : null, primary: toHex(p), secondary: toHex(readable(secondary)) };
  }
  const COLOR = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b|rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)/gi;
  function replaceColors(value, map) {
    return value.replace(COLOR, (match, hex, r, g, b, a) => {
      let rgb, alpha;
      if (hex) {
        const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
        rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
        alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : null;
      } else {
        rgb = [r, g, b].map(Number);
        alpha = a === undefined ? null : a.endsWith("%") ? parseFloat(a) / 100 : parseFloat(a);
      }
      const target = map.get(rgb.join(","));
      if (!target) return match;
      const [tr, tg, tb] = target.map((v) => Math.round(v));
      return alpha === null ? toHex(target) : "rgba(" + tr + ", " + tg + ", " + tb + ", " + +alpha.toFixed(3) + ")";
    });
  }
  const PRIMARY_VARS = /var\(--(?:smfc-blue|club-blue|club-accent|club-theme-primary)\s*(?:,[^)]*)?\)/gi;
  const PRIMARY_VARS_T = new RegExp(PRIMARY_VARS.source, "i");
  function usesPrimary(value, keys) {
    for (const m of value.matchAll(COLOR)) {
      const [, hex, r, g, b] = m;
      let rgb;
      if (hex) { const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex; rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)); }
      else rgb = [r, g, b].map(Number);
      if (keys.has(rgb.join(","))) return true;
    }
    return false;
  }
  function eachStyle(rules, fn) {
    for (const rule of rules) {
      if (rule.style) fn(rule.style);
      if (rule.cssRules) eachStyle(rule.cssRules, fn);
    }
  }
  function restore() {
    for (const [style, props] of originals) for (const [prop, [value, priority]] of props) style.setProperty(prop, value, priority);
    originals.clear();
  }
  function applyColors(details) {
    restore();
    const { custom, map, bgMap, primaryKeys, pastel, primary, secondary } = palette(details);
    document.documentElement.style.setProperty("--club-theme-primary", primary);
    document.documentElement.style.setProperty("--club-theme-secondary", secondary);
    if (!custom) return;
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // Cross-origin font sheets cannot be read and carry no brand colour.
      }
      eachStyle(rules, (style) => {
        let pastelBackground = false;
        if (bgMap) {
          // `background: var(--smfc-blue)` hides its longhands from the loop below: read the shorthand.
          const sh = style.getPropertyValue("background");
          if (sh && PRIMARY_VARS_T.test(sh)) {
            PRIMARY_VARS.lastIndex = 0;
            if (!originals.has(style)) originals.set(style, new Map());
            if (!originals.get(style).has("background")) originals.get(style).set("background", [sh, style.getPropertyPriority("background")]);
            style.setProperty("background", sh.replace(PRIMARY_VARS, pastel), style.getPropertyPriority("background"));
            pastelBackground = true;
          }
          PRIMARY_VARS.lastIndex = 0;
        }
        for (let i = 0; i < style.length; i++) {
          const prop = style[i],
            value = style.getPropertyValue(prop);
          const viaVar = bgMap && /^background/.test(prop) && /var\(--(?:smfc-blue|club-blue|club-accent|club-theme-primary)/i.test(value);
          if (!value || !(viaVar || /#|rgb/i.test(value))) continue;
          const isBackground = bgMap && /^background/.test(prop);
          let next = replaceColors(value, isBackground ? bgMap : map);
          // Backgrounds that read the club colour through a variable (var(--smfc-blue)…) get the pastel too.
          if (isBackground && PRIMARY_VARS_T.test(next)) { next = next.replace(PRIMARY_VARS, pastel); pastelBackground = true; }
          if (next === value) continue;
          if (isBackground && usesPrimary(value, primaryKeys)) pastelBackground = true;
          if (!originals.has(style)) originals.set(style, new Map());
          if (!originals.get(style).has(prop)) originals.get(style).set(prop, [value, style.getPropertyPriority(prop)]);
          style.setProperty(prop, next, style.getPropertyPriority(prop));
        }
        // White text on a pastel background would vanish: switch it to a dark ink.
        if (pastelBackground) {
          const color = style.getPropertyValue("color");
          if (/^(#fff(fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i.test(color.trim())) {
            if (!originals.has(style)) originals.set(style, new Map());
            if (!originals.get(style).has("color")) originals.get(style).set("color", [color, style.getPropertyPriority("color")]);
            style.setProperty("color", "#1d2230", style.getPropertyPriority("color"));
          }
        }
      });
    }
  }
  const LOGO = "assets/club-logo.jpg";
  let logoObserver = null;
  // Site identity images are recognised by marker (.club-logo, header) or by the
  // original file, not only by their current URL (a composition may carry its own logo).
  const identity = (img) => img.matches(".club-logo, header img, .account-club-brand img") || (img.getAttribute("src") || "").includes(LOGO);
  function swapLogo(img, logo) {
    if (!identity(img)) return;
    if (logo) {
      if (img.getAttribute("src") !== logo) {
        if (!img.dataset.clubLogoOriginal) img.dataset.clubLogoOriginal = img.getAttribute("src") || LOGO;
        img.setAttribute("src", logo);
      }
    } else if (img.dataset.clubLogoOriginal) {
      const original = img.dataset.clubLogoOriginal;
      delete img.dataset.clubLogoOriginal;
      if (img.getAttribute("src") !== original) img.setAttribute("src", original);
    }
  }
  function applyLogo(details) {
    const logo = /^data:image\/(jpeg|png|webp);base64,/.test(details?.logo || "") ? details.logo : "";
    for (const img of document.querySelectorAll("img")) swapLogo(img, logo);
    for (const link of document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')) {
      if (!link.dataset.clubLogoOriginal) link.dataset.clubLogoOriginal = link.getAttribute("href");
      link.setAttribute("href", logo || link.dataset.clubLogoOriginal);
    }
    logoObserver?.disconnect();
    logoObserver = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes") swapLogo(r.target, logo);
        for (const node of r.addedNodes || [])
          if (node.nodeType === 1) for (const img of node.matches?.("img") ? [node] : node.querySelectorAll?.("img") || []) swapLogo(img, logo);
      }
    });
    logoObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  }
  function apply(details = typeof coachClubDetailsRead === "function" ? coachClubDetailsRead() : null) {
    try {
      applyColors(details);
      applyLogo(details);
    } catch {
      /* The default theme stays usable. */
    }
  }
  window.clubTheme = { apply, palette, readable: (hex) => toHex(readable(hex)), defaults: DEFAULTS };
  if (document.readyState === "complete") apply();
  else window.addEventListener("load", () => apply());
})();
