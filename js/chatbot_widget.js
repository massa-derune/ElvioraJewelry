/* Chatbot widget for Elviora. */
(function () {
  "use strict";

  const create = () => {
    if (document.getElementById("elvioraChatWidget")) return;

    const style = document.createElement("style");
    style.id = "elvioraChatStyle";
    style.textContent = `
      #elvioraChatWidget { position: fixed; bottom: 18px; left: 18px; z-index: 9999; direction: rtl; font-family: 'Cairo', sans-serif; }
      #elvioraChatBtn {
        display: flex; align-items: center; gap: 10px;
        background: linear-gradient(135deg, #112250, #3c507d);
        color: #f5f0e9; border: 1px solid rgba(224, 197, 143, 0.6); padding: 12px 16px;
        border-radius: 50px; box-shadow: 0 14px 30px rgba(17, 34, 80, 0.25);
        font-weight: 800; letter-spacing: 0.2px;
      }
      #elvioraChatBtn .sub { font-size: 12px; opacity: 0.85; }
      #elvioraChatBtn .dot { width: 10px; height: 10px; border-radius: 50%; background: #34c759; box-shadow: 0 0 0 6px rgba(52,199,89,0.25); }
      #elvioraChatPanel {
        width: min(360px, 90vw);
        background: linear-gradient(180deg, #f5f0e9, #d9cbc2);
        border: 1px solid rgba(224, 197, 143, 0.4);
        box-shadow: 0 22px 60px rgba(17, 34, 80, 0.2);
        border-radius: 16px;
        overflow: hidden;
        margin-top: 10px;
        display: none;
      }
      #elvioraChatPanel.open { display: block; }
      .chat-head { background: linear-gradient(135deg, #112250, #3c507d); padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .chat-id { display: flex; align-items: center; gap: 10px; }
      .chat-avatar { width: 36px; height: 36px; border-radius: 12px; background: #e0c58f; color: #112250; display: grid; place-items: center; font-weight: 800; box-shadow: 0 6px 16px rgba(224, 197, 143, 0.35); }
      .chat-title { font-weight: 800; margin: 0; font-size: 15px; color: #f5f0e9; }
      .chat-status { margin: 0; font-size: 12px; color: rgba(245, 240, 233, 0.85); }
      .chat-close { border: 1px solid rgba(224, 197, 143, 0.6); background: rgba(245, 240, 233, 0.1); width: 34px; height: 34px; border-radius: 10px; font-size: 18px; color: #f5f0e9; }
      .chat-body { max-height: 320px; overflow: auto; padding: 14px; background: #f5f0e9; display: flex; flex-direction: column; gap: 12px; }
      .chat-msg { display: flex; flex-direction: column; gap: 4px; }
      .chat-msg.user { align-items: flex-end; }
      .chat-msg.bot { align-items: flex-start; }
      .chat-msg .who { font-size: 12px; color: #888; margin: 0 4px; }
      .chat-msg .bubble { padding: 10px 12px; border-radius: 12px; max-width: 92%; line-height: 1.55; font-size: 14px; }
      .chat-msg.user .bubble { background: linear-gradient(135deg, #e0c58f, #d9cbc2); color: #112250; border-bottom-left-radius: 4px; }
      .chat-msg.bot .bubble { background: #fdf7ee; border: 1px solid rgba(60, 80, 125, 0.15); color: #1c1c1c; border-bottom-right-radius: 4px; box-shadow: 0 6px 16px rgba(17, 34, 80, 0.08); }
      .typing { display: inline-flex; gap: 4px; padding: 8px 10px; background: #fdf7ee; border: 1px solid rgba(60, 80, 125, 0.15); border-radius: 12px; }
      .typing span { width: 6px; height: 6px; border-radius: 50%; background: #3c507d; animation: bounce 1s infinite ease-in-out; }
      .typing span:nth-child(2) { animation-delay: 0.15s; }
      .typing span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-5px); opacity: 1; } }
      .chat-footer { border-top: 1px solid rgba(224, 197, 143, 0.35); padding: 12px; background: #fdf7ee; display: flex; flex-direction: column; gap: 8px; }
      .chat-hint { font-size: 12px; color: #777; display: flex; align-items: center; gap: 6px; }
      .chat-input-wrap { display: flex; gap: 8px; align-items: center; }
      .chat-input-wrap input { flex: 1; border-radius: 12px; border: 1px solid rgba(60, 80, 125, 0.2); padding: 10px 12px; outline: none; background: #fff; }
      .chat-input-wrap button { background: linear-gradient(135deg, #112250, #3c507d); color: #f5f0e9; border: 1px solid rgba(224, 197, 143, 0.6); padding: 10px 14px; border-radius: 12px; font-weight: 700; min-width: 90px; box-shadow: 0 10px 20px rgba(17, 34, 80, 0.25); }
      .chat-input-wrap button.loading { opacity: 0.75; cursor: wait; }
      @media (max-width: 520px) { #elvioraChatWidget { left: 12px; right: 12px; } #elvioraChatPanel { width: 100%; } }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement("div");
    wrap.id = "elvioraChatWidget";
    wrap.innerHTML = `
      <button id="elvioraChatBtn" aria-label="مساعد التسوق">
        <span class="dot"></span>
        <div>
          <div>مساعد التسوق</div>
          <div class="sub">اسأل عن أي شيء في Elviora</div>
        </div>
      </button>
      <div id="elvioraChatPanel">
        <div class="chat-head">
          <div class="chat-id">
            <div class="chat-avatar">E</div>
            <div>
              <p class="chat-title">مساعدة Elviora</p>
              <p class="chat-status">متصل الآن</p>
            </div>
          </div>
          <button class="chat-close" id="elvioraChatClose" aria-label="إغلاق">×</button>
        </div>
        <div class="chat-body" id="elvioraChatLog"></div>
        <div class="chat-footer">
          <div class="chat-hint">اكتب سؤالك وسأساعدك فورًا.</div>
          <div class="chat-input-wrap">
            <input id="elvioraChatInput" placeholder="اكتب سؤالك..." />
            <button id="elvioraChatSend">إرسال</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const btn = document.getElementById("elvioraChatBtn");
    const panel = document.getElementById("elvioraChatPanel");
    const close = document.getElementById("elvioraChatClose");
    const log = document.getElementById("elvioraChatLog");
    const input = document.getElementById("elvioraChatInput");
    const send = document.getElementById("elvioraChatSend");

    let sending = false;
    let typingEl = null;

    const normalizeText = (text) => {
      return (text || "")
        .toLowerCase()
        .replace(/[\u0623\u0625\u0622]/g, "\u0627")
        .replace(/\u0629/g, "\u0647")
        .replace(/\u0649/g, "\u064a")
        .replace(/[^\u0621-\u064a0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    const routeMap = [
      { keywords: ["عقد", "قلاده", "قلادة", "سلسال", "سلاسل"], url: "Collar_earr_brac.html", label: "قسم القلائد" },
      { keywords: ["حلق", "حلقان", "اقراط", "أقراط", "قرط"], url: "Collar_earr_brac.html", label: "قسم الأقراط" },
      { keywords: ["اسواره", "اسوره", "أساور", "اساور", "سوار"], url: "Collar_earr_brac.html", label: "قسم الأساور" },
      { keywords: ["خاتم", "خواتم", "دبله", "دبلة", "دبل"], url: "Rings.html", label: "قسم الخواتم" },
      { keywords: ["طقم", "اطقم", "أطقم", "تشكيله", "تشكيلة"], url: "set.html", label: "قسم الأطقم" },
      { keywords: ["منوع", "منوعات", "متنوع", "هدايا", "ساعة", "ساعات", "ساعه", "تعليقة", "تعليقه أحرف", "تعليقة احرف", "سبيكه", "سبيكة"], url: "diversified.html", label: "قسم المنوعات" }
    ];

    const findRoute = (text) => {
      const t = normalizeText(text);
      if (!t) return null;
      for (const route of routeMap) {
        if (route.keywords.some((k) => t.includes(normalizeText(k)))) {
          return route;
        }
      }
      return null;
    };

    const quickAnswer = (text) => {
      const t = normalizeText(text);
      if (!t) return "";
      if (
        t.includes("حدثني عن المتجر") ||
        t.includes("عن المتجر") ||
        t.includes("معلومات عن المتجر") ||
        t.includes("من انتم") ||
        t.includes("من أنتم") ||
        t.includes("ما هو المتجر") ||
        t.includes("ماهو المتجر") ||
        t.includes("تعريف بالمتجر") ||
        t.includes("نبذه عن المتجر") ||
        t.includes("نبذة عن المتجر") ||
        t.includes("ماذا يقدم") ||
        t.includes("ماذا تقدمون") ||
        t.includes("الخدمات الاضافيه") ||
        t.includes("الخدمات الاضافية") ||
        t.includes("خدماتكم")
      ) {
        return "نحن متجر مجوهرات في دمشق نقدّم قطعًا مختارة بعناية، مع خدمة استشارة لمساعدتك على اختيار التصميم المناسب، وتجربة كاميرا لبعض القطع، وتغليف أنيق وتسليم موثوق.";
      }
      if (
        t.includes("الكاميرا") ||
        t.includes("تجربه الكاميرا") ||
        t.includes("تجربة الكاميرا") ||
        t.includes("جربي بالكاميرا") ||
        t.includes("جرّبي بالكاميرا") ||
        t.includes("try on")
      ) {
        return "ميزة تجربة الكاميرا تسمح لكِ بمعاينة بعض القطع قبل الشراء. ستجدين زر \"جرّبي بالكاميرا\" في صفحة المنتج.";
      }
      if (
        t.includes("لماذا انتم") ||
        t.includes("لماذا متجرنا") ||
        t.includes("لماذا هذا المتجر") ||
        t.includes("لماذا نختاركم") ||
        t.includes("ما الذي يميزكم") ||
        t.includes("المميزات") ||
        t.includes("ميزاتكم")
      ) {
        return "نتميّز بتصاميم منتقاة بعناية، تجربة تصفّح سهلة، أسعار واضحة، دعم سريع، وإمكانية معاينة بعض القطع بالكاميرا.";
      }
      if (t.includes("على ذوقك") || t.includes("اقترح") || t.includes("اقتراح") || t.includes("اختيارك")) {
        return "أقترح لك تصميم كلاسيكي أنيق يناسب كل الإطلالات. تفضّلين ذهب أم فضة أم ألماس؟";
      }
      if (t.includes("شحن") || t.includes("توصيل") || t.includes("توصيلكم") || t.includes("التوصيل")) {
        return "التوصيل داخل المدينة عادة خلال 2-4 أيام عمل حسب المنطقة. هل ترغبين بمعرفة تكلفة الشحن؟";
      }
      if (t.includes("استبدال") || t.includes("ارجاع") || t.includes("إرجاع") || t.includes("سياسه") || t.includes("سياسة")) {
        return "يمكنك الاستبدال خلال 48 ساعة من الاستلام بشرط الحفاظ على الحالة الأصلية.";
      }
      if (t.includes("سعر") && (t.includes("دولار") || t.includes("ليرة"))) {
        return "سعر الصرف المستخدم حالياً يظهر في أعلى الصفحة ويمكن تعديله من لوحة الإدارة.";
      }
      return "";
    };

    const pickRandomProduct = () => {
      const cards = Array.from(document.querySelectorAll(".product[data-id]"));
      if (!cards.length) return null;
      const card = cards[Math.floor(Math.random() * cards.length)];
      const id = card.getAttribute("data-id") || "0";
      const title = (card.querySelector(".product-title")?.textContent || "").trim();
      const quickBtn = card.querySelector(".quick-view-btn");
      if (quickBtn) {
        quickBtn.click();
        return { id, title, opened: "modal" };
      }
      window.location.assign("product.html?id=" + encodeURIComponent(id));
      return { id, title, opened: "page" };
    };

    const tryOpenTasteProduct = (text) => {
      const t = normalizeText(text);
      if (!t) return false;
      const wantsPick =
        t.includes("افتح") ||
        t.includes("افتحي") ||
        t.includes("اختار") ||
        t.includes("اختاري") ||
        t.includes("اختار لي") ||
        t.includes("اختاري لي") ||
        t.includes("اقترح") ||
        t.includes("اقتراح") ||
        t.includes("على ذوقك") ||
        t.includes("ذوقك") ||
        t.includes("منتج") ||
        t.includes("شو بتنصح") ||
        t.includes("شو بتنصحني") ||
        t.includes("شو تقترح");
      if (!wantsPick) return false;
      const chosen = pickRandomProduct();
      if (chosen) {
        addMsg("Elviora", "اخترت لك منتجًا الآن، لحظة واحدة.", "bot");
        return true;
      }
      addMsg("Elviora", "لا يوجد منتجات ظاهرة الآن. افتحي صفحة المنتجات أولًا.", "bot");
      return true;
    };

    const maybeNavigate = (text, silent = false) => {
      const route = findRoute(text);
      if (!route) return false;
      if (!silent) addMsg("Elviora", `جهّزت لك الوصول إلى ${route.label}.`, "bot");
      setTimeout(() => { window.location.assign(route.url); }, 400);
      return true;
    };

    const wireHeaderSearch = () => {
      const searchInput = document.querySelector("header .top-header input.form-control[type=\"text\"]");
      if (!searchInput) return;

      const performSearch = () => {
        const query = (searchInput.value || "").trim();
        if (!query) return;
        const route = findRoute(query);
        if (route) {
          window.location.assign(route.url);
        }
      };

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          performSearch();
        }
      });
    };

    const scrollToBottom = () => {
      log.scrollTop = log.scrollHeight;
    };

    const addMsg = (who, text, type = "bot") => {
      const safe = (text || "").toString().trim();
      if (!safe) return;
      const row = document.createElement("div");
      row.className = `chat-msg ${type}`;
      const whoEl = document.createElement("div");
      whoEl.className = "who";
      whoEl.textContent = who;
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = safe;
      row.appendChild(whoEl);
      row.appendChild(bubble);
      log.appendChild(row);
      scrollToBottom();
    };

    const setTyping = (on) => {
      if (on) {
        typingEl = document.createElement("div");
        typingEl.className = "chat-msg bot";
        const bubble = document.createElement("div");
        bubble.className = "typing";
        bubble.innerHTML = "<span></span><span></span><span></span>";
        typingEl.appendChild(document.createElement("div")).className = "who";
        typingEl.lastChild.textContent = "Elviora";
        typingEl.appendChild(bubble);
        log.appendChild(typingEl);
      } else if (typingEl) {
        typingEl.remove();
        typingEl = null;
      }
      scrollToBottom();
    };

    const togglePanel = () => {
      const open = panel.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) input.focus();
    };

    const fallbackLocal = async (message) => {
      try {
        const res = await fetch("actions/chatbot.php", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message })
        });
        if (!res.ok) throw new Error("Fallback bad response");
        const data = await res.json().catch(() => ({}));
        return (data && data.reply) ? String(data.reply) : "";
      } catch (e) {
        console.error("Fallback chatbot failed", e);
        return "";
      }
    };

    const ask = async () => {
      const msg = (input.value || "").trim();
      if (!msg || sending) return;
      if (maybeNavigate(msg)) { input.value = ""; return; }
      if (tryOpenTasteProduct(msg)) { input.value = ""; return; }
      const qa = quickAnswer(msg);
      if (qa) {
        addMsg("أنت", msg, "user");
        addMsg("Elviora", qa, "bot");
        input.value = "";
        return;
      }
      sending = true;
      send.classList.add("loading");
      send.disabled = true;
      input.value = "";
      addMsg("أنت", msg, "user");
      setTyping(true);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch("actions/chatgpt.php", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${txt || "no body"}`);
        }
        const data = await res.json().catch(() => ({}));
        const reply = (data && data.reply ? String(data.reply).trim() : "") || "كيف أقدر أساعدك اليوم؟";
        setTyping(false);
        addMsg("Elviora", reply, "bot");
      } catch (err) {
        setTyping(false);
        console.error("Chat request failed", err);
        const local = await fallbackLocal(msg);
        if (local) {
          addMsg("Elviora", local, "bot");
        } else {
          addMsg("Elviora", "واجهت مشكلة مؤقتة. جرّبي مرة أخرى أو تواصلي معنا عبر الدعم.", "bot");
        }
      } finally {
        sending = false;
        send.classList.remove("loading");
        send.disabled = false;
        input.focus();
      }
    };

    btn.addEventListener("click", togglePanel);
    close.addEventListener("click", () => panel.classList.remove("open"));
    send.addEventListener("click", ask);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });

    wireHeaderSearch();

    addMsg("Elviora", "مرحبًا! أنا مساعد Elviora. اسأليني عن المنتجات، الأسعار، أو الأقسام.", "bot");
  };

  document.addEventListener("DOMContentLoaded", create);
})();
