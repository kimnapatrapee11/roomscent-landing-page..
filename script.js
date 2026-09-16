/* =========================================================
   HYVO - script.js
   ใช้ร่วมกันทุกหน้า: product.html, order.html, admin.html
   ========================================================= */

/* ---------- ตั้งค่า URL ปลายทาง (แก้ตรงนี้ที่เดียว) ---------- */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyjbED9aywpnd8xhWvoRMUVYei_weV-r9yx5pAVZ7BmRVYE5IPtsciQBRpKnlfCuQ3-/exec';
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8Sr6r28anbgt4mqZc79BW4A0fdzQiEuFhXFg9cMcIcqeiYoxj1DLSBrIwucJCr1HLHzBUjOt1nD_-/pub?gid=0&single=true&output=csv';

/* ============================================================
   1) PRODUCT PAGE (product.html)
   ต้องมี element: #filter-bar, #product-list
   ============================================================ */

let allProducts = [];
let currentFilter = 'all';

function initProductPage() {
  const productList = document.getElementById('product-list');
  const filterBar = document.getElementById('filter-bar');

  if (!productList || !filterBar) return; // ไม่ใช่หน้านี้ ข้ามไป

  fetch('products.json')
    .then((res) => res.json())
    .then((products) => {
      allProducts = products;

      // อ่าน URL parameter ?mood=xxx เพื่อกรองอัตโนมัติตอนโหลดหน้า
      const params = new URLSearchParams(window.location.search);
      const mood = params.get('mood');
      if (mood) {
        currentFilter = mood;
      }

      renderFilterBar(filterBar);
      renderProductList(productList, currentFilter);
    })
    .catch((error) => {
      console.error(error);
      productList.innerHTML = '<p>ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
    });
}

function renderFilterBar(filterBar) {
  const filters = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'เก็บความร้อน', label: 'เก็บความร้อน' },
    { key: 'ไม่เก็บความร้อน', label: 'ไม่เก็บความร้อน' },
  ];

  filterBar.innerHTML = filters
    .map(
      (f) =>
        `<button class="filter-btn${f.key === currentFilter ? ' active' : ''}" data-type="${f.key}">${f.label}</button>`
    )
    .join('');

  filterBar.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.getAttribute('data-type');
      filterBar.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderProductList(document.getElementById('product-list'), currentFilter);
    });
  });
}

function renderProductList(productList, filterType) {
  const items =
    filterType === 'all'
      ? allProducts
      : allProducts.filter((p) => p.type === filterType);

  if (items.length === 0) {
    productList.innerHTML = '<p>ไม่พบสินค้าในหมวดนี้</p>';
    return;
  }

  productList.innerHTML = items.map((product) => buildProductCard(product)).join('');
}

function buildProductCard(product) {
  const orderUrl =
    'order.html?item=' +
    encodeURIComponent(product.name + ' ' + product.size) +
    '&price=' +
    encodeURIComponent(product.price);

  return `
    <div class="card product-card">
      <img src="${product.image}" alt="${product.name}">
      <h3 class="card-title">${product.name}</h3>
      <p>${product.size}</p>
      <p class="card-price">${product.price} บาท</p>
      <a class="btn btn-primary" href="${orderUrl}">สั่งซื้อ</a>
    </div>
  `;
}

/* ============================================================
   2) ORDER PAGE (order.html)
   ต้องมี element: #orderForm, #customerName, #contact,
                   #items, #total, #note
   ============================================================ */

function initOrderPage() {
  const orderForm = document.getElementById('orderForm');
  if (!orderForm) return; // ไม่ใช่หน้านี้ ข้ามไป

  const itemsField = document.getElementById('items');
  const totalField = document.getElementById('total');

  // อ่านค่า item และ price จาก URL parameter แล้วเติมลงในฟอร์มทันทีที่โหลดหน้า
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');

  if (itemsField && item) {
    itemsField.value = item;
  }
  if (totalField && price) {
    totalField.value = price;
  }

  orderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOrderSubmit();
  });
}

function handleOrderSubmit() {
  const customerName = document.getElementById('customerName');
  const contact = document.getElementById('contact');
  const items = document.getElementById('items');
  const total = document.getElementById('total');
  const note = document.getElementById('note');

  const payload = {
    customerName: customerName ? customerName.value : '',
    contact: contact ? contact.value : '',
    items: items ? items.value : '',
    total: total ? total.value : '',
    note: note ? note.value : '',
  };

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
    .then(() => {
      window.location.href = 'thankyou.html';
    })
    .catch((error) => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
}

/* ============================================================
   3) ADMIN PAGE (admin.html)
   ต้องมี element: #ordersTable tbody
   ============================================================ */

function initAdminPage() {
  const tableBody = document.querySelector('#ordersTable tbody');
  if (!tableBody) return; // ไม่ใช่หน้านี้ ข้ามไป

  fetch(CSV_URL)
    .then((res) => res.text())
    .then((csvText) => {
      const rows = parseCSV(csvText);
      if (rows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">ยังไม่มีข้อมูลคำสั่งซื้อ</td></tr>';
        return;
      }

      // แถวแรกเป็น header ตัดออก แล้วเรียงล่าสุดขึ้นก่อน
      const dataRows = rows.slice(1).reverse();

      tableBody.innerHTML = dataRows
        .map((row) => {
          const [timestamp, customerName, contact, items, total, note] = row;
          return `
            <tr>
              <td>${escapeHtml(timestamp)}</td>
              <td>${escapeHtml(customerName)}</td>
              <td>${escapeHtml(contact)}</td>
              <td>${escapeHtml(items)}</td>
              <td>${escapeHtml(total)}</td>
              <td>${escapeHtml(note)}</td>
            </tr>
          `;
        })
        .join('');
    })
    .catch((error) => {
      console.error(error);
      tableBody.innerHTML = '<tr><td colspan="6">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</td></tr>';
    });
}

/**
 * ฟังก์ชัน parse CSV แบบเขียนเอง (ไม่ใช้ library ภายนอก)
 * รองรับ: ค่าที่ครอบด้วย double quote, comma ภายใน quote,
 * quote ที่ escape ด้วย "" และการขึ้นบรรทัดใหม่แบบ \r\n หรือ \n
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // ทำให้การขึ้นบรรทัดเป็นรูปแบบเดียวกัน
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i++; // ข้าม quote ตัวที่สอง
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }

  // เพิ่มฟิลด์/แถวสุดท้าย ถ้ายังมีข้อมูลค้างอยู่
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // ตัดแถวว่างทิ้ง
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   INIT: เรียกใช้ฟังก์ชันตามหน้าที่โหลดอยู่จริง
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
