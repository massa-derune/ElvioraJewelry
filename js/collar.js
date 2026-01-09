document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.all-products');
  if (!grid) return;

  // Clear existing static content
  grid.innerHTML = '';

  // Create sub-containers
  const createSection = (id, title) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'col-12';
    const h = document.createElement('h3');
    h.id = id + '-heading';
    h.className = 'mt-2';
    h.textContent = title;
    const container = document.createElement('div');
    container.id = id;
    // Use same responsive columns as other listing pages (2 on xs, 3 on md, 6 on lg)
    container.className = 'row row-cols-2 row-cols-md-3 row-cols-lg-6 g-2 mb-3';
    wrapper.appendChild(h);
    wrapper.appendChild(container);
    return wrapper; 
  };

  const ears = createSection('Earrings-sub', 'حلق');
  const braces = createSection('Bracelets-sub', 'اساور');
  const necks = createSection('Necklace-sub', 'اطواق');

  grid.appendChild(ears);
  grid.appendChild(braces);
  grid.appendChild(necks);

  const containers = {
    earrings: document.getElementById('Earrings-sub'),
    bracelets: document.getElementById('Bracelets-sub'),
    necklace: document.getElementById('Necklace-sub')
  };

  const keywords = {
    earrings: ['حلق','earr','earring','ear'],
    bracelets: ['اسوارة','سوار','bracelet','اسواره','اسواره'],
    necklace: ['عقد','قلادة','necklace','طوق']
  };

  const matchesCategory = (name) => {
    const n = (name || '').toLowerCase();
    for (const k of keywords.earrings) if (n.includes(k)) return 'earrings';
    for (const k of keywords.bracelets) if (n.includes(k)) return 'bracelets';
    for (const k of keywords.necklace) if (n.includes(k)) return 'necklace';
    return null;
  };

  const renderCard = (p) => {
    const col = document.createElement('div');
    col.className = 'col product mb-3 Cgold';
    col.dataset.id = p.id;

    const img = p.main_image || (p.images && p.images[0]) || 'images/logo1.jpg';
    const title = p.name || '';
    const price = p.price_usd || '0.00';
    const desc = p.description || '';

    col.innerHTML = `
      <div class="card overflow-hidden">
        <div class="quick-icons">
          <a href="#quick-product" class="quick-view-btn" data-bs-toggle="modal"><i class="fa-solid fa-magnifying-glass"></i></a>
          <button type="button" class="favorite-btn btn p-0 border-0 bg-transparent"><i class="fa-regular fa-heart"></i></button>
        </div>
        <img src="${escapeHtml(img)}" alt="${escapeHtml(title)}" class="product-img">
        <div class="product-info">
          <h3 class="product-title">${escapeHtml(title)}</h3>
          <p class="product-description d-none">${escapeHtml(desc)}</p>
          <div class="stars mb-2"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i></div>
          <div class="price mb-2"><span class="product-price">السعر : ${escapeHtml(price)}$</span></div>
          <span class="product-category d-none">${escapeHtml(p.category_name || '')}</span>
          <button class="btn btn-danger w-100 add-to-cart" data-product-id="${p.id}" data-title="${escapeHtml(title)}" data-price="${escapeHtml(price)}" data-img="${escapeHtml(img)}"><i class="fa fa-cart-plus"></i> إضافة للسلة</button>
        </div>
      </div>
    `;
    return col;
  };

  function escapeHtml(s){
    if (s==null) return '';
    return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; });
  }

  // Loading indicator
  const loader = document.createElement('div');
  loader.className = 'text-center my-4';
  loader.textContent = 'تحميل...';
  grid.insertBefore(loader, grid.firstChild);

  fetch('actions/get_products.php?limit=200')
    .then(r => r.json())
    .then(json => {
      loader.remove();
      if (!json.ok) return;
      const items = json.items || [];
      // distribute
      items.forEach(p => {
        const cat = matchesCategory((p.name||'').toString());
        const card = renderCard(p);
        if (cat === 'earrings') containers.earrings.appendChild(card);
        else if (cat === 'bracelets') containers.bracelets.appendChild(card);
        else if (cat === 'necklace') containers.necklace.appendChild(card);
        else {
          // append to earrings by default if nothing matched
          containers.earrings.appendChild(card);
        }
      });

      // If a section is empty, show a message
      Object.entries(containers).forEach(([k,el])=>{
        if (!el.children.length) el.innerHTML = '<div class="col-12">لا توجد منتجات في هذا القسم حالياً.</div>';
      });
    })
    .catch(err => {
      loader.textContent = 'فشل تحميل المنتجات.';
      console.error(err);
    });
});
