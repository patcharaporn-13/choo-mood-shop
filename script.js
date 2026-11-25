/* CHOCO MOOD SHOP : สคริปต์กลาง ใช้ร่วมกันทุกหน้า
   แต่ละส่วนจะทำงานเมื่อหน้านั้นมี element ที่เกี่ยวข้อง */

const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbxQV8kOKXI1kbcfFAEc8m8AGTTBtJ1JYwmo85ppr0soygwBD12sizR3zk3mKul5cY86lw/exec';
const ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTQ80kuMKTDGgK5rdnQW2xtTvybUZtn-uoKIrPb1wnNNzhmUjPptggYIc0wlohT3p0_8vUV0C7ku2Iy/pub?gid=0&single=true&output=csv';

/* ปุ่มกรอง: moods คือค่าที่ถือว่าอยู่ในกลุ่มเดียวกัน */
const FILTERS = [
  { key: 'all', label: 'ทั้งหมด', moods: [] },
  { key: 'milk', label: 'Milk', moods: ['milk', 'sweet'] },
  { key: 'dark', label: 'Dark', moods: ['dark', 'confident'] },
  { key: 'set', label: 'Set', moods: ['set'] }
];

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/* ---------- product.html ---------- */
function getFilterKey(value) {
  const mood = String(value || '').trim().toLowerCase();
  const found = FILTERS.find(f => f.key === mood || f.moods.includes(mood));
  return found ? found.key : 'all';
}

function createProductCard(product) {
  const card = createElement('article', 'product-card');
  card.dataset.id = product.id;

  const image = createElement('img', 'product-image');
  image.src = product.image;
  image.alt = product.name;
  image.loading = 'lazy';

  const body = createElement('div', 'product-body');
  const footer = createElement('div', 'product-footer');

  const orderLink = createElement('a', 'btn', 'สั่งซื้อ');
  const params = new URLSearchParams({
    item: `${product.name} ${product.size}`,
    price: product.price
  });
  orderLink.href = `order.html?${params.toString()}`;

  footer.append(createElement('span', 'price', `${product.price} บาท`), orderLink);
  body.append(
    createElement('h3', '', product.name),
    createElement('p', 'product-size', product.size),
    footer
  );
  card.append(image, body);
  return card;
}

function initProductPage() {
  const list = document.getElementById('product-list');
  if (!list) return;

  const filterBar = document.getElementById('filter-bar');
  list.classList.add('product-grid');
  if (filterBar) filterBar.classList.add('options');

  let products = [];
  let activeKey = getFilterKey(new URLSearchParams(window.location.search).get('mood'));

  function render() {
    const filter = FILTERS.find(f => f.key === activeKey);
    const visible = activeKey === 'all'
      ? products
      : products.filter(p => filter.moods.includes(String(p.mood).toLowerCase()));

    if (visible.length) {
      list.replaceChildren(...visible.map(createProductCard));
    } else {
      list.replaceChildren(createElement('p', 'form-message', 'ยังไม่มีสินค้าในหมวดนี้'));
    }

    if (filterBar) {
      filterBar.querySelectorAll('button').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.mood === activeKey));
      });
    }
  }

  if (filterBar) {
    filterBar.replaceChildren(...FILTERS.map(filter => {
      const button = createElement('button', 'option', filter.label);
      button.type = 'button';
      button.dataset.mood = filter.key;
      button.addEventListener('click', () => {
        activeKey = filter.key;
        render();
      });
      return button;
    }));
  }

  fetch('products.json')
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(data => {
      products = data;
      render();
    })
    .catch(error => {
      console.error(error);
      list.replaceChildren(createElement('p', 'form-message', 'โหลดสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
    });
}

/* ---------- order.html ---------- */
function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  const field = id => document.getElementById(id);

  // เติมฟอร์มจาก URL ทันทีที่โหลดหน้า
  const params = new URLSearchParams(window.location.search);
  if (params.has('item')) field('items').value = params.get('item');
  if (params.has('price')) field('total').value = params.get('price');

  form.addEventListener('submit', event => {
    event.preventDefault();

    const payload = {
      customerName: field('customerName').value.trim(),
      contact: field('contact').value.trim(),
      items: field('items').value.trim(),
      total: field('total').value.trim(),
      note: field('note').value.trim()
    };

    fetch(ORDER_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ---------- admin.html ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter(r => r.some(value => value.trim() !== ''));
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  function showMessage(message) {
    const tr = document.createElement('tr');
    const td = createElement('td', '', message);
    td.colSpan = 6;
    tr.append(td);
    tbody.replaceChildren(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(ORDERS_CSV_URL, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    })
    .then(text => {
      const rows = parseCSV(text);
      // แถวแรกเป็นหัวตาราง ถ้าคอลัมน์ A ไม่มีตัวเลข (ไม่ใช่วันเวลา)
      if (rows.length && !/\d/.test(rows[0][0])) rows.shift();

      if (!rows.length) {
        showMessage('ยังไม่มีคำสั่งซื้อ');
        return;
      }

      // appendRow เพิ่มต่อท้ายเสมอ จึงกลับลำดับเพื่อให้ล่าสุดอยู่บน
      tbody.replaceChildren(...rows.reverse().map(row => {
        const tr = document.createElement('tr');
        for (let i = 0; i < 6; i++) {
          tr.append(createElement('td', '', row[i] || ''));
        }
        return tr;
      }));
    })
    .catch(error => {
      console.error(error);
      showMessage('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    });
}

document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
