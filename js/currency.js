document.addEventListener("DOMContentLoaded", () => {
  const offcanvasEl = document.getElementById("currency");
  const usdRateEl = document.getElementById("usdRate");
  const usdAmountEl = document.getElementById("usdAmount");
  const sypAmountEl = document.getElementById("sypAmount");
  const resultEl = document.getElementById("result");
  const btnUsdToSyp = document.getElementById("btnUsdToSyp");
  const btnSypToUsd = document.getElementById("btnSypToUsd");
  const btnClear = document.getElementById("btnClear");

  if (!offcanvasEl) return;

  let rate = 0;

  const setRate = (value) => {
    rate = value;
    try { window.__elvioraUsdSypRate = rate; } catch(e) {}
    if (usdRateEl) {
      usdRateEl.value = rate ? rate.toLocaleString("en-US") : "";
    }
  };

  const showResult = (text, type = "info") => {
    if (!resultEl) return;
    resultEl.classList.remove("d-none", "alert-info", "alert-warning", "alert-danger", "alert-success");
    resultEl.classList.add(`alert-${type}`);
    resultEl.textContent = text;
  };

  const hideResult = () => {
    if (!resultEl) return;
    resultEl.classList.add("d-none");
  };

  const fetchRateWithFallback = async () => {
    hideResult();
    setRate(0);
    if (usdRateEl) {
      usdRateEl.readOnly = true;
      usdRateEl.placeholder = "";
    }

    try {
      const res = await fetch("actions/updaterate.php", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok && Number(data.rate) > 0) {
        setRate(Number(data.rate));
        return;
      }
      // If the endpoint returned ok:false, treat it as a failure and continue to fallback.
      throw new Error(data?.error || "updaterate failed");
    } catch (_) {
      // fallback below
    }

    try {
      const res = await fetch("actions/get_rate.php", { cache: "no-store" });
      const data = await res.json();
      const fallback = Number(data?.rate || 0);
      if (fallback > 0) {
        setRate(fallback);
        showResult("تم استخدام السعر المخزن كحل احتياطي.", "warning");
      } else {
        showResult("تعذر جلب سعر الدولار حالياً.", "danger");
      }
    } catch (_) {
      // Likely running on Live Server (no PHP) OR the DB endpoint isn't available.
      // Allow manual entry.
      if (usdRateEl) {
        usdRateEl.readOnly = false;
        usdRateEl.placeholder = "أدخل سعر الدولار يدوياً (مثال: 11850)";
      }
      showResult("تعذر جلب السعر تلقائياً. أدخل سعر الدولار يدوياً ثم اضغط زر التحويل.", "warning");
    }
  };

  const toNumber = (value) => Number(String(value || "").replace(/,/g, "")) || 0;

  const ensureRateFromInput = () => {
    if (rate) return rate;
    const manual = toNumber(usdRateEl?.value);
    if (manual > 0) {
      setRate(manual);
      return manual;
    }
    return 0;
  };

  const convertUsdToSyp = () => {
    if (!ensureRateFromInput()) {
      showResult("الرجاء إدخال/جلب سعر الدولار أولاً.", "warning");
      return;
    }
    const usd = toNumber(usdAmountEl?.value);
    const syp = Math.round(usd * rate);
    if (sypAmountEl) sypAmountEl.value = syp ? String(syp) : "";
    showResult(`${usd} USD = ${syp.toLocaleString("en-US")} SYP`, "success");
  };

  const convertSypToUsd = () => {
    if (!ensureRateFromInput()) {
      showResult("الرجاء إدخال/جلب سعر الدولار أولاً.", "warning");
      return;
    }
    const syp = toNumber(sypAmountEl?.value);
    const usd = syp ? (syp / rate).toFixed(2) : "";
    if (usdAmountEl) usdAmountEl.value = usd;
    showResult(`${syp.toLocaleString("en-US")} SYP = ${usd} USD`, "success");
  };

  const clearAll = () => {
    if (usdAmountEl) usdAmountEl.value = "";
    if (sypAmountEl) sypAmountEl.value = "";
    hideResult();
  };

  const updateProductPricesFromDb = () => {
    // IMPORTANT: The store prices should stay in USD only.
    // We only provide conversion via the currency offcanvas.
    // This function normalizes any mixed price displays back to USD.
    document.querySelectorAll(".product").forEach((card) => {
      const priceEl = card.querySelector(".product-price");
      if (!priceEl) return;

      let usd = Number(priceEl.dataset.usd || 0);
      if (!usd) {
        const btn = card.querySelector(".add-to-cart");
        const raw = btn?.dataset?.price || "";
        usd = Number(String(raw).replace(/,/g, "")) || 0;
        if (usd) priceEl.dataset.usd = String(usd);
      }
      if (!usd) return;

      // Force USD only display
      priceEl.textContent = `السعر: $${usd.toLocaleString("en-US")}`;
    });
  };


  offcanvasEl.addEventListener("shown.bs.offcanvas", fetchRateWithFallback);
  btnUsdToSyp?.addEventListener("click", convertUsdToSyp);
  btnSypToUsd?.addEventListener("click", convertSypToUsd);
  btnClear?.addEventListener("click", clearAll);

  updateProductPricesFromDb();
});
