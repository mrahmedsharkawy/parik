(function () {
  "use strict";

  const state = {
    orders: [],
    manualOrders: [],
    invoices: [],
    editingId: null,
    editingInvoice: null,
  };

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowTime() {
    return new Date().toTimeString().slice(0, 5);
  }

  const MoneyUtils = {
    toCents(value) { return Math.round((Number(value) || 0) * 100); },
    fromCents(cents) { return Math.round(cents) / 100; },
    add(a, b) { return MoneyUtils.fromCents(MoneyUtils.toCents(a) + MoneyUtils.toCents(b)); },
    sub(a, b) { return MoneyUtils.fromCents(MoneyUtils.toCents(a) - MoneyUtils.toCents(b)); },
    mul(a, b) { return MoneyUtils.fromCents(Math.round(MoneyUtils.toCents(a) * b)); },
    sum(values) { return MoneyUtils.fromCents(values.reduce((acc, v) => acc + MoneyUtils.toCents(v), 0)); },
    fmt(value) { return "AED " + (Number(value) || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    safe(value) { return Math.max(0, MoneyUtils.fromCents(MoneyUtils.toCents(value))); },
  };

  async function erpFetch(path, opts) {
    if (!window.sbFetch) throw new Error("Supabase client is not ready");
    return window.sbFetch(path, Object.assign({ requireAuth: true }, opts || {}));
  }

  const InvoiceRepository = {
    async select(query = "") {
      return erpFetch(query ? `erp_invoices?${query}` : "erp_invoices");
    },
    async insert(payload) {
      return erpFetch("erp_invoices", { method: "POST", body: JSON.stringify(payload), prefer: "return=representation" });
    },
    async update(id, payload) {
      return erpFetch(`erp_invoices?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload), prefer: "return=representation" });
    },
  };

  async function loadOrders() {
    try {
      const [orders, manualOrders] = await Promise.all([
        erpFetch("orders?select=id,order_number,created_at,customer_name,customer_phone,customer_email,total,status,items,shipping_cost&order=created_at.desc&limit=500"),
        erpFetch("erp_manual_orders?select=id,order_number,created_at,customer_name,customer_phone,customer_email,customer_address,total,deposit,status,notes&order=created_at.desc&limit=500"),
      ]);
      state.orders = Array.isArray(orders) ? orders : [];
      state.manualOrders = Array.isArray(manualOrders) ? manualOrders : [];
    } catch (e) {
      console.warn("[Invoices] load orders failed:", e.message);
      toast("فشل تحميل الطلبات: " + e.message);
    }
  }

  async function loadInvoices() {
    try {
      const rows = await InvoiceRepository.select("order=created_at.desc&limit=500");
      state.invoices = Array.isArray(rows) ? rows : [];
    } catch (e) {
      console.warn("[Invoices] load invoices failed:", e.message);
      state.invoices = [];
    }
  }

  async function loadAll() {
    setSync("جاري التحميل");
    await Promise.all([loadOrders(), loadInvoices()]);
    setSync("متصل");
    updateLastSync();
  }

  function setSync(text) {
    const el = $("erpSyncState");
    if (el) el.textContent = text;
  }

  function updateLastSync() {
    const el = $("erpLastSync");
    if (el) el.textContent = "آخر تحديث: " + new Date().toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" });
  }

  function hydrateUser() {
    try {
      const saved = JSON.parse(localStorage.getItem("bariq_admin_auth_v1") || "{}");
      if ($("erpUserName")) $("erpUserName").textContent = sessionStorage.getItem("admin_name") || saved.name || "Bariq Admin";
    } catch (_) {}
  }

  function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const existing = state.invoices
      .map((inv) => inv.invoice_number)
      .filter((n) => n && n.startsWith(prefix))
      .map((n) => Number(n.split("-").pop()) || 0);
    const max = existing.length ? Math.max(...existing) : 0;
    return prefix + String(max + 1).padStart(6, "0");
  }

  function setMobileMenuOpen(open) {
    document.body.classList.toggle("erp-nav-open", open);
    const btn = $("erpMenuBtn");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function ensureSidebarOverlay() {
    if (document.getElementById("erpSidebarOverlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "erpSidebarOverlay";
    overlay.className = "erp-sidebar-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.addEventListener("click", () => setMobileMenuOpen(false));
    document.body.appendChild(overlay);
  }

  function bindNavEvents() {
    ensureSidebarOverlay();
    $("erpMenuBtn")?.addEventListener("click", () => {
      setMobileMenuOpen(!document.body.classList.contains("erp-nav-open"));
    });
    document.addEventListener("click", (event) => {
      if (!document.body.classList.contains("erp-nav-open")) return;
      if (event.target.closest(".erp-sidebar") && !event.target.closest("#erpMenuBtn")) {
        if (event.target.closest("a.erp-nav-item")) setMobileMenuOpen(false);
        return;
      }
      if (!event.target.closest("#erpMenuBtn")) setMobileMenuOpen(false);
    });
  }

  function toast(message) {
    let el = document.querySelector(".erp-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "erp-toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  // ===== Item management =====

  function renderItems() {
    const container = $("invoiceItems");
    if (!container) return;
    const rows = container.querySelectorAll(".erp-invoice-item");
    const items = [];
    rows.forEach((row, index) => {
      items.push({
        index,
        description: row.querySelector('[name="item_description"]')?.value || "",
        qty: Number(row.querySelector('[name="item_qty"]')?.value || 1),
        unit_price: Number(row.querySelector('[name="item_unit_price"]')?.value || 0),
        discount: Number(row.querySelector('[name="item_discount"]')?.value || 0),
      });
    });
    container.innerHTML = items.map((item, i) => `
      <div class="erp-invoice-item" data-index="${i}">
        <input name="item_description" placeholder="وصف البند" value="${esc(item.description)}">
        <input name="item_qty" type="number" min="1" step="1" value="${item.qty || 1}" placeholder="الكمية">
        <input name="item_unit_price" type="number" min="0" step="0.01" value="${item.unit_price || 0}" placeholder="سعر الوحدة">
        <input name="item_discount" type="number" min="0" step="0.01" value="${item.discount || 0}" placeholder="خصم البند">
        <button type="button" class="erp-danger-mini" data-remove-item="${i}">×</button>
      </div>
    `).join("");
    bindItemEvents();
    recalc();
  }

  function bindItemEvents() {
    $("invoiceItems")?.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", recalc);
    });
    $("invoiceItems")?.querySelectorAll("[data-remove-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.closest(".erp-invoice-item").remove();
        renderItems();
      });
    });
  }

  function addItem(defaultItem) {
    const container = $("invoiceItems");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "erp-invoice-item";
    div.innerHTML = `
      <input name="item_description" placeholder="وصف البند" value="${esc(defaultItem?.description || "")}">
      <input name="item_qty" type="number" min="1" step="1" value="${defaultItem?.qty || 1}" placeholder="الكمية">
      <input name="item_unit_price" type="number" min="0" step="0.01" value="${defaultItem?.unit_price || 0}" placeholder="سعر الوحدة">
      <input name="item_discount" type="number" min="0" step="0.01" value="${defaultItem?.discount || 0}" placeholder="خصم البند">
      <button type="button" class="erp-danger-mini" data-remove-item>×</button>
    `;
    container.appendChild(div);
    bindItemEvents();
    recalc();
  }

  function getItems() {
    const rows = document.querySelectorAll(".erp-invoice-item");
    return Array.from(rows).map((row) => {
      const qty = Math.max(1, Number(row.querySelector('[name="item_qty"]')?.value || 1));
      const unitPrice = Number(row.querySelector('[name="item_unit_price"]')?.value || 0);
      const discount = Number(row.querySelector('[name="item_discount"]')?.value || 0);
      const lineTotal = MoneyUtils.mul(qty, unitPrice);
      const lineAfterDiscount = MoneyUtils.sub(lineTotal, discount);
      return {
        description: row.querySelector('[name="item_description"]')?.value || "",
        qty,
        unit_price: unitPrice,
        discount,
        total: MoneyUtils.safe(lineAfterDiscount),
      };
    });
  }

  function getFormData() {
    const form = $("invoiceForm");
    const data = new FormData(form);
    const items = getItems();
    const subtotal = MoneyUtils.sum(items.map((i) => i.total));
    const discountPercent = Math.min(100, Math.max(0, Number(data.get("discount_percent") || 0)));
    const percentDiscount = MoneyUtils.mul(subtotal, discountPercent / 100);
    const fixedDiscount = MoneyUtils.safe(Number(data.get("discount_fixed") || 0));
    const discountAmount = MoneyUtils.add(percentDiscount, fixedDiscount);
    const taxableAmount = MoneyUtils.safe(MoneyUtils.sub(subtotal, discountAmount));
    const vatRate = Number(data.get("vat_rate") || 0);
    const vatAmount = MoneyUtils.mul(taxableAmount, vatRate / 100);
    const shipping = MoneyUtils.safe(Number(data.get("shipping") || 0));
    const total = MoneyUtils.add(MoneyUtils.add(taxableAmount, vatAmount), shipping);
    const deposit = MoneyUtils.safe(Number(data.get("deposit") || 0));
    const paid = MoneyUtils.safe(Number(data.get("paid") || 0));
    const remaining = MoneyUtils.safe(MoneyUtils.sub(total, paid));

    let paymentStatus = "unpaid";
    if (paid >= total) paymentStatus = "paid";
    else if (paid > 0) paymentStatus = "partial";

    return {
      invoice_number: data.get("invoice_number") || generateInvoiceNumber(),
      order_id: data.get("order_id") || null,
      order_number: $("importOrderNumber")?.value?.replace(/^#/, "") || null,
      invoice_type: data.get("invoice_type") || "normal",
      invoice_date: data.get("invoice_date") || todayIso(),
      invoice_time: nowTime(),
      customer: {
        name: data.get("customer_name") || "",
        phone: data.get("customer_phone") || "",
        email: data.get("customer_email") || "",
        address: data.get("customer_address") || "",
        city: data.get("customer_city") || "",
        vat_number: data.get("customer_vat") || "",
        company: data.get("customer_company") || "",
      },
      items,
      subtotal,
      discount_percent: discountPercent,
      discount_fixed: fixedDiscount,
      discount_amount: discountAmount,
      taxable_amount: taxableAmount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      shipping,
      total,
      deposit,
      paid,
      remaining,
      payment_status: paymentStatus,
      payment_method: data.get("payment_method") || "cash",
      amount_in_words: numberToArabicWords(total),
      notes: data.get("notes") || null,
      terms: data.get("terms") || null,
    };
  }

  function recalc() {
    const data = getFormData();
    renderPreview(data);
    return data;
  }

  function renderPreview(data) {
    const target = $("invoicePreview");
    if (!target) return;

    const company = {
      name: "بريق للهدايا والإبداع",
      enName: "BARIQ GIFTS & CREATIVITY",
      phone: "+971544046084",
      email: "sales@bariqgifts.com",
      address: "راس الخيمه - الإمارات العربية المتحدة",
      website: "www.bariqgifts.com",
      logo: "/assets/blak.png",
    };

    const itemsRows = data.items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(item.description)}</td>
        <td>${item.qty}</td>
        <td>${MoneyUtils.fmt(item.unit_price)}</td>
        <td>${item.discount > 0 ? MoneyUtils.fmt(item.discount) : "-"}</td>
        <td>${MoneyUtils.fmt(item.total)}</td>
      </tr>
    `).join("");

    const qrId = "invoice-qr-" + Date.now();

    const html = `
      <div class="erp-invoice-paper" id="invoicePaper">
        <div class="erp-invoice-paper-head">
          <div class="erp-invoice-logo"><img src="${esc(company.logo)}" alt="Bariq"></div>
          <div class="erp-invoice-company">
            <b>${esc(company.name)}</b>
            <span>${esc(company.enName)}</span>
          </div>
          <div class="erp-invoice-qr" id="${qrId}"></div>
        </div>
        <div class="erp-invoice-title">
          <h2>فاتورة / INVOICE</h2>
        </div>
        <div class="erp-invoice-meta">
          <div><span>رقم الفاتورة</span><b>${esc(data.invoice_number)}</b></div>
          <div><span>رقم الطلب</span><b>${esc(data.order_number || "-")}</b></div>
          <div><span>التاريخ</span><b>${esc(data.invoice_date)}</b></div>
          <div><span>الوقت</span><b>${esc(data.invoice_time)}</b></div>
        </div>
        <div class="erp-invoice-parties">
          <div class="erp-invoice-party">
            <b>إلى / العميل</b>
            <div>${esc(data.customer.name || "-")}</div>
            <div>${esc(data.customer.phone || "")}</div>
            <div>${esc(data.customer.email || "")}</div>
            <div>${esc(data.customer.address || "")} ${esc(data.customer.city || "")}</div>
            ${data.customer.vat_number ? `<div>الرقم الضريبي: ${esc(data.customer.vat_number)}</div>` : ""}
          </div>
          <div class="erp-invoice-party">
            <b>من / الشركة</b>
            <div>${esc(company.name)}</div>
            <div>${esc(company.phone)}</div>
            <div>${esc(company.email)}</div>
            <div>${esc(company.address)}</div>
          </div>
        </div>
        <table class="erp-invoice-table">
          <thead>
            <tr>
              <th>م</th>
              <th>التفاصيل / Description</th>
              <th>الكمية Qty</th>
              <th>سعر الوحدة Unit Price</th>
              <th>الخصم Discount</th>
              <th>المبلغ Amount</th>
            </tr>
          </thead>
          <tbody>${itemsRows || '<tr><td colspan="6">لا توجد بنود</td></tr>'}</tbody>
        </table>
        <div class="erp-invoice-totals">
          <div><span>الإجمالي الفرعي</span><b>${MoneyUtils.fmt(data.subtotal)}</b></div>
          ${data.discount_amount > 0 ? `<div><span>الخصم</span><b>- ${MoneyUtils.fmt(data.discount_amount)}</b></div>` : ""}
          ${data.vat_amount > 0 ? `<div><span>ضريبة القيمة المضافة (${data.vat_rate}%)</span><b>${MoneyUtils.fmt(data.vat_amount)}</b></div>` : ""}
          ${data.shipping > 0 ? `<div><span>الشحن</span><b>${MoneyUtils.fmt(data.shipping)}</b></div>` : ""}
          <div class="erp-invoice-grand"><span>الإجمالي النهائي</span><b>${MoneyUtils.fmt(data.total)}</b></div>
          ${data.deposit > 0 ? `<div><span>العربون</span><b>${MoneyUtils.fmt(data.deposit)}</b></div>` : ""}
          <div><span>المدفوع</span><b>${MoneyUtils.fmt(data.paid)}</b></div>
          <div><span>المتبقي</span><b>${MoneyUtils.fmt(data.remaining)}</b></div>
        </div>
        <div class="erp-invoice-words">
          <b>إجمالي المبلغ بالحروف:</b> ${esc(data.amount_in_words || "")}
        </div>
        ${data.notes ? `<div class="erp-invoice-notes"><b>ملاحظات:</b> ${esc(data.notes)}</div>` : ""}
        ${data.terms ? `<div class="erp-invoice-notes"><b>الشروط:</b> ${esc(data.terms)}</div>` : ""}
        <div class="erp-invoice-signatures">
          <div><span>توقيع المستلم</span><div class="erp-sign-line"></div></div>
          <div><span>توقيع المحاسب</span><div class="erp-sign-line"></div></div>
        </div>
        <div class="erp-invoice-footer">
          <div>🌐 ${esc(company.website)}</div>
          <div>✉ ${esc(company.email)}</div>
          <div>📞 ${esc(company.phone)}</div>
        </div>
      </div>
    `;

    target.innerHTML = html;
    renderQr(qrId, data.invoice_number, data.total);
  }

  function renderQr(elementId, invoiceNumber, total) {
    if (typeof QRCode === "undefined") return;
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = "";
    try {
      new QRCode(container, {
        text: `${invoiceNumber}|${Number(total).toFixed(2)}|${todayIso()}`,
        width: 90,
        height: 90,
        colorDark: "#152546",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (e) {
      console.warn("QR generation failed:", e);
    }
  }

  // ===== Order import =====

  function findOrderByNumber(number) {
    const clean = String(number).replace(/^#/, "").trim().toLowerCase();
    if (!clean) return null;
    const fromOrders = state.orders.find((o) => String(o.order_number || "").toLowerCase() === clean || String(o.id).toLowerCase() === clean);
    if (fromOrders) return { source: "orders", order: fromOrders };
    const fromManual = state.manualOrders.find((o) => String(o.order_number || "").toLowerCase() === clean || String(o.id).toLowerCase() === clean);
    if (fromManual) return { source: "erp_manual_orders", order: fromManual };
    return null;
  }

  function checkDuplicate(orderId) {
    return state.invoices.find((inv) => inv.order_id === orderId && !inv.cancelled) || null;
  }

  async function importOrder() {
    const input = $("importOrderNumber");
    const number = input?.value?.trim();
    if (!number) return toast("اكتب رقم الطلب");

    await loadOrders();
    const found = findOrderByNumber(number);
    if (!found) return toast("❌ لم يتم العثور على الطلب");

    const order = found.order;
    const duplicate = checkDuplicate(order.id);
    const warning = $("duplicateWarning");
    if (duplicate) {
      warning.hidden = false;
      warning.innerHTML = `⚠️ يوجد بالفعل فاتورة مرتبطة بهذا الطلب: <b>${esc(duplicate.invoice_number)}</b> بتاريخ ${esc(duplicate.created_at?.slice(0, 10) || "-")}. <button type="button" class="erp-link" id="viewDuplicateInvoice">عرض الفاتورة</button>`;
      $("viewDuplicateInvoice")?.addEventListener("click", () => loadInvoiceIntoForm(duplicate.id));
    } else {
      warning.hidden = true;
      warning.innerHTML = "";
    }

    $("invOrderId").value = order.id;
    setFormValue("customer_name", order.customer_name);
    setFormValue("customer_phone", order.customer_phone);
    setFormValue("customer_email", order.customer_email);
    setFormValue("customer_address", order.customer_address);

    $("invoiceItems").innerHTML = "";
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length) {
      items.forEach((item) => addItem({
        description: item.title || item.name || item.description || "منتج",
        qty: Number(item.qty || item.quantity || 1),
        unit_price: Number(item.price || item.unit_price || 0),
        discount: Number(item.discount || 0),
      }));
    } else {
      addItem({ description: "تفاصيل الطلب", qty: 1, unit_price: Number(order.total || 0), discount: 0 });
    }

    setFormValue("deposit", order.deposit || 0);
    setFormValue("paid", order.deposit || 0);
    recalc();
    toast("✅ تم استيراد الطلب");
  }

  function setFormValue(name, value) {
    const input = document.querySelector(`#invoiceForm [name="${name}"]`);
    if (input) input.value = value == null ? "" : value;
  }

  // ===== Save / Load =====

  async function saveInvoice() {
    const data = recalc();
    if (!data.customer.name) return toast("اكتب اسم العميل");
    if (!data.items.length || data.items.every((i) => !i.description)) return toast("أضف بند واحد على الأقل");

    let payload = { ...data };
    let isNew = true;

    if (state.editingId && state.editingInvoice) {
      isNew = false;
      payload = { ...payload, updated_at: new Date().toISOString() };
      delete payload.invoice_number;
    } else {
      if (data.order_id && checkDuplicate(data.order_id)) {
        return toast("⚠️ يوجد فاتورة غير ملغاة لهذا الطلب. استخدم عرض الفاتورة الحالية.");
      }
    }

    try {
      const rows = isNew
        ? await InvoiceRepository.insert(payload)
        : await InvoiceRepository.update(state.editingId, payload);
      const saved = Array.isArray(rows) ? rows[0] : rows;
      toast(isNew ? "✅ تم حفظ الفاتورة" : "✅ تم تحديث الفاتورة");
      await loadInvoices();
      if (saved?.id) loadInvoiceIntoForm(saved.id);
      renderInvoiceList();
    } catch (e) {
      console.error("[Invoices] save failed:", e);
      toast("❌ فشل الحفظ: " + e.message);
    }
  }

  function loadInvoiceIntoForm(id) {
    const inv = state.invoices.find((i) => String(i.id) === String(id));
    if (!inv) return toast("الفاتورة غير موجودة");
    state.editingId = inv.id;
    state.editingInvoice = inv;

    $("invOrderId").value = inv.order_id || "";
    $("importOrderNumber").value = inv.order_number || "";
    setFormValue("invoice_number", inv.invoice_number);
    setFormValue("invoice_type", inv.invoice_type || "normal");
    setFormValue("invoice_date", inv.invoice_date || todayIso());
    setFormValue("customer_name", inv.customer?.name || "");
    setFormValue("customer_phone", inv.customer?.phone || "");
    setFormValue("customer_email", inv.customer?.email || "");
    setFormValue("customer_address", inv.customer?.address || "");
    setFormValue("customer_city", inv.customer?.city || "");
    setFormValue("customer_vat", inv.customer?.vat_number || "");
    setFormValue("customer_company", inv.customer?.company || "");

    $("invoiceItems").innerHTML = "";
    (inv.items || []).forEach((item) => addItem(item));

    setFormValue("discount_percent", inv.discount_percent || 0);
    setFormValue("discount_fixed", inv.discount_fixed || 0);
    setFormValue("vat_rate", inv.vat_rate || 0);
    setFormValue("shipping", inv.shipping || 0);
    setFormValue("deposit", inv.deposit || 0);
    setFormValue("paid", inv.paid || 0);
    setFormValue("payment_method", inv.payment_method || "cash");
    setFormValue("notes", inv.notes || "");
    setFormValue("terms", inv.terms || "");

    $("btnCancelInvoice").hidden = inv.cancelled;
    $("duplicateWarning").hidden = true;
    recalc();
    showEditor();
  }

  async function cancelInvoice() {
    if (!state.editingId || !state.editingInvoice) return;
    const reason = prompt("سبب إلغاء الفاتورة؟") || "إلغاء يدوي";
    try {
      await InvoiceRepository.update(state.editingId, {
        cancelled: true,
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
      });
      toast("✅ تم إلغاء الفاتورة");
      await loadInvoices();
      newInvoice();
      renderInvoiceList();
    } catch (e) {
      toast("❌ فشل الإلغاء: " + e.message);
    }
  }

  function newInvoice() {
    state.editingId = null;
    state.editingInvoice = null;
    $("invoiceForm").reset();
    $("invOrderId").value = "";
    $("importOrderNumber").value = "";
    $("duplicateWarning").hidden = true;
    $("btnCancelInvoice").hidden = true;
    setFormValue("invoice_date", todayIso());
    $("invoiceItems").innerHTML = "";
    addItem();
    recalc();
    showEditor();
  }

  // ===== List =====

  function renderInvoiceList() {
    const tbody = $("invoiceListRows");
    if (!tbody) return;
    const q = ($("invoiceListSearch")?.value || "").trim().toLowerCase();
    const filter = $("invoiceListFilter")?.value || "";

    let rows = state.invoices.slice();
    if (filter === "cancelled") rows = rows.filter((i) => i.cancelled);
    else if (filter) rows = rows.filter((i) => !i.cancelled && i.payment_status === filter);

    if (q) {
      rows = rows.filter((i) =>
        [i.invoice_number, i.order_number, i.customer?.name, i.customer?.phone].some((v) => String(v || "").toLowerCase().includes(q))
      );
    }

    tbody.innerHTML = rows.map((i) => `
      <tr class="${i.cancelled ? "erp-row-cancelled" : ""}">
        <td>${esc(i.invoice_number)}</td>
        <td>${esc(i.order_number || "-")}</td>
        <td>${esc(i.customer?.name || "-")}</td>
        <td><b class="erp-amount">${MoneyUtils.fmt(i.total)}</b></td>
        <td>${MoneyUtils.fmt(i.paid)}</td>
        <td>${MoneyUtils.fmt(i.remaining)}</td>
        <td><span class="erp-status ${i.cancelled ? "cancelled" : i.payment_status}">${i.cancelled ? "ملغاة" : statusLabel(i.payment_status)}</span></td>
        <td>${esc(i.invoice_date || i.created_at?.slice(0, 10) || "-")}</td>
        <td><button class="erp-primary-mini" type="button" data-load-invoice="${esc(i.id)}">عرض</button></td>
      </tr>
    `).join("") || '<tr><td colspan="9">لا توجد فواتير</td></tr>';

    tbody.querySelectorAll("[data-load-invoice]").forEach((btn) => {
      btn.addEventListener("click", () => loadInvoiceIntoForm(btn.dataset.loadInvoice));
    });
  }

  function statusLabel(status) {
    return { unpaid: "غير مدفوعة", partial: "جزئي", paid: "مدفوعة" }[status] || status;
  }

  function showEditor() {
    $("invoiceEditorView").hidden = false;
    $("invoiceListView").hidden = true;
  }

  function showList() {
    $("invoiceEditorView").hidden = true;
    $("invoiceListView").hidden = false;
    renderInvoiceList();
  }

  // ===== Print / PDF =====

  function printInvoice() {
    const paper = document.getElementById("invoicePaper");
    if (!paper) return toast("لا توجد فاتورة للطباعة");
    const html = `
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>فاتورة</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { margin: 0; font-family: Tahoma, Arial, sans-serif; color: #152546; background: #fff; }
          .page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 10mm; box-sizing: border-box; }
          ${getInvoicePrintStyles()}
        </style>
      </head>
      <body>
        <div class="page">${paper.innerHTML}</div>
      </body>
      </html>
    `;
    const w = window.open("", "_blank");
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  function downloadPdf() {
    printInvoice();
  }

  function getInvoicePrintStyles() {
    return `
      .erp-invoice-paper-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid #152546; padding-bottom: 14px; margin-bottom: 16px; }
      .erp-invoice-logo img { width: 86px; height: 86px; object-fit: contain; }
      .erp-invoice-company { text-align: center; flex: 1; }
      .erp-invoice-company b { display: block; font-size: 1.3rem; }
      .erp-invoice-company span { color: #7a8296; font-size: 0.9rem; }
      .erp-invoice-qr img { width: 90px; height: 90px; }
      .erp-invoice-title { text-align: center; margin: 12px 0; }
      .erp-invoice-title h2 { margin: 0; font-size: 1.4rem; }
      .erp-invoice-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
      .erp-invoice-meta div { background: #f8f9fc; border: 1px solid #e7eaf2; border-radius: 10px; padding: 10px; text-align: center; }
      .erp-invoice-meta span { display: block; color: #7a8296; font-size: 0.72rem; margin-bottom: 4px; }
      .erp-invoice-meta b { font-size: 0.9rem; }
      .erp-invoice-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
      .erp-invoice-party { border: 1px solid #e7eaf2; border-radius: 12px; padding: 12px; }
      .erp-invoice-party b { display: block; margin-bottom: 6px; color: #152546; }
      .erp-invoice-party div { font-size: 0.85rem; color: #3a4256; margin-bottom: 3px; }
      .erp-invoice-table { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 16px; }
      .erp-invoice-table th, .erp-invoice-table td { border: 1px solid #dfe5ef; padding: 10px; text-align: right; font-size: 0.82rem; word-break: break-word; overflow-wrap: break-word; white-space: normal; vertical-align: top; }
      .erp-invoice-table th { background: #152546; color: #fff; }
      .erp-invoice-table th:nth-child(1), .erp-invoice-table td:nth-child(1) { width: 24px; text-align: center; }
      .erp-invoice-table th:nth-child(2), .erp-invoice-table td:nth-child(2) { width: auto; }
      .erp-invoice-table th:nth-child(3), .erp-invoice-table td:nth-child(3) { width: 40px; text-align: center; }
      .erp-invoice-table th:nth-child(4), .erp-invoice-table td:nth-child(4) { width: 62px; }
      .erp-invoice-table th:nth-child(5), .erp-invoice-table td:nth-child(5) { width: 48px; }
      .erp-invoice-table th:nth-child(6), .erp-invoice-table td:nth-child(6) { width: 62px; }
      .erp-invoice-table th { font-size: 0.6rem; line-height: 1.2; }
      .erp-invoice-totals { width: 320px; margin-inline-start: auto; margin-bottom: 16px; }
      .erp-invoice-totals div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf0f6; }
      .erp-invoice-grand { font-size: 1.1rem; font-weight: 900; color: #152546; }
      .erp-invoice-words { background: #f8f9fc; border: 1px solid #e7eaf2; border-radius: 10px; padding: 12px; margin-bottom: 16px; font-size: 0.9rem; }
      .erp-invoice-notes { margin-bottom: 12px; font-size: 0.85rem; }
      .erp-invoice-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 24px 0 16px; text-align: center; }
      .erp-sign-line { border-top: 1px dashed #152546; margin-top: 40px; }
      .erp-invoice-footer { display: flex; justify-content: center; gap: 24px; border-top: 1px solid #e7eaf2; padding-top: 12px; font-size: 0.8rem; color: #7a8296; }
      @media print { body { background: #fff; } .page { padding: 0; } }
    `;
  }

  // ===== Arabic amount in words =====

  function numberToArabicWords(num) {
    const n = Number(num);
    if (isNaN(n) || n === 0) return "صفر درهم إماراتي فقط لا غير";
    const intPart = Math.floor(n);
    const decPart = Math.round((n - intPart) * 100);
    let text = integerToArabic(intPart) + " درهم إماراتي";
    if (decPart > 0) text += " و " + integerToArabic(decPart) + " فلس";
    text += " فقط لا غير";
    return text;
  }

  function integerToArabic(n) {
    if (n === 0) return "صفر";
    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
    const scales = ["", "ألف", "مليون", "مليار", "تريليون"];

    function chunk(num) {
      const parts = [];
      while (num > 0) { parts.push(num % 1000); num = Math.floor(num / 1000); }
      return parts;
    }

    function threeDigits(num) {
      if (num === 0) return "";
      let h = Math.floor(num / 100);
      let r = num % 100;
      let t = Math.floor(r / 10);
      let o = r % 10;
      let res = "";
      if (h > 0) res += hundreds[h] + " و ";
      if (r > 0) {
        if (r < 20) res += ones[r];
        else {
          res += ones[o];
          if (o > 0) res += " و ";
          res += tens[t];
        }
      }
      if (res.endsWith(" و ")) res = res.slice(0, -3);
      return res.trim();
    }

    const parts = chunk(n);
    let result = "";
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i] === 0) continue;
      let txt = threeDigits(parts[i]);
      if (i > 0) {
        if (parts[i] === 1) txt = scales[i];
        else if (parts[i] === 2) txt = "ألفان";
        else if (parts[i] >= 3 && parts[i] <= 10) txt += " " + scales[i];
        else txt += " " + scales[i] + "ة";
      }
      result += txt + " و ";
    }
    if (result.endsWith(" و ")) result = result.slice(0, -3);
    return result.trim();
  }

  // ===== Search =====

  function filterInvoiceList() {
    renderInvoiceList();
  }

  // ===== Events =====

  function bindEvents() {
    bindNavEvents();

    $("btnNewInvoice")?.addEventListener("click", newInvoice);
    $("btnInvoiceList")?.addEventListener("click", showList);
    $("btnImportOrder")?.addEventListener("click", importOrder);
    $("btnAddItem")?.addEventListener("click", () => addItem());
    $("invoiceForm")?.addEventListener("submit", (e) => { e.preventDefault(); saveInvoice(); });
    $("btnPrint")?.addEventListener("click", printInvoice);
    $("btnPdf")?.addEventListener("click", downloadPdf);
    $("btnCancelInvoice")?.addEventListener("click", cancelInvoice);

    $("invoiceForm")?.querySelectorAll("input, select, textarea").forEach((input) => {
      input.addEventListener("input", recalc);
      input.addEventListener("change", recalc);
    });

    $("invoiceListSearch")?.addEventListener("input", filterInvoiceList);
    $("invoiceListFilter")?.addEventListener("change", filterInvoiceList);
  }

  async function boot() {
    document.body.classList.add("erp-menu-ready");
    hydrateUser();
    bindEvents();
    setFormValue("invoice_date", todayIso());
    addItem();
    recalc();
    setSync("جاري التحميل");
    if (!window.sbFetch) {
      await new Promise((resolve) => {
        let tries = 0;
        const timer = setInterval(() => {
          tries += 1;
          if (window.sbFetch || tries > 50) { clearInterval(timer); resolve(); }
        }, 100);
      });
    }
    try {
      await loadAll();
      $("invNumber").value = generateInvoiceNumber();
    } catch (e) {
      console.error("[Invoices] boot failed:", e);
      toast("فشل تحميل البيانات: " + e.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
