/* ======================================================
   Newsletter signup (footer)
====================================================== */

(function () {
  "use strict";

  const forms = Array.from(document.querySelectorAll(".newsletter-form"));
  if (!forms.length) return;

  const setMessage = (form, message, isError) => {
    const el = form.querySelector(".newsletter-message");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("text-danger", Boolean(isError));
    el.classList.toggle("text-success", !isError && Boolean(message));
  };

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const input = form.querySelector("input[name=\"email\"]");
      const button = form.querySelector("button[type=\"submit\"]");
      const email = String(input?.value || "").trim();

      setMessage(form, "", false);
      if (!email) {
        setMessage(form, "يرجى إدخال بريد إلكتروني صحيح.", true);
        return;
      }

      if (button) button.disabled = true;

      fetch("actions/subscribe.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email }).toString(),
      })
        .then((response) => response.json())
        .then((data) => {
          if (!data || !data.ok) {
            throw new Error(data?.error || "حدث خطأ أثناء الاشتراك.");
          }
          setMessage(form, data.message || "تم الاشتراك بنجاح.", false);
          if (input) input.value = "";
        })
        .catch((err) => {
          setMessage(form, err.message || "تعذر إتمام الطلب.", true);
        })
        .finally(() => {
          if (button) button.disabled = false;
        });
    });
  });
})();
