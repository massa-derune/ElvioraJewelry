(function(){
  'use strict';

  const apiGet = async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  };
  const apiPost = async (url, obj) => {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj || {})
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  };

  const ensureLogin = async () => {
    const s = await apiGet('actions/check_session.php');
    if (!s.logged_in) {
      alert('يرجى تسجيل الدخول لإكمال الشراء');
      // أعد المستخدم إلى تسجيل الدخول (يمكنك تغييره لصفحة register.html إن رغبتِ)
      window.location.href = 'index.html#login';
      return false;
    }
    return true;
  };

  const readLocalCart = () => {
    try {
      const raw = localStorage.getItem('elviora_cart');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  };

  const renderProducts = (items) => {
    const host = document.getElementById('checkoutProducts');
    const totalEl = document.getElementById('finalTotal');
    if (!host) return;
    host.innerHTML = '';
    let total = 0;
    if (!items || !items.length) {
      host.innerHTML = '<div class="text-center text-muted py-3">السلة فارغة</div>';
      if (totalEl) totalEl.textContent = '$0';
      return;
    }
    items.forEach((it) => {
      const line = document.createElement('div');
      const name = it.name || it.title || it.product_name || '';
      const price = Number(it.price_usd ?? it.priceUsd ?? 0);
      const qty = Number(it.qty || 1);
      total += price * qty;
      line.className = 'd-flex justify-content-between border-bottom py-2';
      line.innerHTML = `<div>${name} <span class="text-muted">× ${qty}</span></div><div>$${(price*qty).toFixed(2)}</div>`;
      host.appendChild(line);
    });
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (!(await ensureLogin())) return;

    try {
      const cart = await apiGet('actions/cart.php?action=get');
      const serverItems = (cart.items || []);
      // إذا كانت قاعدة البيانات فارغة (لأي سبب) اعتمدي السلة المحلية
      const localItems = readLocalCart();
      renderProducts(serverItems.length ? serverItems : localItems);
    } catch {}

    const form = document.getElementById('checkoutForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!(await ensureLogin())) return;

        const payload = {
          full_name: document.getElementById('fullName')?.value || '',
          email: document.getElementById('email')?.value || '',
          phone: document.getElementById('phone')?.value || '',
          governorate: document.getElementById('citySelect')?.value || '',
          address: document.getElementById('address')?.value || '',
          notes: document.getElementById('notes')?.value || '',
          payment_method: (document.querySelector("input[name='paymentMethod']:checked")?.value || 'cash'),
          currency_rate: (window.__elvioraUsdSypRate || null),
          // السلة من localStorage (مهم عند عدم مزامنتها في cart_items)
          cart_items: readLocalCart()
        };

        try {
          const r = await apiPost('actions/place_order.php', payload);
          alert('تم تأكيد الطلب ✅ رقم الطلب: ' + r.order_id);
          window.location.href = 'index.html';
        } catch (err) {
          if (err && err.error === 'CART_EMPTY') alert('السلة فارغة');
          else if (err && err.error === 'LOGIN_REQUIRED') { alert('يرجى تسجيل الدخول'); window.location.href='register.html'; }
          else alert('تعذر إتمام الطلب. تأكدي من تعبئة المعلومات.');
        }
      });
    }
  });
})();