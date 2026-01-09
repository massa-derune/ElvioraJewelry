(function(){
  'use strict';

  const apiGet = async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  };
  const apiPost = async (url, data) => {
    const body = new URLSearchParams();
    Object.entries(data||{}).forEach(([k,v])=>body.append(k,v));
    const res = await fetch(url, { method:'POST', body, credentials:'include' });
    const json = await res.json().catch(()=>null);
    if (!res.ok) throw (json||{});
    return json;
  };

  const readLocalCart = () => {
    try {
      const raw = localStorage.getItem('elviora_cart') || '[]';
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  };

  const writeLocalCart = (arr) => {
    try { localStorage.setItem('elviora_cart', JSON.stringify(arr||[])); } catch {}
  };

  const render = (items, total) => {
    const host = document.getElementById('cartItemsHost') || document.querySelector('.cart-items') || document.querySelector('#cartItems');
    const totalEl = document.getElementById('cartPageTotal') || document.getElementById('finalTotal') || document.querySelector('[data-cart-total]');
    if (!host) return;

    host.innerHTML = '';
    if (!items || !items.length) {
      host.innerHTML = '<div class="text-center text-muted py-4">السلة فارغة</div>';
      if (totalEl) totalEl.textContent = '$0';
      return;
    }

    items.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'd-flex align-items-center gap-3 border rounded p-2 mb-2';
      row.innerHTML = `
        <img src="${it.img || ''}" style="width:70px;height:70px;object-fit:cover;border-radius:10px" onerror="this.style.display='none'">
        <div class="flex-grow-1">
          <div class="fw-bold">${it.name}</div>
          <div class="text-muted small">$${Number(it.price_usd||0).toFixed(2)}</div>
        </div>
        <input type="number" min="1" value="${it.qty}" style="width:80px" class="form-control form-control-sm" data-qty="${it.uid || it.product_id}">
        <button class="btn btn-sm btn-outline-danger" data-remove="${it.uid || it.product_id}">حذف</button>
      `;
      host.appendChild(row);
    });

    if (totalEl) totalEl.textContent = '$' + Number(total||0).toFixed(2);
  };

  document.addEventListener('DOMContentLoaded', async () => {
    let session = { logged_in:false };
    try { session = await apiGet('actions/check_session.php'); } catch {}

    const load = async () => {
      // إن كان مسجل دخول: اعرض سلة السيرفر
      if (session.logged_in) {
        const cart = await apiGet('actions/cart.php?action=get');
        render(cart.items||[], cart.total_usd||0);
        return;
      }
      // ضيف: اعرض سلة localStorage
      const items = readLocalCart();
      const total = items.reduce((s,it)=>s + (Number(it.price_usd ?? it.priceUsd ?? 0) * Number(it.qty||1)), 0);
      render(items.map(it=>({
        product_id: it.product_id ?? it.id,
        uid: it.uid || `${it.product_id ?? it.id}::${it.variant_id||''}`,
        name: it.title ?? it.name,
        img: it.img,
        qty: it.qty,
        price_usd: it.price_usd ?? it.priceUsd
      })), total);
    };

    await load();

    document.addEventListener('change', async (e) => {
      const inp = e.target.closest('[data-qty]');
      if (!inp) return;
      const pid = inp.getAttribute('data-qty');
      const qty = Math.max(1, parseInt(inp.value||'1',10));
      if (session.logged_in) {
        try {
          let product_id = pid;
          let variant_id = null;
          if (String(pid).includes('::')) {
            const parts = String(pid).split('::');
            product_id = parts[0] || null;
            variant_id = parts[1] || null;
          }
          await apiPost('actions/cart.php', { action:'update', product_id: product_id, variant_id: variant_id, qty });
          await load();
        } catch {}
      } else {
        const items = readLocalCart();
        const idx = items.findIndex(x=>String(x.uid || `${x.product_id}::${x.variant_id||''}`)===String(pid));
        if (idx>=0) items[idx].qty = qty;
        writeLocalCart(items);
        await load();
      }
    });

    document.addEventListener('click', async (e) => {
      const rm = e.target.closest('[data-remove]');
      if (!rm) return;
      const pid = rm.getAttribute('data-remove');
      if (session.logged_in) {
        try {
          let product_id = pid;
          let variant_id = null;
          if (String(pid).includes('::')) {
            const parts = String(pid).split('::');
            product_id = parts[0] || null;
            variant_id = parts[1] || null;
          }
          await apiPost('actions/cart.php', { action:'remove', product_id: product_id, variant_id: variant_id });
          await load();
        } catch {}
      } else {
        const items = readLocalCart().filter(x=>String(x.uid || `${x.product_id}::${x.variant_id||''}`)!==String(pid));
        writeLocalCart(items);
        await load();
      }
    });

    const goCheckout = document.getElementById('goCheckoutBtn') || document.getElementById('checkoutNowBtn');
    if (goCheckout) goCheckout.addEventListener('click', async () => {
      // لا نسمح بإتمام الطلب بدون تسجيل دخول
      if (!session.logged_in) {
        alert('يرجى تسجيل الدخول لإكمال الشراء');
        window.location.href = 'index.html#login';
        return;
      }
      window.location.href = 'checkout.html';
    });
  });
})();