/* ======================================================
   Product details loader (product.html)
   - Fetches product data by id and fills the page
   - Updates carousel, price, category, and cart buttons
====================================================== */

(function () {
  "use strict";

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const setText = (sel, text) => {
    const el = qs(sel);
    if (el) el.textContent = text;
  };

  const formatUsd = (value) => {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toLocaleString("en-US") : "0";
  };

  const buildImageList = (product) => {
    if (Array.isArray(product.images) && product.images.length) {
      return product.images
        .map((img) => String(img.image_path || "").trim())
        .filter((path) => path);
    }
    if (product.main_image) return [String(product.main_image)];
    return ["images/default-product.jpg"];
  };

  const updateCarousel = (images) => {
    const indicators = qs("#carouselProduct .carousel-indicators");
    const inner = qs("#carouselProduct .carousel-inner");
    if (!indicators || !inner) return;

    indicators.innerHTML = "";
    inner.innerHTML = "";

    images.forEach((src, idx) => {
      const isActive = idx === 0;

      const indicator = document.createElement("img");
      indicator.className = "img-slider" + (isActive ? " active" : "");
      indicator.setAttribute("data-bs-target", "#carouselProduct");
      indicator.setAttribute("data-bs-slide-to", String(idx));
      indicator.src = src;
      indicator.alt = "product image";
      indicators.appendChild(indicator);

      const item = document.createElement("div");
      item.className = "carousel-item" + (isActive ? " active" : "");
      item.innerHTML = `<img src="${src}" class="d-block w-100" alt="product image">`;
      inner.appendChild(item);
    });
  };

  const updateCartButtons = (product, image) => {
    const addBtn = qs(".add-btn .add-to-cart");
    const buyBtn = qs(".add-btn .buy-now");
    const title = product.name || "";
    const price = String(product.price_usd ?? "");
    const id = String(product.id ?? "");

    if (addBtn) {
      addBtn.dataset.id = id;
      addBtn.dataset.title = title;
      addBtn.dataset.price = price;
      addBtn.dataset.img = image;
    }
    if (buyBtn) {
      buyBtn.dataset.id = id;
      buyBtn.dataset.title = title;
      buyBtn.dataset.price = price;
      buyBtn.dataset.img = image;
    }
  };

  const setPriceText = (value) => {
    const el = qs("#productPrice");
    if (!el) return;
    const label = String(el.textContent || "Price").split(":")[0];
    el.textContent = `${label}: $${formatUsd(value)}`;
  };

  const showError = (message) => {
    setText("#productTitle", "Product not found");
    setText("#productDescription", message || "Unable to load product data.");
    setPriceText(0);
  };

  const fillProduct = (product) => {
    const images = buildImageList(product);
    const mainImage = images[0] || "images/default-product.jpg";

    setText("#productTitle", product.name || "");
    setText("#productDescription", product.description || "");
    setPriceText(product.price_usd);
    setText("#productCategory", product.category_name || "");

    updateCarousel(images);
    updateCartButtons(product, mainImage);

    document.body.dataset.productId = String(product.id || "");
  };

  const fetchProduct = (productId) => {
    const url = `actions/get_product_verified.php?id=${encodeURIComponent(productId)}`;
    fetch(url)
      .then((response) => response.text().then((text) => ({ response, text })))
      .then(({ response, text }) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        let data;
        try {
          data = JSON.parse(text);
        } catch (err) {
          throw new Error("Invalid response from server.");
        }
        if (!data.ok || !data.product) {
          throw new Error(data.error || "Product not found.");
        }
        fillProduct(data.product);
      })
      .catch((err) => {
        showError(err.message);
      });
  };

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const productId = String(params.get("id") || "").trim();

    if (!productId) {
      showError("Missing product id.");
      return;
    }

    fetchProduct(productId);
  });
})();
