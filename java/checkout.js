(function () {
  const CART_KEY = 'x2_cart';

  function getCurrSym() {
    const code = localStorage.getItem('currency') || 'AED';
    const map = { AED: 'د.إ', USD: '$', EUR: '€', SAR: 'ر.س', EGP: 'ج.م', KWD: 'د.ك', JOD: 'د.أ', GBP: '£' };
    return map[code] || code;
  }

  function fmt(n) { return (parseFloat(n) || 0).toFixed(2) + ' ' + getCurrSym(); }

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
  }

  async function reserveShortOrderNumber() {
    let latestSerial = 999;
    try {
      if (window.Supabase && window.Supabase.Orders) {
        const orders = await window.Supabase.Orders.getAll(500);
        latestSerial = (Array.isArray(orders) ? orders : []).reduce((max, order) => {
          const raw = String(order.order_number || order.orderNumber || order.id || '').replace(/\D/g, '');
          const number = Number(raw);
          return Number.isSafeInteger(number) && number >= 1000 && number <= 999999999 && number > max ? number : max;
        }, latestSerial);
      }
    } catch (e) {}
    const local = Number(localStorage.getItem('x2_order_counter') || 999);
    const next = Math.max(latestSerial, Number.isSafeInteger(local) && local <= 999999999 ? local : 999) + 1;
    localStorage.setItem('x2_order_counter', String(next));
    return '#' + next;
  }

  function esc(value) {
    return String(value || '').replace(/[&<>"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char];
    });
  }

  let cartItems = loadCart();
  let totalPrice = 0;
  let totalOld = 0;

  function renderItems() {
    const container = document.getElementById('co-items');
    if (!container) return;
    totalPrice = 0;
    totalOld = 0;
    if (!cartItems.length) {
      container.innerHTML = '<p style="color:#aaa;font-size:0.85rem;text-align:center;padding:20px 0">السلة فارغة</p>';
      return;
    }
    let html = '';
    cartItems.forEach(item => {
      const price = parseFloat(item.priceCurrent) || 0;
      const old = parseFloat(item.priceOld) || 0;
      const qty = parseInt(item.qty, 10) || 1;
      const title = item.title || 'منتج';
      totalPrice += price * qty;
      if (old > price) totalOld += old * qty;
      html += `
        <div class="co-item">
          <img src="${esc(item.img || '')}" alt="${esc(title)}" data-checkout-img>
          <div class="co-item-details">
            <div class="co-item-name">${esc(title)}</div>
            <div>
              ${old > price ? `<span class="co-item-old">${fmt(old)}</span>` : ''}
              <span class="co-item-price">${fmt(price)}</span>
            </div>
            <div class="co-item-qty">الكمية: <b>${qty}</b></div>
          </div>
        </div>`;
    });
    container.innerHTML = html;
    updateTotals();
  }

  function updateTotals() {
    const sym = getCurrSym();
    const subtotal = document.getElementById('co-subtotal');
    const discountEl = document.getElementById('co-discount');
    const badgeEl = document.getElementById('co-discount-badge');
    const totalEl = document.getElementById('co-total');
    if (subtotal) subtotal.textContent = fmt(totalOld || totalPrice);
    const discount = totalOld > totalPrice ? (totalOld - totalPrice) : 0;
    if (discountEl && badgeEl) {
      if (discount > 0) {
        discountEl.textContent = '- ' + fmt(discount);
        const pct = Math.round(discount / totalOld * 100);
        badgeEl.textContent = pct + '% خصم';
      } else {
        discountEl.textContent = '0 ' + sym;
        badgeEl.style.display = 'none';
      }
    }
    if (totalEl) totalEl.textContent = fmt(totalPrice);
    updateInstallments(totalPrice);
  }

  function updateInstallments(total) {
    const sym = getCurrSym();
    const q4 = (total / 4).toFixed(2);
    const q3 = (total / 3).toFixed(2);
    ['t1', 't2', 't3', 't4'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = q4 + ' ' + sym;
    });
    ['tm1', 'tm2', 'tm3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = q3 + ' ' + sym;
    });
  }

  async function notifyAdminNewOrder(order) {
    try {
      const ANON_PUSH = 'sb_publishable_VPSO9nbXg5eVNMj03KpgdA_VSOuMDHw';
      const totalText = (Number(order.total) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' AED';
      const firstItem = order.items && order.items[0] || {};
      const productName = firstItem.name || firstItem.title || firstItem.productName || 'Product';
      const itemCount = Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + (Number(item.qty || item.quantity || 1) || 1), 0) : 0;
      const customerName = order.customerName || '';
      const customerPhone = order.customerPhone || (order.shipping && order.shipping.phone) || '';
      const city = order.shipping && order.shipping.city || order.address && order.address.city || '';
      const displayOrderId = '#' + String(order.id || '').replace(/^#+/, '');
      const adminBody = [
        `طلب جديد ${displayOrderId}`,
        `العميل: ${customerName || 'غير متوفر'} | المنتج: ${productName || 'منتج'} | السعر: ${totalText}`,
        customerPhone || city ? `الهاتف: ${customerPhone || 'غير متوفر'}${city ? ' | المدينة: ' + city : ''}` : '',
        'اضغط لفتح الطلب'
      ].filter(Boolean).join('\n');
      const payload = {
        title: 'admin_new_order',
        body: adminBody,
        customerName,
        customerPhone,
        productName,
        itemCount,
        totalText,
        city,
        payment: order.payment || '',
        url: '/admin-reports?order=' + encodeURIComponent(order.id),
        type: 'admin_new_order',
        orderId: order.id,
        order_id: order.id,
        iconText: '📦',
        emoji: '📦',
        user_email: '__bariq_admin_orders__@bariq.local'
      };
      const endpoint = 'https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/hyper-api';
      const send = fetch(endpoint, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: ANON_PUSH, Authorization: 'Bearer ' + ANON_PUSH },
        body: JSON.stringify(payload)
      }).catch(() => {});
      await Promise.race([send, new Promise(resolve => setTimeout(resolve, 1800))]);
    } catch (e) {}
  }

  window.toggleInstall = function (type) {
    const tabby = document.getElementById('tabby-detail');
    const tamara = document.getElementById('tamara-detail');
    const selected = document.getElementById(type + '-detail');
    if (tabby) tabby.classList.remove('show');
    if (tamara) tamara.classList.remove('show');
    if (selected) selected.classList.add('show');
  };

  window.placeOrder = async function () {
    const fname = document.getElementById('co-first-name').value.trim();
    const lname = document.getElementById('co-last-name').value.trim();
    const email = document.getElementById('co-email').value.trim();
    const country = document.getElementById('co-country').value;
    const phone = document.getElementById('co-phone').value.trim();
    const city = document.getElementById('co-city').value.trim();
    const address = document.getElementById('co-address').value.trim();
    const checkedPayment = document.querySelector('input[name="payment"]:checked');
    const payment = checkedPayment ? checkedPayment.value : '';

    if (!fname) { alert('من فضلك أدخل اسمك'); return; }
    if (!phone) { alert('من فضلك أدخل رقم هاتفك'); return; }
    if (!city) { alert('من فضلك أدخل المدينة'); return; }
    if (!address) { alert('من فضلك أدخل العنوان'); return; }

    const orderId = await reserveShortOrderNumber();
    const order = {
      id: orderId,
      date: new Date().toISOString(),
      cashback: 5,
      cashbackStatus: 'pending',
      cashbackAvailableAt: '',
      cashbackExpiresAt: '',
      items: cartItems,
      total: totalPrice,
      shipping: { name: (fname + ' ' + lname).trim(), phone, email, country, city, address },
      customerName: (fname + ' ' + lname).trim(),
      customerPhone: phone,
      customerEmail: email,
      address: { country, city, street: address, building: '' },
      status: 'processing',
      payment
    };

    try {
      const orders = JSON.parse(localStorage.getItem('x2_orders') || '[]');
      orders.unshift(order);
      localStorage.setItem('x2_orders', JSON.stringify(orders));
      const profile = JSON.parse(localStorage.getItem('x2_profile') || '{}');
      if (!profile.name) profile.name = order.customerName;
      if (!profile.phone) profile.phone = phone;
      if (!profile.email && email) profile.email = email;
      if (!profile.address) profile.address = address;
      if (!profile.address_full) profile.address_full = { country, city, area: '', street: address, building: '', zip: '', notes: '' };
      localStorage.setItem('x2_profile', JSON.stringify(profile));
      localStorage.removeItem(CART_KEY);
    } catch (e) {}

    try {
      if (window.Supabase && window.Supabase.Orders) {
        window.Supabase.Orders.insert(order).catch(err => console.warn('Supabase order save failed:', err));
      }
    } catch (e) {}

    await notifyAdminNewOrder(order);

    const itemsText = cartItems.map(it => `- ${it.name || it.title || 'Product'} x${Number(it.qty || 1)}`).join('\n');
    const firstProduct = cartItems[0] || {};
    const primaryProductUrl = firstProduct.id ? 'https://bariqgifts.com/product/' + encodeURIComponent(firstProduct.id) : '';
    const msg = encodeURIComponent([
      primaryProductUrl,
      primaryProductUrl ? '' : null,
      'مرحباً، أريد تأكيد الطلب',
      '',
      'رقم الطلب: ' + order.id,
      '',
      'بيانات العميل:',
      'الاسم: ' + order.customerName,
      'الهاتف: ' + phone,
      'البريد: ' + (email || 'غير متوفر'),
      'العنوان: ' + address,
      '',
      'محتويات السلة:',
      itemsText,
      '',
      'المدينة: ' + city,
      'الإجمالي: ' + fmt(totalPrice)
    ].filter(line => line !== null).join('\n'));
    alert('✅ تم تأكيد طلبك!\nرقم الطلب: ' + order.id);
    window.open('https://wa.me/971544046084?text=' + msg, '_blank', 'noopener');
    window.location.href = 'account.html';
  };

  document.addEventListener('click', function (event) {
    const changeAddress = event.target.closest('[data-checkout-change-address]');
    if (changeAddress) {
      const saved = document.getElementById('co-address-saved');
      const form = document.getElementById('co-address-form');
      if (saved) saved.style.display = 'none';
      if (form) form.style.display = 'grid';
      return;
    }
    if (event.target.closest('[data-place-order]')) {
      window.placeOrder();
      return;
    }
    if (event.target.closest('[data-back-cart]')) {
      window.location.href = '/Cart';
    }
  });

  document.addEventListener('change', function (event) {
    const input = event.target.closest('[data-installment]');
    if (input && input.checked) window.toggleInstall(input.dataset.installment);
  });

  document.addEventListener('error', function (event) {
    const img = event.target;
    if (img && img.matches && img.matches('[data-checkout-img]')) img.src = '/assets/logo.png';
  }, true);

  renderItems();
})();
