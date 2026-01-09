/* ======================================================
   Dynamic products (category pages)
   - Keeps existing layout, replaces card content from DB
====================================================== */

(function () {
  "use strict";

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const formatUsd = (value) => {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toLocaleString("en-US") : "0";
  };

  const getPriceLabel = (el) => {
    const text = String(el?.textContent || "").trim();
    if (!text) return "Price";
    const parts = text.split(/[:؟]/);
    return parts[0] ? parts[0].trim() : "Price";
  };

  const updateCard = (card, product) => {
    const titleEl = qs(".product-title", card);
    if (titleEl) titleEl.textContent = product.name || "";

    const descEl = qs(".product-description", card);
    if (descEl) descEl.textContent = product.description || "";

    const priceEl = qs(".product-price", card);
    if (priceEl) {
      const label = getPriceLabel(priceEl);
      priceEl.textContent = `${label}: ${formatUsd(product.price_usd)}$`;
    }

    const catEl = qs(".product-category", card);
    if (catEl) catEl.textContent = product.category_name || "";

    const imgEl = qs(".product-img", card);
    const fallbackImg = imgEl?.getAttribute("src") || "images/default-product.jpg";
    const img = product.main_image || fallbackImg;
    if (imgEl) imgEl.setAttribute("src", img);

    const addBtn = qs(".add-to-cart", card);
    if (addBtn) {
      addBtn.dataset.title = product.name || "";
      addBtn.dataset.price = String(product.price_usd ?? "");
      addBtn.dataset.img = img;
    }
  };

  const loadProducts = () => {
    const cards = qsa(".product[data-id]");
    if (!cards.length) return;

    fetch("actions/get_products.php?limit=500")
      .then((response) => response.json())
      .then((data) => {
        if (!data || !data.ok || !Array.isArray(data.products)) return;

        const byId = new Map();
        data.products.forEach((p) => {
          const id = String(p.id ?? "");
          if (id) byId.set(id, p);
        });

        cards.forEach((card) => {
          const id = String(card.getAttribute("data-id") || "").trim();
          if (!id) return;
          const product = byId.get(id);
          if (!product) return;
          updateCard(card, product);
        });
      })
      .catch(() => {
        // Keep static content if API fails.
      });
  };

  document.addEventListener("DOMContentLoaded", loadProducts);
})();
