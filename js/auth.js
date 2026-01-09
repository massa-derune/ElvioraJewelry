document.addEventListener("DOMContentLoaded", () => {
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const setHeaderState = (logged, displayName = "") => {
    const loginBtns = qsa("#loginBtn, .js-loginBtn, [data-role='loginBtn']");
    const logoutBtns = qsa("#logoutBtn, .js-logoutBtn, [data-role='logoutBtn']");
    const userBoxes = qsa("#userBox, .js-userBox, [data-role='userBox']");
    const userNames = qsa("#userName, .js-user-name, [data-role='userName'], [data-user-name], #headerUserName");
    const loginLabels = qsa(".js-login-label");

    if (logged) {
      loginBtns.forEach((b) => b.classList.add("d-none"));
      logoutBtns.forEach((b) => b.classList.remove("d-none"));
      userBoxes.forEach((b) => b.classList.remove("d-none"));
      userNames.forEach((n) => {
        n.textContent = displayName || "حسابي";
        n.classList.remove("d-none");
      });
      loginLabels.forEach((l) => (l.textContent = displayName || "حسابي"));
    } else {
      loginBtns.forEach((b) => b.classList.remove("d-none"));
      logoutBtns.forEach((b) => b.classList.add("d-none"));
      userBoxes.forEach((b) => b.classList.add("d-none"));
      userNames.forEach((n) => {
        n.textContent = "";
        n.classList.add("d-none");
      });
      loginLabels.forEach((l) => (l.textContent = "تسجيل الدخول"));
    }
  };

  const refreshSession = async () => {
    try {
      const res = await fetch("actions/check_session.php", { credentials: "include" });
      const data = await res.json();
      if (data && data.logged_in) {
        setHeaderState(true, data.name || "حسابي");
      } else {
        setHeaderState(false, "");
      }
    } catch (e) {
      setHeaderState(false, "");
    }
  };

  // Login form (offcanvas) handler
  const loginForm = qs("#loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = qs("#loginEmail")?.value || "";
      const password = qs("#loginPassword")?.value || "";

      const params = new URLSearchParams();
      params.append("action", "login");
      params.append("email", email);
      params.append("password", password);

      const err = qs("#loginError");
      if (err) err.classList.add("d-none");

      try {
        const res = await fetch("actions/auth.php", { method: "POST", body: params, credentials: "include" });
        const ct = res.headers.get("content-type") || "";
        let ok = false;
        if (ct.includes("application/json")) {
          const j = await res.json();
          ok = !!j.ok;
        } else {
          const txt = (await res.text()).trim();
          ok = txt === "LOGIN_SUCCESS";
        }

        if (ok) {
          await refreshSession();
          // Hide whichever offcanvas is used for login in the current page
          try {
            const el = qs("#login") || qs("#register");
            if (el && window.bootstrap) window.bootstrap.Offcanvas.getInstance(el)?.hide();
          } catch {}
          try {
            window.location.reload();
          } catch {}
        } else if (err) {
          err.classList.remove("d-none");
        }
      } catch (e2) {
        if (err) err.classList.remove("d-none");
      }
    });
  }

  // Register form handler
  const registerForm = qs("#registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      // Support multiple markup variants (register.html changed ids over time)
      const name =
        qs("#regName")?.value ||
        qs("#fullName")?.value ||
        qs("#name")?.value ||
        qs("[name='name']")?.value ||
        "";
      const email =
        qs("#regEmail")?.value ||
        qs("#email")?.value ||
        qs("[name='email']")?.value ||
        "";
      const password =
        qs("#regPassword")?.value ||
        qs("#password")?.value ||
        qs("[name='password']")?.value ||
        "";

      // Optional confirm password
      const confirm = qs("#confirmPassword")?.value || qs("#regConfirmPassword")?.value || "";
      if (confirm && password && confirm !== password) {
        const err = qs("#registerError");
        const msg = "كلمتا المرور غير متطابقتين";
        if (err) {
          err.textContent = msg;
          err.classList.remove("d-none");
        } else {
          alert(msg);
        }
        return;
      }

      const params = new URLSearchParams();
      params.append("action", "register");
      params.append("name", name);
      params.append("email", email);
      params.append("password", password);

      const err = qs("#registerError");
      if (err) err.classList.add("d-none");

      try {
        const res = await fetch("actions/auth.php", { method: "POST", body: params, credentials: "include" });
        const ct = res.headers.get("content-type") || "";
        let ok = false;
        if (ct.includes("application/json")) {
          const j = await res.json();
          ok = !!j.ok;
        } else {
          const txt = (await res.text()).trim();
          ok = txt === "REGISTER_SUCCESS";
        }

        if (ok) {
          try {
            (window.__elvioraNotify || window.showToast || console.log)("تم إنشاء الحساب بنجاح", "success");
          } catch {}
          // keep cart/fav as-is (localStorage) and go home
          window.location.href = "index.html";
        } else if (err) {
          err.classList.remove("d-none");
        }
      } catch (e2) {
        if (err) err.classList.remove("d-none");
      }
    });
  }

  // Logout handler (delegated so it works for dynamically injected button)
  document.addEventListener("click", async (e) => {
    const logoutBtn = e.target.closest?.("#logoutBtn, .js-logoutBtn, [data-role='logoutBtn']");
    if (!logoutBtn) return;
    e.preventDefault();
    const params = new URLSearchParams();
    params.append("action", "logout");
    try {
      await fetch("actions/auth.php", { method: "POST", body: params, credentials: "include" });
    } catch {}
    setHeaderState(false, "");
    try {
      window.location.reload();
    } catch {}
  });

  refreshSession();
});
