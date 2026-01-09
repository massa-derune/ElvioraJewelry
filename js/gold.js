/* ======================================================
   ELVIORA â€“ Frontend Logic
   - Safe init for Swiper/Isotope (won't crash if libs missing)
   - Favorites + Cart (LocalStorage)
   - Quick view modal fill + qty + add/buy
====================================================== */

// Flags (optional):
// - __ELVIORA_BACKEND_CART_FAV: enable DB-backed cart/favorites (default OFF)
// - __ELVIORA_USE_DB_CART_FAV: legacy flag (default OFF)
try {
  window.__ELVIORA_BACKEND_CART_FAV = window.__ELVIORA_BACKEND_CART_FAV || false;
  window.__ELVIORA_USE_DB_CART_FAV = window.__ELVIORA_USE_DB_CART_FAV || false;
} catch (_) {}

(function () {
  "use strict";

  // Global toast helper (single, consistent)
  window.__elvioraNotify = window.__elvioraNotify || function (message, type, opts) {
    type = type || "success";
    const duration = (opts && opts.duration)
      ? Number(opts.duration)
      : (type === "success" ? 5200 : 3200);
    try {
      var container = document.getElementById("elvioraToastContainer");
      if (!container) {
        container = document.createElement("div");
        container.id = "elvioraToastContainer";
        container.className = "toast-container position-fixed bottom-0 start-0 p-3";
        container.style.zIndex = "99999";
        document.body.appendChild(container);
      }
      // keep a single toast visible
      container.innerHTML = "";

      var toastEl = document.createElement("div");
      var bg = "elviora-toast";
      if (type === "warning") bg += " elviora-toast-warning";
      else if (type === "danger" || type === "error") bg += " elviora-toast-danger";
      else if (type === "info") bg += " elviora-toast-info";
      else bg += " elviora-toast-success";
      toastEl.className = "toast align-items-center " + bg + " border-0";
      toastEl.setAttribute("role", "alert");
      toastEl.setAttribute("aria-live", "assertive");
      toastEl.setAttribute("aria-atomic", "true");
      toastEl.innerHTML =
        '<div class="d-flex">' +
        '  <div class="toast-body">' + String(message || "") + '</div>' +
        '  <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
        '</div>';
      container.appendChild(toastEl);

      if (window.bootstrap && window.bootstrap.Toast) {
        new window.bootstrap.Toast(toastEl, { delay: duration }).show();
      } else {
        toastEl.style.display = "block";
        setTimeout(function () { try { toastEl.remove(); } catch (e) {} }, duration);
      }
    } catch (e) {
      try { console.log(message); } catch (_) {}
    }
  };

  // IMPORTANT:
  // Cart/Favorites UX:
  // - Guest users: localStorage (works like most global stores)
  // - Checkout: requires login and saves order into DB
  // A second (optional) DB-backed cart/favorites layer exists, but if enabled *together* with
  // localStorage handlers you'll get duplicated toasts (success + error). Keep it OFF by default.
  const BACKEND_MODE = !!window.__ELVIORA_BACKEND_CART_FAV;
  try { window.__ELVIORA_USE_DB_CART_FAV = BACKEND_MODE; } catch {}

  /* ---------------------------
 * Tiny notifications
 ------------------------- */
  const notify = (message, type = "success") => {
    try { window.__elvioraNotify(message, type); } catch (e) { try { console.log(message); } catch(_){} }
  };

  /* ---------------------------
   * Helpers
   ------------------------- */

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const readJSON = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "") ?? fallback;
    } catch {
      return fallback;
    }
  };

  const writeJSON = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const normalizePriceUsd = (raw) => {
    // Accept: "6,000", "7,500$", "ط§ظ„ط³ط¹ط± : 1,400$", " 450 " ...
    const s = String(raw ?? "");
    const m = s.match(/[0-9]+(?:[.,][0-9]+)*/g);
    if (!m) return 0;
    const joined = m.join("");
    const num = Number(joined.replace(/,/g, ""));
    return Number.isFinite(num) ? num : 0;
  };

  const formatUsd = (n) => (Number(n) || 0).toLocaleString("en-US") + "$";

  /* ---------------------------
   * Storage models
   ------------------------- */

  // IMPORTANT: keep cart storage key consistent across the whole site
  // (cart_backend.js / checkout_backend.js rely on this key)
  const CART_KEY = "elviora_cart";
  const FAV_KEY = "favorites";

  // migrate from older key if needed (backward compatibility)
  const LEGACY_CART_KEY = "cart";

  const getCart = () => {
    const current = readJSON(CART_KEY, null);
    if (current && Array.isArray(current)) return current;
    const legacy = readJSON(LEGACY_CART_KEY, null);
    if (legacy && Array.isArray(legacy) && legacy.length) {
      writeJSON(CART_KEY, legacy);
      try { localStorage.removeItem(LEGACY_CART_KEY); } catch {}
      return legacy;
    }
    return [];
  };
  const setCart = (cart) => writeJSON(CART_KEY, cart);
  const getFavs = () => readJSON(FAV_KEY, []);
  const setFavs = (favs) => writeJSON(FAV_KEY, favs);

  const cartCountEl = () => document.getElementById("cartCount");
  const favCountEl = () => document.getElementById("favCount");

  const calcCartCount = (cart) => cart.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

  const updateBadges = () => {
    const cart = getCart();
    const favs = getFavs();
    const cEl = cartCountEl();
    const fEl = favCountEl();

    if (cEl) {
      const c = calcCartCount(cart);
      cEl.textContent = String(c);
      cEl.classList.toggle("d-none", c === 0);
    }
    if (fEl) {
      const f = favs.length;
      fEl.textContent = String(f);
      fEl.classList.toggle("d-none", f === 0);
    }
  };

  const findProductCard = (el) => el?.closest?.(".product") || null;

  const productFromCard = (card) => {
    if (!card) return null;
    const id = String(card.dataset.id || "").trim() || "0";

    const title = (qs(".product-title", card)?.textContent || "").trim();
    const desc = (qs(".product-description", card)?.textContent || "").trim();
    const category = (qs(".product-category", card)?.textContent || "").trim();

    const img = qs(".product-img", card)?.getAttribute("src") ||
      qs(".add-to-cart", card)?.dataset?.img || "";

    // Prefer button data-price (more consistent) then visible price.
    const btn = qs(".add-to-cart", card);
    const usdFromBtn = normalizePriceUsd(btn?.dataset?.price);
    const usdFromText = normalizePriceUsd(qs(".product-price", card)?.textContent);
    const priceUsd = usdFromBtn || usdFromText || 0;

    return { id, title, desc, category, img, priceUsd };
  };

  /* ---------------------------
   * Favorites
   ------------------------- */


  const isFav = (id) => getFavs().some((x) => String(x.id) === String(id));

  const toggleFav = (product) => {
    if (!product) return;
    const favs = getFavs();
    const idx = favs.findIndex((x) => String(x.id) === String(product.id));
    if (idx >= 0) {
      favs.splice(idx, 1);
      notify("تمت إزالة المنتج من المفضلة", "warning");
    } else {
      favs.push({ id: product.id, title: product.title, img: product.img, priceUsd: product.priceUsd });
      notify("تمت إضافة المنتج إلى المفضلة", "success");
    }
    setFavs(favs);
    updateBadges();
    syncFavIcons();
    renderFavOffcanvas();
  };

  const syncFavIcons = () => {
    qsa(".product").forEach((card) => {
      const id = card.dataset.id;
      const icon = qs(".favorite-btn i", card);
      if (!icon) return;
      const active = isFav(id);
      icon.classList.toggle("fa-solid", active);
      icon.classList.toggle("fa-regular", !active);
    });
  };

   const renderFavOffcanvas = () => {
    const list = document.getElementById("favList");
    if (!list) return;
    const favs = getFavs();

    list.innerHTML = "";

    if (favs.length === 0) {
      const li = document.createElement("li");
      li.className = "text-center text-muted";
      li.textContent = "لا توجد منتجات في المفضلة.";
      list.appendChild(li);
      return;
    }

    favs.forEach((p) => {
      const li = document.createElement("li");
      li.className = "d-flex align-items-center gap-2 border-bottom py-2";
      li.innerHTML = `
        <img src="${p.img || "images/img2.jpg"}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:8px;">
        <div class="flex-grow-1">
          <div class="fw-semibold">${p.title || "منتج"}</div>
          <small class="text-muted">${formatUsd(p.priceUsd)}</small>
        </div>
        <div class="d-flex flex-column gap-1">
          <button class="btn btn-sm btn-danger fav-remove" data-id="${p.id}">حذف</button>
          <button class="btn btn-sm btn-primary fav-add" data-id="${p.id}">سلة</button>
        </div>
      `;
      list.appendChild(li);
    });
  };


  /* ---------------------------
   * Cart
   ------------------------- */

  const addToCart = (product, qty = 1) => {
    if (!product) return;
    qty = Math.max(1, Number(qty) || 1);
    const cart = getCart();
    const idx = cart.findIndex((x) => String(x.id) === String(product.id));
    if (idx >= 0) cart[idx].qty = (Number(cart[idx].qty) || 0) + qty;
    else cart.push({ id: product.id, title: product.title, img: product.img, priceUsd: product.priceUsd, qty });
    setCart(cart);
    updateBadges();
    renderCartOffcanvas();
       notify("تمت إضافة المنتج إلى السلة", "success");
  };

  const removeFromCart = (id) => {
    const cart = getCart().filter((x) => String(x.id) !== String(id));
    setCart(cart);
    updateBadges();
    renderCartOffcanvas();
    renderCartPage();
  };

  const setCartQty = (id, qty) => {
    qty = Number(qty) || 1;
    const cart = getCart();
    const item = cart.find((x) => String(x.id) === String(id));
    if (!item) return;
    item.qty = Math.max(1, qty);
    setCart(cart);
    updateBadges();
    renderCartOffcanvas();
    renderCartPage();
  };

  const cartTotalUsd = (cart) => cart.reduce((sum, i) => sum + (Number(i.priceUsd) || 0) * (Number(i.qty) || 0), 0);

  const renderCartOffcanvas = () => {
    const wrap = qs(".row-mini-card");
    const totalEl = document.getElementById("cartTotal");
    if (!wrap || !totalEl) return;

    const cart = getCart();
    wrap.innerHTML = "";

   const total = cartTotalUsd(cart);
    totalEl.textContent = `مجموع المنتجات: ${total.toLocaleString("en-US")} $.`;

    if (cart.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-center text-muted";
      empty.textContent = "السلة فارغة.";
      wrap.appendChild(empty);
      return;
    }

    cart.forEach((p) => {
      const item = document.createElement("div");
      item.className = "col-12 mb-2";
      item.innerHTML = `
        <div class="d-flex gap-2 align-items-center border rounded p-2">
          <img src="${p.img || "images/img2.jpg"}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:10px;">
          <div class="flex-grow-1">
            <div class="fw-semibold">${p.title || "منتج"}</div>
            <small class="text-muted">${formatUsd(p.priceUsd)}</small>
          </div>
          <div class="d-flex flex-column gap-1 align-items-end">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-secondary cart-dec" data-id="${p.id}">-</button>
              <button class="btn btn-outline-secondary" disabled>${p.qty}</button>
              <button class="btn btn-outline-secondary cart-inc" data-id="${p.id}">+</button>
            </div>
            <button class="btn btn-sm btn-danger cart-remove" data-id="${p.id}">حذف</button>
          </div>
        </div>
      `;
      wrap.appendChild(item);
    });
  };

  /* ---------------------------
   * Cart page (cart.html)
   ------------------------- */

  const renderCartPage = () => {
    const cart = getCart();

    // New cart.html layout (cards)
    const cardsWrap = document.getElementById("cartItems");
    const subtotalEl = document.getElementById("subtotal");
    const discountEl = document.getElementById("discount");
    const finalTotalEl = document.getElementById("finalTotal");

    
    if (cardsWrap) {
      cardsWrap.innerHTML = "";
      if (cart.length === 0) {
        const empty = document.createElement("div");
        empty.className = "text-center text-muted py-4";
        empty.textContent = "السلة فارغة.";
        cardsWrap.appendChild(empty);
      } else {
        cart.forEach((p) => {
          const row = document.createElement("div");
          row.className = "d-flex align-items-center gap-3 border-bottom py-3";
          row.innerHTML = `
            <img src="${p.img || "images/img2.jpg"}" alt="" style="width:90px;height:90px;object-fit:cover;border-radius:12px;">
            <div class="flex-grow-1">
              <div class="fw-semibold">${p.title || "منتج"}</div>
              <div class="text-muted small">${formatUsd(p.priceUsd)}</div>
              <div class="mt-2">
                <div class="btn-group btn-group-sm" role="group">
                  <button class="btn btn-outline-secondary cart-dec" data-id="${p.id}">-</button>
                  <button class="btn btn-outline-secondary" disabled>${p.qty}</button>
                  <button class="btn btn-outline-secondary cart-inc" data-id="${p.id}">+</button>
                </div>
                <button class="btn btn-sm btn-danger ms-2 cart-remove" data-id="${p.id}">حذف</button>
              </div>
            </div>
            <div class="fw-semibold">${((p.priceUsd || 0) * (p.qty || 0)).toLocaleString("en-US")} $</div>
          `;
          cardsWrap.appendChild(row);
        });
      }

      const subtotal = cartTotalUsd(cart);
      const discount = 0;
      const finalTotal = Math.max(0, subtotal - discount);
      if (subtotalEl) subtotalEl.textContent = subtotal.toLocaleString("en-US");
      if (discountEl) discountEl.textContent = discount.toLocaleString("en-US");
      if (finalTotalEl) finalTotalEl.textContent = finalTotal.toLocaleString("en-US");
      return;
    }

    // Legacy cart page layout (table)
    const tableBody = document.getElementById("cartTableBody");
    const totalEl = document.getElementById("cartPageTotal");
    if (!tableBody && !totalEl) return;

    if (tableBody) tableBody.innerHTML = "";
    const total = cartTotalUsd(cart);
    if (totalEl) totalEl.textContent = total.toLocaleString("en-US") + " $";

    if (!tableBody) return;
    cart.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img src="${p.img || "images/img2.jpg"}" style="width:60px;height:60px;object-fit:cover;border-radius:10px;"></td>
       <td>${p.title || "منتج"}</td>
        <td>${formatUsd(p.priceUsd)}</td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-secondary cart-dec" data-id="${p.id}">-</button>
            <button class="btn btn-outline-secondary" disabled>${p.qty}</button>
            <button class="btn btn-outline-secondary cart-inc" data-id="${p.id}">+</button>
          </div>
        </td>
        <td>${((p.priceUsd || 0) * (p.qty || 0)).toLocaleString("en-US")} $</td>
        <td><button class="btn btn-sm btn-danger cart-remove" data-id="${p.id}">ط­ط°ظپ</button></td>
      `;
      tableBody.appendChild(tr);
    });
  };

  /* ---------------------------
   * Quick view modal
   ------------------------- */

  const modalEl = () => document.getElementById("quick-product");
  const modalTitle = () => document.getElementById("modalTitle");
  const modalTitle2 = () => document.getElementById("modalTitle2");
  const modalDesc = () => document.getElementById("modalDesc");
  const modalPrice = () => document.getElementById("modalPrice");
  const modalImg = () => document.getElementById("modalImg");
  const modalCategory = () => document.getElementById("modalCategory");

  let currentModalProduct = null;
  let currentQty = 1;

  const setModalQty = (q) => {
    currentQty = Math.max(1, Number(q) || 1);
    const qtyBtn = qs("#quick-product .qty-btn");
    if (qtyBtn) qtyBtn.textContent = String(currentQty);
  };

  const fillModal = (product) => {
    currentModalProduct = product;
    setModalQty(1);

    if (modalTitle()) modalTitle().textContent = product?.title || "";
    if (modalTitle2()) modalTitle2().textContent = product?.title || "";
    if (modalDesc()) modalDesc().textContent = product?.desc || "";
     if (modalPrice()) modalPrice().textContent = `السعر: ${formatUsd(product?.priceUsd || 0)}`;
    if (modalImg()) modalImg().src = product?.img || "";
    if (modalCategory()) modalCategory().textContent = product?.category || "";

    // Details button
    const detailsBtn = qs("#quick-product .btn-primary");
    if (detailsBtn) {
      detailsBtn.onclick = () => {
        // استخدام الصفحة الجديدة المحسنة
        const id = encodeURIComponent(product?.id || "0");
        window.location.href = "product.html?id=" + id;
      };
    }
  };

  /* ---------------------------
   * Safe UI init (Isotope/Swiper)
   ------------------------- */

  const initIsotopeSafe = () => {
    // معطل لتجنب إعادة ترتيب الشبكة بعد التحميل
    return;
  };

  const initSwiperSafe = () => {
    try {
      if (!window.Swiper) return;
      const el = document.querySelector(".swiper");
      if (!el) return;
      // eslint-disable-next-line no-new
      new window.Swiper(".swiper", {
        loop: true,
        spaceBetween: 20,
        pagination: { el: ".swiper-pagination" },
        navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
        slidesPerView: 'auto', /* السماح للبطاقات بأخذ عرضها الطبيعي */
        breakpoints: {
          320: { spaceBetween: 15 },
          640: { spaceBetween: 18 },
          768: { spaceBetween: 20 },
          1024: { spaceBetween: 20 },
          1200: { spaceBetween: 20 },
        },
      });
    } catch {
      // ignore
    }
  };

  /* ---------------------------
   * Global event delegation
   ------------------------- */

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t) return;

    // Favorite toggle
    const favBtn = t.closest?.(".favorite-btn");
    if (favBtn && !BACKEND_MODE) {
      const card = findProductCard(favBtn);
      toggleFav(productFromCard(card));
      return;
    }

    // Add to cart (from card)
    const addBtn = t.closest?.(".product .add-to-cart");
    if (addBtn && !addBtn.closest("#quick-product") && !BACKEND_MODE) {
      const card = findProductCard(addBtn);
      addToCart(productFromCard(card), 1);
      return;
    }

    // Add to cart / buy now (product page buttons)
    const pageAdd = t.closest?.(".add-btn .add-to-cart");
    if (pageAdd && !pageAdd.closest("#quick-product") && !BACKEND_MODE) {
      const p = {
        id: pageAdd.getAttribute("data-id") || "0",
        title: pageAdd.getAttribute("data-title") || "منتج",
        img: pageAdd.getAttribute("data-img") || "",
        priceUsd: normalizePriceUsd(pageAdd.getAttribute("data-price")),
      };
      addToCart(p, 1);
      return;
    }
    const pageBuy = t.closest?.(".add-btn .buy-now");
    if (pageBuy && !pageBuy.closest("#quick-product") && !BACKEND_MODE) {
      const p = {
        id: pageBuy.getAttribute("data-id") || "0",
        title: pageBuy.getAttribute("data-title") || "منتج",
        img: pageBuy.getAttribute("data-img") || "",
        priceUsd: normalizePriceUsd(pageBuy.getAttribute("data-price")),
      };
      addToCart(p, 1);
      window.location.href = "checkout.html";
      return;
    }

    // Quick view
    const quick = t.closest?.(".quick-view-btn");
    if (quick) {
      const card = findProductCard(quick);
      fillModal(productFromCard(card));
      return;
    }

    // Modal qty
    if (t.closest?.("#quick-product .increase")) {
      setModalQty(currentQty + 1);
      return;
    }
    if (t.closest?.("#quick-product .decrease")) {
      setModalQty(currentQty - 1);
      return;
    }

    // Modal add / buy
    if (t.closest?.("#quick-product .add-btn .add-to-cart") && !BACKEND_MODE) {
      addToCart(currentModalProduct, currentQty);
      return;
    }
    if (t.closest?.("#quick-product .add-btn .buy-now") && !BACKEND_MODE) {
      addToCart(currentModalProduct, currentQty);
      window.location.href = "checkout.html";
      return;
    }

    // Fav offcanvas actions
    const favRemove = t.closest?.(".fav-remove");
    if (favRemove) {
      const id = favRemove.getAttribute("data-id");
      const favs = getFavs().filter((x) => String(x.id) !== String(id));
      setFavs(favs);
      updateBadges();
      syncFavIcons();
      renderFavOffcanvas();
      return;
    }
    const favAdd = t.closest?.(".fav-add");
    if (favAdd) {
      const id = favAdd.getAttribute("data-id");
      const p = getFavs().find((x) => String(x.id) === String(id));
      if (p) addToCart(p, 1);
      return;
    }

    // Cart actions (offcanvas + cart page)
    const cartInc = t.closest?.(".cart-inc");
    if (cartInc) {
      const id = cartInc.getAttribute("data-id");
      const item = getCart().find((x) => String(x.id) === String(id));
      if (item) setCartQty(id, (Number(item.qty) || 0) + 1);
      return;
    }
    const cartDec = t.closest?.(".cart-dec");
    if (cartDec) {
      const id = cartDec.getAttribute("data-id");
      const item = getCart().find((x) => String(x.id) === String(id));
      if (item) setCartQty(id, (Number(item.qty) || 1) - 1);
      return;
    }
    const cartRemove = t.closest?.(".cart-remove");
    if (cartRemove) {
      removeFromCart(cartRemove.getAttribute("data-id"));
      return;
    }

    
    // Checkout page submit
    const submitOrderTrigger = t.closest?.("#submitOrder");
    if (submitOrderTrigger) {
      placeOrder();
      return;
    }

// Offcanvas nav
    const viewCartTrigger = t.closest?.("#viewCartBtn");
    if (viewCartTrigger) {
      window.location.href = "cart.html";
      return;
    }
    const checkoutTrigger = t.closest?.("#checkoutBtn");
    if (checkoutTrigger) {
      // On checkout page, this button submits the order
      if (document.getElementById("checkoutForm")) {
        placeOrder();
      } else {
        window.location.href = "checkout.html";
      }
      return;
    }
  });

  
  /* ---------------------------
   * Checkout page (checkout.html)
   ------------------------- */
  const renderCheckoutPage = () => {
    const wrap = document.getElementById("checkoutProducts");
    const totalEl = document.getElementById("finalTotal");
    if (!wrap && !totalEl) return;

    const cart = getCart();
    const total = cartTotalUsd(cart);

    if (totalEl) totalEl.textContent = total.toLocaleString("en-US") + " $";

    if (!wrap) return;
    wrap.innerHTML = "";

    if (cart.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-center text-muted py-2";
       empty.textContent = "السلة فارغة.";
      wrap.appendChild(empty);
      return;
    }

    cart.forEach((p) => {
      const row = document.createElement("div");
      row.className = "d-flex align-items-center gap-2 border-bottom py-2";
      row.innerHTML = `
        <img src="${p.img || "images/img2.jpg"}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:10px;">
        <div class="flex-grow-1">
          <div class="fw-semibold">${p.title || "منتج"}</div>
          <small class="text-muted">${p.qty} أ— ${formatUsd(p.priceUsd)}</small>
        </div>
        <div class="fw-semibold">${((p.priceUsd || 0) * (p.qty || 0)).toLocaleString("en-US")} $</div>
      `;
      wrap.appendChild(row);
    });
  };

  /* ---------------------------
   * UI normalization
   ------------------------- */

  // Force all product cards to show USD only (keep currency converter in header)
  const enforceUsdOnly = () => {
    qsa(".product-price").forEach((el) => {
      const card = el.closest(".product");
      const btn = card ? qs(".add-to-cart", card) : null;
      const usd = normalizePriceUsd(btn?.dataset?.price) || normalizePriceUsd(el.textContent);
      if (!usd) return;
      const formatted = usd.toLocaleString("en-US");
      el.textContent = "السعر: " + formatted + "$";
      if (btn) btn.dataset.price = formatted + "$";
    });
    qsa(".price_new").forEach((el) => {
      const usd = normalizePriceUsd(el.textContent);
      if (!usd) return;
      const formatted = usd.toLocaleString("en-US");
      el.textContent = formatted + "$";
      el.dir = "ltr";
      el.style.unicodeBidi = "plaintext";
    });
  };
// Keep header icons order consistent across pages
  const reorderHeaderButtons = () => {
    const wrap = document.querySelector(".left-header");
    if (!wrap) return;

    // Ensure a logout button exists (hidden until logged-in)
    if (!wrap.querySelector(".js-logoutBtn")) {
      const logout = document.createElement("a");
      logout.href = "#";
      logout.className = "js-logoutBtn d-none";
      logout.setAttribute("data-role", "logoutBtn");
      logout.innerHTML = `<span>تسجيل خروج</span> <i class="fa-solid fa-arrow-right-from-bracket"></i>`;
      // insert right after login link if present
      const loginLink = wrap.querySelector("[href='#login']");
      if (loginLink && loginLink.nextSibling) wrap.insertBefore(logout, loginLink.nextSibling);
      else wrap.appendChild(logout);
    }
    // Tag the login link so auth.js can find it
    wrap.querySelectorAll("[href='#login']").forEach((el) => {
      el.classList.add("js-loginBtn");
      el.setAttribute("data-role", "loginBtn");
    });

    const items = Array.from(wrap.children).filter((n) => n && n.nodeType === 1);
    if (items.length < 2) return;

    const score = (el) => {
      const href = el.getAttribute?.("href") || el.querySelector?.("a")?.getAttribute?.("href") || "";
      const txt = (el.textContent || "").trim();
      const role = (el.getAttribute?.("data-role") || "").toLowerCase();
      const key = href + " " + txt + " " + role;
      if (role.includes("login") || key.includes("#login")) return 1;     // الدخول
      if (role.includes("logout") || key.includes("logout")) return 2;    // تسجيل خروج
      if (key.includes("#cart")) return 3;                                // السلة
      if (key.includes("#currency")) return 4;                            // تحويل العملة
      if (key.includes("#fav")) return 5;                                 // المفضلة
      return 99;
    };

    items.sort((a, b) => score(a) - score(b));
    items.forEach((el) => wrap.appendChild(el));
  };

  /* ---------------------------
   * Checkout auth guard
   * - disables submit and shows login offcanvas if user is not logged in
   ------------------------- */
  const toggleCheckoutLock = (locked) => {
    const btn = document.getElementById("submitOrder");
    if (btn) btn.disabled = !!locked;
    const alertBox = document.getElementById("checkoutLoginAlert");
    if (alertBox) alertBox.classList.toggle("d-none", !locked);
  };

  const ensureCheckoutAuth = async () => {
    const form = document.getElementById("checkoutForm");
    if (!form) return;
    try {
      const res = await fetch("actions/check_session.php", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      const logged = !!(data && data.logged_in);
      toggleCheckoutLock(!logged);
      if (!logged) {
        notify("يجب تسجيل الدخول قبل إتمام الطلب.", "warning");
        try {
          const loginEl = document.getElementById("login");
          if (loginEl && window.bootstrap) new window.bootstrap.Offcanvas(loginEl).show();
        } catch {}
      }
    } catch {
      toggleCheckoutLock(false);
    }
  };

  /* ---------------------------
   * Place order (backend)
   * - sends checkout + cart to actions/place_order.php
   * - stores in DB (orders + order_items)
   ------------------------- */
   const placeOrder = async () => {
    // Checkout requires login, but cart/fav can be used as guest.
    try {
      const sRes = await fetch("actions/check_session.php", { credentials: "include" });
      const s = await sRes.json().catch(() => ({}));
      if (!s || !s.logged_in) {
        notify("يرجى تسجيل الدخول لإتمام عملية الدفع.", "warning");
        // Open login offcanvas if exists
        try {
          const loginEl = document.getElementById("login");
          if (loginEl && window.bootstrap) new bootstrap.Offcanvas(loginEl).show();
        } catch {}
        return;
      }
    } catch {
      notify("تعذر التحقق من تسجيل الدخول. تأكدي من تشغيل السيرفر.", "danger");
      return;
    }

    const cart = getCart();
    const cartPayload = (cart && cart.length > 0) ? cart : null;

    // basic validation (only if fields exist)
    const form = document.getElementById("checkoutForm");
    if (form) {
      const required = Array.from(form.querySelectorAll("[required]"));
      const missing = required.find((i) => !String(i.value || "").trim());
      if (missing) {
        notify("يرجى تعبئة معلومات الشحن المطلوبة.", "warning");
        try { missing.focus(); } catch {}
        return;
      }
    }


    // Collect customer fields (if present)
    const fullName = document.getElementById("fullName")?.value || "";
    const email = document.getElementById("email")?.value || "";
    const phone = document.getElementById("phone")?.value || "";
    const city = document.getElementById("citySelect")?.value || "";
    const address = document.getElementById("address")?.value || "";
    const notes = document.getElementById("notes")?.value || "";

    // payment method (support both old/new markup)
    let payment = "";
    const p = document.querySelector("input[name='payment_method']:checked, input[name='payment']:checked");
    if (p) payment = p.value || p.id || "";

    try {
      const res = await fetch("actions/place_order.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customer: { fullName, email, phone, city, address, notes, payment },
          cart: cartPayload,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const code = (data && data.error) || "";
                const errors = {
          LOGIN_REQUIRED: "Login required before completing the order.",
          MISSING_FIELDS: "Please fill name, email, phone, and address.",
          CART_EMPTY: "Cart is empty. Add products then try again.",
          INVALID_JSON: "Sent data is invalid.",
          ORDER_FAILED: "Order save failed. Check database and try again.",
        };
        const msg = data?.message || errors[code] || "Could not complete order. Check form data and database.";
        notify(msg, "danger");
        try { console.error("Checkout failed", { status: res.status, code, data }); } catch {}
        if (code === "LOGIN_REQUIRED") {
          try {
            const loginEl = document.getElementById("login");
            if (loginEl && window.bootstrap) new window.bootstrap.Offcanvas(loginEl).show();
          } catch {}
        }
        return;
      }

     notify(
        `تم استلام طلبك بنجاح. رقم الطلب: ${data.order_id}. سنراجع البيانات ونتواصل معك للتأكيد.`,
        "success",
        { duration: 6500 }
      );


      // Clear frontend cart after saving to DB
      setCart([]);
      updateBadges();
      renderCartOffcanvas();
      renderCartPage();
      renderCheckoutPage();

      setTimeout(() => {
        window.location.href = "index.html";
      }, 900);
    } catch (e) {
     
      notify("فشل الاتصال بالخادم. تأكدي من تشغيل XAMPP ووجود قاعدة البيانات.", "danger");
   
    }
  };

  /* ---------------------------
   * إظهار الأسعار المخفضة للمنتجات المحددة
   ------------------------- */
  const showDiscountedPrices = () => {
    // المنتجات التي عليها خصم مع أسعارها القديمة والجديدة
    const discountedProducts = {
      "خاتم ذهب على شكل قلب": { oldPrice: "270$", newPrice: "220$" },
      "تعليقة ذهب حرف B": { oldPrice: "180$", newPrice: "150$" },
      "طقم ذهب الدمعة": { oldPrice: "850$", newPrice: "720$" }
    };

    // البحث عن المنتجات وتحديث أسعارها
    document.querySelectorAll('.product-title').forEach(titleElement => {
      const productTitle = titleElement.textContent.trim();
      
      if (discountedProducts[productTitle]) {
        const priceContainer = titleElement.closest('.product-info').querySelector('.price, .product-price');
        
        if (priceContainer) {
          const { oldPrice, newPrice } = discountedProducts[productTitle];
          
          // إنشاء HTML للأسعار المخفضة
          priceContainer.innerHTML = `
            <div class="product-price-container">
              <span class="price-old" style="color: red; text-decoration: line-through; margin-left: 10px;">${oldPrice}</span>
              <span class="price-new">السعر: ${newPrice}</span>
            </div>
          `;
        }
      }
    });
  };

  /* ---------------------------
   * تحسين وظائف الفلترة
   ------------------------- */
  const enhanceFiltering = () => {
    const filterButtons = document.querySelectorAll('.btn-filter');
    const products = document.querySelectorAll('.product');
    const productsContainer = document.querySelector('.all-products');

    if (!filterButtons.length || !products.length) return;

    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.getAttribute('data-filter');
        
        // تحديث حالة الأزرار
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        let visibleCount = 0;

        // فلترة المنتجات
        products.forEach(product => {
          if (filter === '*' || product.classList.contains(filter.replace('.', ''))) {
            product.style.display = 'block';
            visibleCount++;
          } else {
            product.style.display = 'none';
          }
        });

        // إظهار رسالة عدم وجود منتجات
        let noProductsMessage = document.querySelector('.no-products-message');
        
        if (visibleCount === 0) {
          if (!noProductsMessage) {
            noProductsMessage = document.createElement('div');
            noProductsMessage.className = 'no-products-message';
            noProductsMessage.textContent = 'لا يوجد منتجات في هذا القسم';
            productsContainer.appendChild(noProductsMessage);
          }
          noProductsMessage.style.display = 'block';
        } else {
          if (noProductsMessage) {
            noProductsMessage.style.display = 'none';
          }
        }
      });
    });

    // تفعيل زر "الكل" افتراضياً
    const allButton = document.querySelector('.btn-filter[data-filter="*"]');
    if (allButton) {
      allButton.classList.add('active');
    }
  };

/* ---------------------------
   * Boot
   ------------------------- */

  document.addEventListener("DOMContentLoaded", () => {
    initIsotopeSafe();
    initSwiperSafe();
    updateBadges();
    syncFavIcons();
    renderFavOffcanvas();
    renderCartOffcanvas();
    renderCartPage();
    renderCheckoutPage();
    enforceUsdOnly();
    reorderHeaderButtons();
    ensureCheckoutAuth();
    
    // إضافة الوظائف الجديدة
    showDiscountedPrices();
    enhanceFiltering();
  });

})();


// Expose legacy inline handlers (some pages use onclick)
try { window.goToCheckout = () => { window.location.href = 'checkout.html'; }; } catch(e) {}





















