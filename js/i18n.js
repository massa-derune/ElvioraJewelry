// Simple client-side i18n (AR/EN) for UI labels.
// Usage: add data-i18n="key" to elements whose text should change.
// Stores current language in localStorage under "elviora_lang".

(function () {
  const STORAGE_KEY = "elviora_lang";
  const defaultLang = "ar";

  const dict = {
    ar: {
      cart: "السلة",
      favorites: "المفضلة",
      login: "تسجيل الدخول",
      logout: "تسجيل الخروج",
      currency: "تحويل العملة",
      home: "الرئيسية",
      accessories: "اكسسوارات",
      rings: "خواتم",
      sets: "اطقم",
      diversified: "منوع",
      search_placeholder: "اكتب اسم المنتج للبحث عنه",
      view_cart: "عرض السلة",
      checkout: "إتمام الطلب",
      go_to_checkout: "الانتقال للدفع",
      try_camera: "جرّبي بالكاميرا",
      added_to_cart: "تمت إضافة المنتج إلى السلة",
      added_to_fav: "تمت إضافة المنتج إلى المفضلة",
      shopping_cart: "سلة المشتريات",
      shipping_info: "معلومات الشحن",
      name: "الاسم",
      email: "البريد الإلكتروني",
      phone: "رقم الهاتف",
      governorate: "المحافظة",
      address: "تفاصيل السكن",
      notes: "ملاحظات",
      payment_methods: "طرق الدفع",
      total: "الإجمالي",
      empty_cart: "السلة فارغة",
      complete_order: "إتمام الطلب",
      add_to_cart: "إضافة للسلة",
      buy_now: "شراء الآن",
      details: "كافة التفاصيل",
      register: "إنشاء حساب",
      have_account: "لديك حساب بالفعل؟",
      create_account: "إنشاء حساب جديد",
    },
    en: {
      cart: "Cart",
      favorites: "Favorites",
      login: "Login",
      logout: "Logout",
      currency: "Currency",
      home: "Home",
      accessories: "Accessories",
      rings: "Rings",
      sets: "Sets",
      diversified: "More",
      search_placeholder: "Search for a product",
      view_cart: "View cart",
      checkout: "Checkout",
      go_to_checkout: "Proceed to checkout",
      try_camera: "Try with camera",
      added_to_cart: "Added to cart",
      added_to_fav: "Added to favorites",
      shopping_cart: "Shopping cart",
      shipping_info: "Shipping information",
      name: "Name",
      email: "Email",
      phone: "Phone",
      governorate: "Governorate",
      address: "Address",
      notes: "Notes",
      payment_methods: "Payment methods",
      total: "Total",
      empty_cart: "Cart is empty",
      complete_order: "Place order",
      add_to_cart: "Add to cart",
      buy_now: "Buy now",
      details: "Details",
      register: "Register",
      have_account: "Already have an account?",
      create_account: "Create a new account",
    }
  };

  // Build exact-phrase reverse maps so we can translate pages even if
  // some elements don't have data-i18n attributes (safe: only exact matches).
  const rev = {
    ar: {},
    en: {},
  };
  Object.keys(dict.ar).forEach((k) => {
    const ar = String(dict.ar[k]).trim();
    const en = String(dict.en[k] ?? "").trim();
    if (ar) rev.ar[ar] = k;
    if (en) rev.en[en] = k;
  });

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || defaultLang;
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function applyLang(lang) {
    const d = dict[lang] || dict[defaultLang];
    // direction
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === "en") ? "ltr" : "rtl";
    // translate text nodes
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && d[key] != null) el.textContent = d[key];
    });
    // placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key && d[key] != null) el.setAttribute("placeholder", d[key]);
    });

    // Auto-translate exact phrases for elements without attributes.
    // This will not affect product names because they are not in the dictionary.
    const fromMap = (lang === "en") ? rev.ar : rev.en;
    const toMap = d;
    document.querySelectorAll("body *").forEach((el) => {
      // skip elements that already have explicit keys
      if (el.hasAttribute && (el.hasAttribute("data-i18n") || el.hasAttribute("data-i18n-placeholder"))) return;
      if (!el.childNodes || el.childNodes.length !== 1) return; // only simple text nodes
      const node = el.childNodes[0];
      if (!node || node.nodeType !== 3) return;
      const text = String(node.nodeValue).trim();
      if (!text) return;
      const key = fromMap[text];
      if (key && toMap[key] != null) node.nodeValue = toMap[key];
    });
    // expose for other scripts
    window.__ELVIORA_I18N__ = { lang, t: (k) => (d[k] ?? k) };
  }

  function toggleLang() {
    const lang = getLang() === "ar" ? "en" : "ar";
    setLang(lang);
    applyLang(lang);
  }

  // Expose helpers for other scripts (lang_toggle.js, etc.)
  window.elvioraSetLang = (lang) => { setLang(lang); applyLang(lang); };
  window.elvioraGetLang = getLang;
  window.elvioraToggleLang = toggleLang;

  document.addEventListener("DOMContentLoaded", () => {
    applyLang(getLang());
    // ensure globals are set even if script load order differs
    window.elvioraSetLang = window.elvioraSetLang || ((lang) => { setLang(lang); applyLang(lang); });
    window.elvioraGetLang = window.elvioraGetLang || getLang;
    window.elvioraToggleLang = window.elvioraToggleLang || toggleLang;
  });
})();
