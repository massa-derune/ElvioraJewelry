const fs = require('fs');
const path = require('path');

const root = 'C:/xampp/htdocs/Elviora3';
const files = [
  'index.html',
  'Collar_earr_brac.html',
  'Rings.html',
  'set.html',
  'diversified.html'
];

const products = new Map();
const esc = (s) => String(s || '').replace(/'/g, "''");

for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const re = /data-id="(\d+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    const start = m.index;
    const chunk = html.slice(start, start + 8000);

    const imgMatch = chunk.match(/class="product-img"[^>]*src="([^"]+)"/i);
    const titleMatch = chunk.match(/class="product-title"[^>]*>([^<]+)</i);
    const descMatch = chunk.match(/class="product-description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const priceMatch = chunk.match(/class="product-price"[^>]*>([^<]+)</i);

    const img = imgMatch ? imgMatch[1] : '';
    const title = titleMatch ? titleMatch[1] : '';
    const descRaw = descMatch ? descMatch[1] : '';
    const priceRaw = priceMatch ? priceMatch[1] : '';

    const priceParts = priceRaw.match(/[0-9]+(?:[.,][0-9]+)*/g);
    const price = priceParts ? Number(priceParts.join('').replace(/,/g, '')) : 0;

    const desc = descRaw.replace(/\s+/g, ' ').trim();
    const name = title.replace(/\s+/g, ' ').trim();

    const existing = products.get(id) || {};
    products.set(id, {
      id,
      name: name || existing.name || '',
      desc: desc || existing.desc || '',
      img: img || existing.img || '',
      price: price || existing.price || 0
    });
  }
}

const ids = Array.from(products.keys()).map(Number).sort((a, b) => a - b);
const lines = ['START TRANSACTION;'];

for (const id of ids) {
  const p = products.get(String(id));
  const name = esc(p.name || `منتج ${id}`);
  const desc = esc(p.desc || '');
  const price = Number(p.price) || 0;

  lines.push(
    `INSERT INTO products (id,name,description,price_usd,is_active) VALUES (${id},'${name}','${desc}',${price},1) ` +
    `ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), price_usd=VALUES(price_usd), is_active=1;`
  );

  if (p.img) {
    lines.push(`DELETE FROM product_images WHERE product_id=${id};`);
    lines.push(
      `INSERT INTO product_images (product_id,image_path,sort_order) VALUES (${id},'${esc(p.img)}',1);`
    );
  }
}

lines.push('COMMIT;');
const outPath = path.join(root, 'database', 'sync_products_from_html.sql');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('wrote', ids.length, 'products to', outPath);
