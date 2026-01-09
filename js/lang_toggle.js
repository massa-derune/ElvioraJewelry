// Global language toggle (AR <-> EN)
// - Always renders a small floating button so it never breaks due to header markup differences.
// - Also tries to render inside the header if a suitable container exists.

(function () {
  const STORAGE_KEY = "elviora_lang";

  function currentLang() {
    return localStorage.getItem(STORAGE_KEY) || document.documentElement.lang || "ar";
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    if (typeof window.elvioraSetLang === "function") {
      window.elvioraSetLang(lang);
    } else if (window.I18N && typeof window.I18N.setLanguage === "function") {
      window.I18N.setLanguage(lang);
    } else {
      document.documentElement.lang = lang;
      document.documentElement.dir = (lang === "ar") ? "rtl" : "ltr";
    }
    updateBtnText(lang);
  }

  function updateBtnText(lang) {
    const t = (lang === "ar") ? "EN" : "AR";
    document.querySelectorAll(".js-lang-toggle").forEach((b) => {
      b.textContent = t;
      b.setAttribute("aria-label", (lang === "ar") ? "Switch to English" : "التبديل للعربية");
    });
  }

  function makeButton(className) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className + " js-lang-toggle";
    btn.addEventListener("click", () => {
      const next = currentLang() === "ar" ? "en" : "ar";
      setLang(next);
    });
    return btn;
  }

  function ensureStyles() {
    if (document.getElementById("langToggleStyles")) return;
    const style = document.createElement("style");
    style.id = "langToggleStyles";
    style.textContent = `
      .lang-fab{position:fixed;bottom:18px;left:18px;z-index:2147483646;
        width:44px;height:44px;border-radius:999px;border:0;
        box-shadow:0 10px 25px rgba(0,0,0,.18);
        background:#111;color:#fff;font-weight:700;letter-spacing:.5px;
        display:flex;align-items:center;justify-content:center;cursor:pointer;
      }
      html[dir="ltr"] .lang-fab{left:auto;right:18px}
      .lang-fab:hover{opacity:.92}
      .lang-inline{border:1px solid rgba(0,0,0,.12);background:#fff;color:#111;
        padding:.35rem .6rem;border-radius:10px;font-weight:700;
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureStyles();

    // Prefer a single inline header button. If no header container exists, fall back to a floating FAB.
    const headerSlot =
      document.querySelector(".left-header") ||
      document.querySelector(".top-header .left-header") ||
      document.querySelector("[data-header-actions]") ||
      document.querySelector("header .container") ||
      null;
    if (headerSlot) {
      // Remove any existing FAB to avoid duplicates across pages.
      document.querySelectorAll(".lang-fab").forEach((n) => n.remove());
      if (!headerSlot.querySelector(".lang-inline")) {
        const inline = makeButton("lang-inline");
        headerSlot.insertBefore(inline, headerSlot.firstChild);
      }
    } else {
      // No header slot found on this page. Avoid creating duplicates if another script/markup already injected a button.
      const anyBtn = document.querySelector(".lang-inline, .lang-fab");
      if (!anyBtn) {
        const fab = makeButton("lang-fab");
        document.body.appendChild(fab);
      }
    }

    // Apply stored language on load
    updateBtnText(currentLang());
    setLang(currentLang());
  });
})();
