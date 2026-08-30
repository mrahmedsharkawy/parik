(function () {
  "use strict";

  const state = {
    view: "treasury",
    period: "month",
    customDay: "",
    customMonth: "",
    customYear: "",
    treasuryCapital: null,
    bankAccounts: [],
    cashRegister: null,
    fixedAssets: [],
    assetInstallments: [],
    liabilities: [],
    receivables: [],
    inventoryValues: [],
    treasuryTransactions: [],
    auditLogs: [],
    suppliers: [],
    treasurySearch: "",
    treasuryTypeFilter: "",
    treasuryStatusFilter: "",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function todayIso(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.toISOString().slice(0, 10);
  }

  function inPeriod(dateValue) {
    const d = new Date(dateValue);
    if (state.period === "all") return true;
    if (isNaN(d.getTime())) return false;
    const iso = d.toISOString().slice(0, 10);
    if (state.period === "custom-day") return !!state.customDay && iso === state.customDay;
    if (state.period === "custom-month") return !!state.customMonth && iso.slice(0, 7) === state.customMonth;
    if (state.period === "custom-year") return !!state.customYear && iso.slice(0, 4) === String(state.customYear);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (state.period === "today") return d >= start;
    if (state.period === "week") {
      start.setDate(start.getDate() - 6);
      return d >= start;
    }
    if (state.period === "month") {
      start.setDate(1);
      return d >= start;
    }
    return true;
  }

  const MoneyUtils = {
    toCents(value) {
      return Math.round((Number(value) || 0) * 100);
    },
    fromCents(cents) {
      return Math.round(cents) / 100;
    },
    add(a, b) {
      return MoneyUtils.fromCents(MoneyUtils.toCents(a) + MoneyUtils.toCents(b));
    },
    sub(a, b) {
      return MoneyUtils.fromCents(MoneyUtils.toCents(a) - MoneyUtils.toCents(b));
    },
    sum(values) {
      return MoneyUtils.fromCents(values.reduce((acc, v) => acc + MoneyUtils.toCents(v), 0));
    },
    fmt(value) {
      return "AED " + (Number(value) || 0).toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },
    safe(value) {
      return Math.max(0, MoneyUtils.fromCents(MoneyUtils.toCents(value)));
    },
  };

  async function erpFetch(path, opts) {
    if (!window.sbFetch) throw new Error("Supabase client is not ready");
    return window.sbFetch(path, Object.assign({ requireAuth: true }, opts || {}));
  }

  async function loadTable(path, fallback) {
    try {
      return await erpFetch(path);
    } catch (error) {
      console.warn("[Treasury] load failed:", path, error.message);
      return fallback || [];
    }
  }

  const ErpRepository = {
    async select(table, query = "") {
      const path = query ? `${table}?${query}` : table;
      return erpFetch(path);
    },
    async insert(table, payload, prefer = "return=minimal") {
      return erpFetch(table, { method: "POST", body: JSON.stringify(payload), prefer });
    },
    async update(table, id, payload, prefer = "return=minimal") {
      return erpFetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload), prefer });
    },
    async delete(table, id, prefer = "return=minimal") {
      return erpFetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer });
    },
  };

  async function loadData() {
    setSync("جاري التحميل");
    renderSkeletons();
    const [
      suppliers,
      treasuryCapitalRows,
      bankAccounts,
      cashRegisterRows,
      fixedAssets,
      assetInstallments,
      liabilities,
      receivables,
      inventoryValues,
      treasuryTransactions,
      auditLogs,
    ] = await Promise.all([
      loadTable("erp_suppliers?order=created_at.desc&limit=200"),
      loadTable("erp_company_capital?order=created_at.desc&limit=1"),
      loadTable("erp_bank_accounts?active=eq.true&order=created_at.desc&limit=100"),
      loadTable("erp_cash_register?order=created_at.desc&limit=1"),
      loadTable("erp_fixed_assets?order=purchase_date.desc&limit=200"),
      loadTable("erp_asset_installments?order=due_date.asc&limit=500"),
      loadTable("erp_liabilities?order=created_at.desc&limit=200"),
      loadTable("erp_receivables?order=created_at.desc&limit=200"),
      loadTable("erp_inventory_value?order=created_at.desc&limit=50"),
      loadTable("erp_treasury_transactions?order=transaction_date.desc,created_at.desc&limit=500"),
      loadTable("erp_audit_log?order=performed_at.desc&limit=200"),
    ]);
    Object.assign(state, {
      suppliers: Array.isArray(suppliers) ? suppliers : [],
      treasuryCapital: Array.isArray(treasuryCapitalRows) && treasuryCapitalRows.length ? treasuryCapitalRows[0] : null,
      bankAccounts: Array.isArray(bankAccounts) ? bankAccounts : [],
      cashRegister: Array.isArray(cashRegisterRows) && cashRegisterRows.length ? cashRegisterRows[0] : null,
      fixedAssets: Array.isArray(fixedAssets) ? fixedAssets : [],
      assetInstallments: Array.isArray(assetInstallments) ? assetInstallments : [],
      liabilities: Array.isArray(liabilities) ? liabilities : [],
      receivables: Array.isArray(receivables) ? receivables : [],
      inventoryValues: Array.isArray(inventoryValues) ? inventoryValues : [],
      treasuryTransactions: Array.isArray(treasuryTransactions) ? treasuryTransactions : [],
      auditLogs: Array.isArray(auditLogs) ? auditLogs : [],
    });
    refreshStatusesInState();
    setSync("متصل");
    renderAll();
    rebuildDynamicForms();
  }

  function renderSkeletons() {
    if ($("erpTreasuryKpis")) $("erpTreasuryKpis").innerHTML = Array.from({ length: 6 }).map(() => '<div class="erp-skeleton"></div>').join("");
  }

  function renderAll() {
    const kpis = calculateTreasuryKpis();
    renderTreasuryKpis(kpis);
    renderLiquidityStatus(kpis.liquidityStatus, kpis.totalLiquidity, kpis.reserve, kpis.availableLiquidity);
    renderBankAccounts();
    renderFixedAssets();
    renderInstallments();
    renderUpcomingObligations(kpis);
    renderLiabilities();
    renderReceivables();
    renderInventoryValue();
    renderTreasuryTransactions();
    renderAuditLog();
    updateTreasuryTransactionForm();
    updateLastSync();
  }

  function supplierOptions() {
    const rows = state.suppliers.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
    return '<option value="">بدون مورد</option>' + (rows || '<option value="" disabled>أضف مورد أولًا</option>');
  }

  function rebuildDynamicForms() {
    document.querySelectorAll("[data-suppliers]").forEach((el) => { el.innerHTML = supplierOptions(); });
  }

  function setSync(text) {
    if ($("erpSyncState")) $("erpSyncState").textContent = text;
  }

  function updateLastSync() {
    if ($("erpLastSync")) $("erpLastSync").textContent = "آخر تحديث: " + new Date().toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" });
  }

  function treasuryTypeLabel(type) {
    return {
      deposit: "إيداع",
      withdrawal: "سحب",
      expense: "مصروف",
      capital_injection: "إضافة رأس مال",
      owner_withdrawal: "سحب مالك",
      internal_transfer: "تحويل داخلي",
      asset_purchase: "شراء أصل",
      asset_sale: "بيع أصل",
      installment_payment: "دفع قسط",
      receivable_collection: "تحصيل مستحق",
      liability_payment: "سداد مديونية",
      balance_adjustment: "تعديل رصيد",
      other: "حركة أخرى",
    }[type] || type;
  }

  function installmentStatusLabel(status) {
    return {
      upcoming: "قادم",
      due_today: "مستحق اليوم",
      overdue: "متأخر",
      paid: "مدفوع",
      partial: "جزئي",
    }[status] || status;
  }

  function liabilityStatusLabel(status) {
    return {
      active: "نشط",
      paid: "مسدد",
      overdue: "متأخر",
      defaulted: "متعثر",
    }[status] || status;
  }

  function receivableStatusLabel(status) {
    return {
      active: "نشط",
      collected: "محصل",
      overdue: "متأخر",
      partial: "جزئي",
    }[status] || status;
  }

  function formatEntityName(type, id) {
    if (!type || !id) return "";
    if (type === "bank") {
      const account = state.bankAccounts.find((a) => String(a.id) === String(id));
      return account ? `${account.bank_name} (${account.account_name || ""})` : "بنك";
    }
    if (type === "cash") return "الكاش";
    if (type === "asset") {
      const asset = state.fixedAssets.find((a) => String(a.id) === String(id));
      return asset ? asset.name : "أصل";
    }
    if (type === "liability") {
      const liability = state.liabilities.find((l) => String(l.id) === String(id));
      return liability ? liability.name : "مديونية";
    }
    if (type === "receivable") {
      const receivable = state.receivables.find((r) => String(r.id) === String(id));
      return receivable ? receivable.party_name : "مستحق";
    }
    return type;
  }

  function calculateTreasuryKpis() {
    const capital = MoneyUtils.safe(state.treasuryCapital?.capital_amount || 0);
    const reserve = MoneyUtils.safe(state.treasuryCapital?.reserve_amount || 0);
    const bankTotal = MoneyUtils.sum(state.bankAccounts.map((a) => a.balance || 0));
    const cash = MoneyUtils.safe(state.cashRegister?.balance || 0);
    const totalLiquidity = MoneyUtils.add(bankTotal, cash);
    const availableLiquidity = MoneyUtils.sub(totalLiquidity, reserve);
    const fixedAssetsValue = MoneyUtils.sum(state.fixedAssets.map((a) => a.current_value || a.purchase_price || 0));
    const fixedAssetsRemaining = MoneyUtils.sum(state.fixedAssets.map((a) => a.financed_amount || 0));
    const fixedAssetsNet = MoneyUtils.sub(fixedAssetsValue, fixedAssetsRemaining);
    const inventoryValue = MoneyUtils.safe(state.inventoryValues[0]?.value || 0);
    const totalAssets = MoneyUtils.add(fixedAssetsValue, inventoryValue);
    const liabilitiesTotal = MoneyUtils.sum(state.liabilities.map((l) => l.remaining_amount || 0));
    const installmentsRemaining = MoneyUtils.sum(state.assetInstallments
      .filter((i) => i.status !== "paid")
      .map((i) => MoneyUtils.sub(i.amount || 0, i.paid_amount || 0)));
    const totalLiabilities = MoneyUtils.add(liabilitiesTotal, installmentsRemaining);
    const receivablesTotal = MoneyUtils.sum(state.receivables.map((r) => r.remaining_amount || 0));

    const today = new Date();
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

    const thisMonthInstallments = state.assetInstallments.filter((i) => {
      const d = new Date(i.due_date);
      return i.status !== "paid" && d >= thisMonthStart && d <= nextMonthStart;
    });
    const nextMonthInstallments = state.assetInstallments.filter((i) => {
      const d = new Date(i.due_date);
      return i.status !== "paid" && d >= nextMonthStart && d <= nextMonthEnd;
    });
    const overdueInstallments = state.assetInstallments.filter((i) => i.status === "overdue");

    const netPosition = MoneyUtils.sub(MoneyUtils.add(MoneyUtils.add(totalLiquidity, totalAssets), receivablesTotal), totalLiabilities);

    let liquidityStatus = "safe";
    if (totalLiquidity < reserve) liquidityStatus = "danger";
    else if (totalLiquidity < MoneyUtils.add(reserve, MoneyUtils.fromCents(50000))) liquidityStatus = "warning";

    return {
      capital,
      reserve,
      bankTotal,
      cash,
      totalLiquidity,
      availableLiquidity,
      fixedAssetsValue,
      fixedAssetsNet,
      totalAssets,
      liabilitiesTotal,
      installmentsRemaining,
      totalLiabilities,
      receivablesTotal,
      thisMonthInstallmentsTotal: MoneyUtils.sum(thisMonthInstallments.map((i) => MoneyUtils.sub(i.amount || 0, i.paid_amount || 0))),
      nextMonthInstallmentsTotal: MoneyUtils.sum(nextMonthInstallments.map((i) => MoneyUtils.sub(i.amount || 0, i.paid_amount || 0))),
      overdueTotal: MoneyUtils.sum(overdueInstallments.map((i) => MoneyUtils.sub(i.amount || 0, i.paid_amount || 0))),
      overdueCount: overdueInstallments.length,
      netPosition,
      liquidityStatus,
    };
  }

  function refreshStatusesInState() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    state.assetInstallments.forEach((i) => {
      if (i.status === "paid") return;
      const due = new Date(i.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) i.status = "overdue";
      else if (due.getTime() === today.getTime()) i.status = "due_today";
      else i.status = "upcoming";
      if (i.paid_amount > 0 && i.paid_amount < i.amount) i.status = "partial";
    });
    state.liabilities.forEach((l) => {
      if (l.status === "paid") return;
      const due = l.due_date ? new Date(l.due_date) : null;
      if (due) {
        due.setHours(0, 0, 0, 0);
        if (due < today) l.status = "overdue";
        else l.status = "active";
      }
      if ((l.remaining_amount || 0) <= 0) l.status = "paid";
    });
    state.receivables.forEach((r) => {
      if (r.status === "collected") return;
      const due = r.due_date ? new Date(r.due_date) : null;
      if (due) {
        due.setHours(0, 0, 0, 0);
        if (due < today) r.status = "overdue";
        else r.status = "active";
      }
      if ((r.remaining_amount || 0) <= 0) r.status = "collected";
      else if ((r.collected_amount || 0) > 0) r.status = "partial";
    });
  }

  function renderTreasuryKpis(kpis) {
    const target = $("erpTreasuryKpis");
    if (!target) return;
    const items = [
      { label: "رأس مال الشركة", value: MoneyUtils.fmt(kpis.capital), note: "الرأس المال المدخل يدويًا", icon: "🏢", bg: "var(--erp-blue-soft)" },
      { label: "إجمالي السيولة", value: MoneyUtils.fmt(kpis.totalLiquidity), note: "البنوك + الكاش", icon: "💧", bg: "var(--erp-mint-soft)" },
      { label: "رصيد البنوك", value: MoneyUtils.fmt(kpis.bankTotal), note: `${state.bankAccounts.length} حساب`, icon: "🏦", bg: "var(--erp-purple-soft)" },
      { label: "الكاش", value: MoneyUtils.fmt(kpis.cash), note: "النقدية بالخزنة", icon: "💵", bg: "var(--erp-yellow-soft)" },
      { label: "احتياطي رأس المال", value: MoneyUtils.fmt(kpis.reserve), note: "الحد الأدنى للأمان", icon: "🛡️", bg: "var(--erp-pink-soft)" },
      { label: "المتاح للتشغيل", value: MoneyUtils.fmt(kpis.availableLiquidity), note: "السيولة - الاحتياطي", icon: "✅", bg: "var(--erp-mint-soft)" },
      { label: "إجمالي قيمة الأصول", value: MoneyUtils.fmt(kpis.totalAssets), note: "أصول + مخزون", icon: "🏭", bg: "var(--erp-blue-soft)" },
      { label: "صافي قيمة الأصول", value: MoneyUtils.fmt(kpis.fixedAssetsNet), note: "الأصول بعد التزاماتها", icon: "📊", bg: "var(--erp-purple-soft)" },
      { label: "قيمة المخزون", value: MoneyUtils.fmt(kpis.inventoryValue), note: "آخر قيمة يدوية", icon: "📦", bg: "var(--erp-yellow-soft)" },
      { label: "مستحقات لنا", value: MoneyUtils.fmt(kpis.receivablesTotal), note: "أموال يجب تحصيلها", icon: "📈", bg: "var(--erp-mint-soft)" },
      { label: "مديونيات علينا", value: MoneyUtils.fmt(kpis.totalLiabilities), note: "التزامات مستحقة", icon: "📉", bg: "var(--erp-peach-soft)" },
      { label: "أقساط هذا الشهر", value: MoneyUtils.fmt(kpis.thisMonthInstallmentsTotal), note: "الاستحقاقات الشهرية", icon: "📅", bg: "var(--erp-blue-soft)" },
      { label: "المتأخرات", value: MoneyUtils.fmt(kpis.overdueTotal), note: `${kpis.overdueCount} قسط متأخر`, icon: "⚠️", bg: "var(--erp-peach-soft)" },
      { label: "صافي المركز المالي", value: MoneyUtils.fmt(kpis.netPosition), note: "سيولة + أصول + مستحقات - التزامات", icon: "🎯", bg: "var(--erp-purple-soft)" },
    ];
    target.innerHTML = items.map((item) => `
      <article class="erp-kpi" style="background:${item.bg}">
        <span class="erp-kpi-icon">${item.icon}</span>
        <div>
          <div class="erp-kpi-label">${esc(item.label)}</div>
          <div class="erp-kpi-value">${esc(item.value)}</div>
          <div class="erp-kpi-foot"><span>${esc(item.note)}</span></div>
        </div>
      </article>`).join("");
  }

  function renderLiquidityStatus(status, totalLiquidity, reserve, available) {
    const target = $("erpLiquidityStatus");
    const textTarget = $("erpLiquidityStatusText");
    if (!target || !textTarget) return;
    const map = {
      safe: { text: "آمنة", class: "safe", note: `المتاح للتشغيل ${MoneyUtils.fmt(available)}` },
      warning: { text: "تحتاج انتباه", class: "warning", note: `السيولة قريبة من الاحتياطي ${MoneyUtils.fmt(reserve)}` },
      danger: { text: "خطر", class: "danger", note: `السيولة أقل من الاحتياطي ${MoneyUtils.fmt(reserve)}` },
    };
    const info = map[status] || map.safe;
    target.className = `erp-treasury-status ${info.class}`;
    textTarget.textContent = `${info.text} — ${info.note}`;
  }

  function renderBankAccounts() {
    const target = $("erpBankAccountsRows");
    if (!target) return;
    target.innerHTML = state.bankAccounts.length ? state.bankAccounts.map((a) => `
      <tr data-record-id="${esc(a.id)}">
        <td>${esc(a.bank_name)}</td>
        <td>${esc(a.account_name || "-")}</td>
        <td><b class="erp-amount">${MoneyUtils.fmt(a.balance)}</b></td>
        <td></td>
      </tr>`).join("") : '<tr><td colspan="4">لا توجد حسابات بنكية مسجلة.</td></tr>';
  }

  function renderFixedAssets() {
    const target = $("erpFixedAssetsRows");
    if (!target) return;
    target.innerHTML = state.fixedAssets.length ? state.fixedAssets.map((a) => `
      <tr data-record-id="${esc(a.id)}">
        <td>${esc(a.name)} ${a.serial_number ? `<small>(${esc(a.serial_number)})</small>` : ""}</td>
        <td>${MoneyUtils.fmt(a.purchase_price)}</td>
        <td>${MoneyUtils.fmt(a.financed_amount)}</td>
        <td>${MoneyUtils.fmt(a.current_value || a.purchase_price || 0)}</td>
        <td><span class="erp-status">${esc(a.status)}</span></td>
        <td></td>
      </tr>`).join("") : '<tr><td colspan="6">لا توجد أصول مسجلة.</td></tr>';
  }

  function renderInstallments() {
    const target = $("erpInstallmentsList");
    const select = $("erpInstallmentSelect");
    if (!target) return;
    const upcoming = state.assetInstallments.filter((i) => i.status !== "paid").slice(0, 20);
    target.innerHTML = upcoming.length ? upcoming.map((i) => {
      const asset = state.fixedAssets.find((a) => String(a.id) === String(i.asset_id));
      const remaining = MoneyUtils.sub(i.amount || 0, i.paid_amount || 0);
      return `
        <div class="erp-list-item erp-installment-card ${esc(i.status)}">
          <span><strong>${esc(asset?.name || "أصل")}</strong><small>قسط ${i.installment_number} — استحقاق ${i.due_date}</small></span>
          <span><b class="erp-amount">${MoneyUtils.fmt(remaining)}</b><span class="erp-status">${esc(installmentStatusLabel(i.status))}</span></span>
        </div>`;
    }).join("") : '<div class="erp-empty">لا توجد أقساط مستحقة.</div>';

    if (select) {
      const options = state.assetInstallments.filter((i) => i.status !== "paid").map((i) => {
        const asset = state.fixedAssets.find((a) => String(a.id) === String(i.asset_id));
        return `<option value="${esc(i.id)}">${esc(asset?.name || "أصل")} — قسط ${i.installment_number} (${i.due_date})</option>`;
      }).join("");
      select.innerHTML = `<option value="">اختر قسطًا</option>${options || '<option value="" disabled>لا توجد أقساط مستحقة</option>'}`;
    }
  }

  function renderUpcomingObligations(kpis) {
    const target = $("erpUpcomingObligations");
    if (!target) return;
    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);
    const within7Days = state.assetInstallments.filter((i) => i.status !== "paid" && new Date(i.due_date) <= next7Days && new Date(i.due_date) >= today);
    const projectedLiquidity = MoneyUtils.sub(kpis.totalLiquidity, kpis.thisMonthInstallmentsTotal);
    target.innerHTML = [
      ["خلال 7 أيام", MoneyUtils.sum(within7Days.map((i) => MoneyUtils.sub(i.amount || 0, i.paid_amount || 0))), `${within7Days.length} التزام قريب`],
      ["هذا الشهر", kpis.thisMonthInstallmentsTotal, "إجمالي الأقساط"],
      ["الشهر القادم", kpis.nextMonthInstallmentsTotal, "إجمالي متوقع"],
      ["المتأخرات", kpis.overdueTotal, `${kpis.overdueCount} قسط متأخر`],
      ["إجمالي المديونيات", kpis.liabilitiesTotal, "بدون أقساط الأصول"],
      ["المبالغ المتوقع تحصيلها", kpis.receivablesTotal, "مستحقات لنا"],
      ["السيولة المتوقعة بعد الالتزامات", projectedLiquidity, "لو دفعنا كل الالتزامات"],
    ].map((row) => `<div class="erp-metric"><strong>${esc(row[0])}</strong><small>${esc(row[2])}</small><b class="erp-amount">${MoneyUtils.fmt(row[1])}</b></div>`).join("");
  }

  function renderLiabilities() {
    const target = $("erpLiabilitiesRows");
    if (!target) return;
    target.innerHTML = state.liabilities.length ? state.liabilities.map((l) => `
      <tr>
        <td>${esc(l.name)}</td>
        <td>${esc(l.creditor)}</td>
        <td><b class="erp-amount">${MoneyUtils.fmt(l.remaining_amount)}</b></td>
        <td><span class="erp-status">${esc(liabilityStatusLabel(l.status))}</span></td>
      </tr>`).join("") : '<tr><td colspan="4">لا توجد مديونيات.</td></tr>';
  }

  function renderReceivables() {
    const target = $("erpReceivablesRows");
    if (!target) return;
    target.innerHTML = state.receivables.length ? state.receivables.map((r) => `
      <tr>
        <td>${esc(r.party_name)}</td>
        <td><b class="erp-amount">${MoneyUtils.fmt(r.remaining_amount)}</b></td>
        <td>${esc(r.due_date || "-")}</td>
        <td><span class="erp-status">${esc(receivableStatusLabel(r.status))}</span></td>
      </tr>`).join("") : '<tr><td colspan="4">لا توجد مستحقات.</td></tr>';
  }

  function renderInventoryValue() {
    const target = $("erpInventoryValueDisplay");
    if (!target) return;
    const value = state.inventoryValues[0]?.value || 0;
    target.textContent = MoneyUtils.fmt(value);
  }

  function renderTreasuryTransactions() {
    const target = $("erpTreasuryTransactionsRows");
    if (!target) return;
    const rows = filteredTreasuryTransactions();
    target.innerHTML = rows.length ? rows.map((row) => `
      <tr class="${row.cancelled ? "erp-row-cancelled" : ""}">
        <td>${esc(row.transaction_date)}</td>
        <td>${esc(treasuryTypeLabel(row.type))}</td>
        <td><b class="erp-amount">${MoneyUtils.fmt(row.amount)}</b></td>
        <td>${esc(formatEntityName(row.source_type, row.source_id))}</td>
        <td>${esc(formatEntityName(row.destination_type, row.destination_id))}</td>
        <td>${esc(row.description)} ${row.reference_number ? `<small>(${esc(row.reference_number)})</small>` : ""}</td>
        <td><span class="erp-status">${row.cancelled ? "ملغاة" : "فعّالة"}</span></td>
        <td>${row.cancelled ? "" : `<button class="erp-danger-mini" type="button" data-cancel-treasury-id="${esc(row.id)}">إلغاء</button>`}</td>
      </tr>`).join("") : '<tr><td colspan="8">لا توجد حركات مطابقة.</td></tr>';
  }

  function renderAuditLog() {
    const target = $("erpAuditLogRows");
    if (!target) return;
    target.innerHTML = state.auditLogs.length ? state.auditLogs.slice(0, 50).map((log) => `
      <tr>
        <td>${new Date(log.performed_at).toLocaleString("ar-AE")}</td>
        <td>${esc(log.table_name)}</td>
        <td><span class="erp-status">${esc(log.action)}</span></td>
        <td>${esc(log.performed_by || "-")}</td>
        <td>${esc(log.reason || "-")}</td>
      </tr>`).join("") : '<tr><td colspan="5">لا توجد سجلات تدقيق.</td></tr>';
  }

  function updateTreasuryTransactionForm() {
    const type = $("erpTreasuryTxType")?.value || "";
    const sourceType = $("erpTreasurySourceType");
    const sourceId = $("erpTreasurySourceId");
    const destType = $("erpTreasuryDestType");
    const destId = $("erpTreasuryDestId");
    if (!sourceType || !destType) return;

    const presets = {
      deposit: { source: "", dest: "bank" },
      withdrawal: { source: "bank", dest: "" },
      expense: { source: "cash", dest: "" },
      capital_injection: { source: "", dest: "cash" },
      owner_withdrawal: { source: "cash", dest: "" },
      internal_transfer: { source: "bank", dest: "cash" },
      asset_purchase: { source: "cash", dest: "asset" },
      asset_sale: { source: "asset", dest: "cash" },
      installment_payment: { source: "cash", dest: "liability" },
      receivable_collection: { source: "receivable", dest: "cash" },
      liability_payment: { source: "cash", dest: "liability" },
      balance_adjustment: { source: "cash", dest: "" },
      other: { source: "", dest: "" },
    };
    const preset = presets[type] || presets.other;
    sourceType.value = preset.source;
    destType.value = preset.dest;
    renderTreasuryEntityOptions(sourceType.value, sourceId);
    renderTreasuryEntityOptions(destType.value, destId);
  }

  function renderTreasuryEntityOptions(type, selectEl) {
    if (!selectEl) return;
    let options = '<option value="">--</option>';
    if (type === "bank") {
      options += state.bankAccounts.map((a) => `<option value="${esc(a.id)}">${esc(a.bank_name)} ${esc(a.account_name || "")}</option>`).join("");
    } else if (type === "asset") {
      options += state.fixedAssets.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
    } else if (type === "liability") {
      options += state.liabilities.map((l) => `<option value="${esc(l.id)}">${esc(l.name)} (${esc(l.creditor)})</option>`).join("");
    } else if (type === "receivable") {
      options += state.receivables.map((r) => `<option value="${esc(r.id)}">${esc(r.party_name)}</option>`).join("");
    }
    selectEl.innerHTML = options;
  }

  function checkReserveWarning() {
    const warning = $("erpReserveWarning");
    if (!warning) return;
    const type = $("erpTreasuryTxType")?.value || "";
    const sourceType = $("erpTreasurySourceType")?.value || "";
    const sourceId = $("erpTreasurySourceId")?.value || "";
    const form = $("erpTreasuryTxType")?.closest("form");
    const amount = Number(form?.elements.amount?.value || 0);
    if (!amount || !sourceType) { warning.hidden = true; return; }

    const reserve = MoneyUtils.safe(state.treasuryCapital?.reserve_amount || 0);
    const bankTotal = MoneyUtils.sum(state.bankAccounts.map((a) => a.balance || 0));
    const cash = MoneyUtils.safe(state.cashRegister?.balance || 0);
    let sourceBalance = 0;
    if (sourceType === "bank") {
      const account = state.bankAccounts.find((a) => String(a.id) === String(sourceId));
      sourceBalance = account?.balance || 0;
    } else if (sourceType === "cash") {
      sourceBalance = cash;
    }

    const decreasesLiquidityList = ["withdrawal", "expense", "owner_withdrawal", "internal_transfer", "asset_purchase", "installment_payment", "liability_payment"];
    if (!decreasesLiquidityList.includes(type)) { warning.hidden = true; return; }

    const projectedTotal = MoneyUtils.sub(MoneyUtils.add(bankTotal, cash), amount);
    warning.hidden = projectedTotal >= reserve;
  }

  async function saveTreasurySetup(form) {
    const data = new FormData(form);
    const capital = MoneyUtils.safe(data.get("capital_amount"));
    const reserve = MoneyUtils.safe(data.get("reserve_amount"));
    const bankName = String(data.get("bank_name") || "").trim();
    const accountName = String(data.get("account_name") || "").trim();
    const bankBalance = MoneyUtils.safe(data.get("bank_balance"));
    const cashBalance = MoneyUtils.safe(data.get("cash_balance"));

    if (state.treasuryCapital?.id) {
      await ErpRepository.update("erp_company_capital", state.treasuryCapital.id, { capital_amount: capital, reserve_amount: reserve, effective_date: todayIso() });
    } else {
      await ErpRepository.insert("erp_company_capital", { capital_amount: capital, reserve_amount: reserve });
    }

    if (bankName) {
      await ErpRepository.insert("erp_bank_accounts", {
        bank_name: bankName,
        account_name: accountName || null,
        balance: bankBalance,
      });
    }

    if (state.cashRegister?.id) {
      await ErpRepository.update("erp_cash_register", state.cashRegister.id, { balance: cashBalance });
    } else {
      await ErpRepository.insert("erp_cash_register", { balance: cashBalance });
    }

    form.reset();
    toast("تم حفظ إعدادات المركز المالي.");
    await loadData();
  }

  async function addFixedAsset(form) {
    const data = new FormData(form);
    const purchasePrice = MoneyUtils.safe(data.get("purchase_price"));
    const downPayment = MoneyUtils.safe(data.get("down_payment"));
    const financedAmount = MoneyUtils.safe(data.get("financed_amount"));
    const installmentsCount = Number(data.get("installments_count") || 0);
    const firstDueDate = data.get("first_due_date");
    const dueDay = Number(data.get("due_day") || 1);
    const currentValue = data.get("current_value") ? MoneyUtils.safe(data.get("current_value")) : purchasePrice;

    const payload = {
      name: data.get("name"),
      category: data.get("category") || null,
      purchase_price: purchasePrice,
      purchase_date: data.get("purchase_date") || todayIso(),
      payment_method: data.get("payment_method") || "cash",
      down_payment: downPayment,
      financed_amount: financedAmount,
      current_value: currentValue,
      serial_number: data.get("serial_number") || null,
      supplier_id: data.get("supplier_id") || null,
      notes: data.get("notes") || null,
    };

    const rows = await ErpRepository.insert("erp_fixed_assets", payload, "return=representation");
    const asset = Array.isArray(rows) ? rows[0] : rows;

    if (financedAmount > 0 && installmentsCount > 0 && asset?.id) {
      const installmentAmount = MoneyUtils.fromCents(Math.ceil(MoneyUtils.toCents(financedAmount) / installmentsCount));
      let due = firstDueDate ? new Date(firstDueDate) : new Date();
      const items = [];
      for (let i = 1; i <= installmentsCount; i += 1) {
        items.push({
          asset_id: asset.id,
          installment_number: i,
          amount: i === installmentsCount ? MoneyUtils.sub(financedAmount, MoneyUtils.fromCents((installmentsCount - 1) * MoneyUtils.toCents(installmentAmount))) : installmentAmount,
          due_date: due.toISOString().slice(0, 10),
        });
        due.setMonth(due.getMonth() + 1);
        due.setDate(Math.min(dueDay, new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate()));
      }
      await ErpRepository.insert("erp_asset_installments", items);
    }

    form.reset();
    toast("تم إضافة الأصل.");
    await loadData();
  }

  async function recordInstallmentPayment(form) {
    const data = new FormData(form);
    const installmentId = data.get("installment_id");
    const amount = MoneyUtils.safe(data.get("amount"));
    const paymentSource = data.get("payment_source") || "cash";
    const paidAt = data.get("paid_at") || todayIso();
    if (!installmentId || !amount) return toast("اختر القسط والمبلغ.");

    const installment = state.assetInstallments.find((i) => String(i.id) === String(installmentId));
    if (!installment) return toast("القسط غير موجود.");

    const newPaid = MoneyUtils.add(installment.paid_amount || 0, amount);
    const status = newPaid >= (installment.amount || 0) ? "paid" : "partial";
    await ErpRepository.update("erp_asset_installments", installmentId, {
      paid_amount: newPaid,
      paid_at: paidAt,
      status,
    });

    const asset = state.fixedAssets.find((a) => String(a.id) === String(installment.asset_id));
    if (asset) {
      const newFinanced = MoneyUtils.sub(asset.financed_amount || 0, amount);
      await ErpRepository.update("erp_fixed_assets", asset.id, { financed_amount: Math.max(0, newFinanced) });
    }

    await addTreasuryTransactionInternal({
      type: "installment_payment",
      amount,
      source_type: paymentSource,
      destination_type: "liability",
      destination_id: installmentId,
      description: `دفع قسط ${installment.installment_number} — ${asset?.name || "أصل"}`,
    });

    form.reset();
    toast("تم تسجيل دفع القسط.");
    await loadData();
  }

  async function addLiability(form) {
    const data = new FormData(form);
    await ErpRepository.insert("erp_liabilities", {
      name: data.get("name"),
      creditor: data.get("creditor"),
      reason: data.get("reason") || null,
      original_amount: MoneyUtils.safe(data.get("original_amount")),
      paid_amount: MoneyUtils.safe(data.get("paid_amount")),
      start_date: data.get("start_date") || todayIso(),
      due_date: data.get("due_date") || null,
      has_installments: data.get("has_installments") === "true",
      installment_amount: MoneyUtils.safe(data.get("installment_amount")),
      installments_count: Number(data.get("installments_count") || 0),
      notes: data.get("notes") || null,
    });
    form.reset();
    toast("تم إضافة الالتزام.");
    await loadData();
  }

  async function addReceivable(form) {
    const data = new FormData(form);
    await ErpRepository.insert("erp_receivables", {
      party_name: data.get("party_name"),
      party_type: data.get("party_type") || "customer",
      original_amount: MoneyUtils.safe(data.get("original_amount")),
      collected_amount: MoneyUtils.safe(data.get("collected_amount")),
      due_date: data.get("due_date") || null,
      notes: data.get("notes") || null,
    });
    form.reset();
    toast("تم إضافة المستحق.");
    await loadData();
  }

  async function updateInventoryValue(form) {
    const data = new FormData(form);
    await ErpRepository.insert("erp_inventory_value", {
      value: MoneyUtils.safe(data.get("value")),
      effective_date: data.get("effective_date") || todayIso(),
      notes: data.get("notes") || null,
    });
    form.reset();
    toast("تم تحديث قيمة المخزون.");
    await loadData();
  }

  async function addTreasuryTransaction(form) {
    const data = new FormData(form);
    const payload = {
      transaction_date: data.get("transaction_date") || todayIso(),
      type: data.get("type"),
      amount: MoneyUtils.safe(data.get("amount")),
      source_type: data.get("source_type") || null,
      source_id: data.get("source_id") || null,
      destination_type: data.get("destination_type") || null,
      destination_id: data.get("destination_id") || null,
      description: data.get("description"),
      reference_number: data.get("reference_number") || null,
      notes: data.get("notes") || null,
    };

    if (!payload.amount || payload.amount <= 0) return toast("اكتب مبلغ صحيح.");
    if (!payload.description) return toast("اكتب وصف الحركة.");

    const reserve = MoneyUtils.safe(state.treasuryCapital?.reserve_amount || 0);
    const bankTotal = MoneyUtils.sum(state.bankAccounts.map((a) => a.balance || 0));
    const cash = MoneyUtils.safe(state.cashRegister?.balance || 0);
    const projectedTotal = MoneyUtils.sub(MoneyUtils.add(bankTotal, cash), payload.amount);
    const override = $("erpReserveOverride")?.checked;
    const decreasesLiquidityList = ["withdrawal", "expense", "owner_withdrawal", "internal_transfer", "asset_purchase", "installment_payment", "liability_payment"];
    if (projectedTotal < reserve && !override && decreasesLiquidityList.includes(payload.type)) {
      return toast("⚠️ هذه العملية تؤدي لانخفاض السيولة عن الاحتياطي. يرجى الموافقة على التجاوز.");
    }

    await addTreasuryTransactionInternal(payload);
    if (override && $("erpReserveOverride")) $("erpReserveOverride").checked = false;
    form.reset();
    setFormDates();
    toast("تم حفظ الحركة المالية.");
    await loadData();
  }

  async function addTreasuryTransactionInternal(payload) {
    const rows = await ErpRepository.insert("erp_treasury_transactions", payload, "return=representation");
    const tx = Array.isArray(rows) ? rows[0] : rows;
    await applyTreasuryTransaction(payload);
    if (tx?.id) await auditLog("erp_treasury_transactions", tx.id, "insert", null, payload, payload.notes);
  }

  async function applyTreasuryTransaction(payload) {
    const amount = payload.amount;
    const { type, source_type, source_id, destination_type, destination_id } = payload;

    async function adjustBank(id, delta) {
      const account = state.bankAccounts.find((a) => String(a.id) === String(id));
      if (account) await ErpRepository.update("erp_bank_accounts", id, { balance: MoneyUtils.add(account.balance || 0, delta) });
    }

    async function adjustCash(delta) {
      const cashRegister = state.cashRegister;
      if (cashRegister) await ErpRepository.update("erp_cash_register", cashRegister.id, { balance: MoneyUtils.add(cashRegister.balance || 0, delta) });
    }

    if (type === "deposit" && destination_type === "bank" && destination_id) await adjustBank(destination_id, amount);
    if (type === "withdrawal" && source_type === "bank" && source_id) await adjustBank(source_id, -amount);
    if (type === "expense" && source_type === "cash") await adjustCash(-amount);

    if (type === "capital_injection") {
      const capital = state.treasuryCapital;
      if (capital) await ErpRepository.update("erp_company_capital", capital.id, { capital_amount: MoneyUtils.add(capital.capital_amount || 0, amount) });
      await adjustCash(amount);
    }

    if (type === "owner_withdrawal") {
      const capital = state.treasuryCapital;
      if (capital) await ErpRepository.update("erp_company_capital", capital.id, { capital_amount: MoneyUtils.sub(capital.capital_amount || 0, amount) });
      await adjustCash(-amount);
    }

    if (type === "internal_transfer") {
      if (source_type === "bank" && source_id) await adjustBank(source_id, -amount);
      if (source_type === "cash") await adjustCash(-amount);
      if (destination_type === "bank" && destination_id) await adjustBank(destination_id, amount);
      if (destination_type === "cash") await adjustCash(amount);
    }

    if (type === "asset_purchase") {
      if (source_type === "bank" && source_id) await adjustBank(source_id, -amount);
      if (source_type === "cash") await adjustCash(-amount);
    }

    if (type === "asset_sale" && destination_type === "cash") await adjustCash(amount);

    if (type === "liability_payment" && destination_id) {
      const liability = state.liabilities.find((l) => String(l.id) === String(destination_id));
      if (liability) await ErpRepository.update("erp_liabilities", destination_id, { paid_amount: MoneyUtils.add(liability.paid_amount || 0, amount) });
      if (source_type === "bank" && source_id) await adjustBank(source_id, -amount);
      if (source_type === "cash") await adjustCash(-amount);
    }

    if (type === "receivable_collection" && source_id) {
      const receivable = state.receivables.find((r) => String(r.id) === String(source_id));
      if (receivable) await ErpRepository.update("erp_receivables", source_id, { collected_amount: MoneyUtils.add(receivable.collected_amount || 0, amount) });
      if (destination_type === "bank" && destination_id) await adjustBank(destination_id, amount);
      if (destination_type === "cash") await adjustCash(amount);
    }

    if (type === "balance_adjustment" && source_type === "cash") {
      const cashRegister = state.cashRegister;
      if (cashRegister) await ErpRepository.update("erp_cash_register", cashRegister.id, { balance: amount });
    }
  }

  async function cancelTreasuryTransaction(id, reason) {
    const tx = state.treasuryTransactions.find((t) => String(t.id) === String(id));
    if (!tx) return;
    if (!reason) reason = prompt("سبب إلغاء الحركة؟") || "إلغاء يدوي";
    if (!reason) return;

    await ErpRepository.update("erp_treasury_transactions", id, {
      cancelled: true,
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    });
    await reverseTreasuryTransaction(tx);
    await auditLog("erp_treasury_transactions", id, "cancel", tx, { cancelled: true, cancel_reason: reason }, reason);
    toast("تم إلغاء الحركة.");
    await loadData();
  }

  async function reverseTreasuryTransaction(tx) {
    const amount = tx.amount;
    const { type, source_type, source_id, destination_type, destination_id } = tx;

    async function adjustBank(id, delta) {
      const account = state.bankAccounts.find((a) => String(a.id) === String(id));
      if (account) await ErpRepository.update("erp_bank_accounts", id, { balance: MoneyUtils.add(account.balance || 0, delta) });
    }

    async function adjustCash(delta) {
      const cashRegister = state.cashRegister;
      if (cashRegister) await ErpRepository.update("erp_cash_register", cashRegister.id, { balance: MoneyUtils.add(cashRegister.balance || 0, delta) });
    }

    if (type === "deposit" && destination_type === "bank" && destination_id) await adjustBank(destination_id, -amount);
    if (type === "withdrawal" && source_type === "bank" && source_id) await adjustBank(source_id, amount);
    if (type === "expense" && source_type === "cash") await adjustCash(amount);

    if (type === "capital_injection") {
      const capital = state.treasuryCapital;
      if (capital) await ErpRepository.update("erp_company_capital", capital.id, { capital_amount: MoneyUtils.sub(capital.capital_amount || 0, amount) });
      await adjustCash(-amount);
    }

    if (type === "owner_withdrawal") {
      const capital = state.treasuryCapital;
      if (capital) await ErpRepository.update("erp_company_capital", capital.id, { capital_amount: MoneyUtils.add(capital.capital_amount || 0, amount) });
      await adjustCash(amount);
    }

    if (type === "internal_transfer") {
      if (source_type === "bank" && source_id) await adjustBank(source_id, amount);
      if (source_type === "cash") await adjustCash(amount);
      if (destination_type === "bank" && destination_id) await adjustBank(destination_id, -amount);
      if (destination_type === "cash") await adjustCash(-amount);
    }

    if (type === "asset_purchase") {
      if (source_type === "bank" && source_id) await adjustBank(source_id, amount);
      if (source_type === "cash") await adjustCash(amount);
    }

    if (type === "asset_sale" && destination_type === "cash") await adjustCash(-amount);

    if (type === "liability_payment" && destination_id) {
      const liability = state.liabilities.find((l) => String(l.id) === String(destination_id));
      if (liability) await ErpRepository.update("erp_liabilities", destination_id, { paid_amount: MoneyUtils.sub(liability.paid_amount || 0, amount) });
      if (source_type === "bank" && source_id) await adjustBank(source_id, amount);
      if (source_type === "cash") await adjustCash(amount);
    }

    if (type === "receivable_collection" && source_id) {
      const receivable = state.receivables.find((r) => String(r.id) === String(source_id));
      if (receivable) await ErpRepository.update("erp_receivables", source_id, { collected_amount: MoneyUtils.sub(receivable.collected_amount || 0, amount) });
      if (destination_type === "bank" && destination_id) await adjustBank(destination_id, -amount);
      if (destination_type === "cash") await adjustCash(-amount);
    }
  }

  async function auditLog(tableName, recordId, action, oldValues, newValues, reason) {
    try {
      await ErpRepository.insert("erp_audit_log", {
        table_name: tableName,
        record_id: recordId,
        action,
        old_values: oldValues,
        new_values: newValues,
        reason: reason || null,
      });
    } catch (e) {
      console.warn("[Treasury] audit log failed:", e.message);
    }
  }

  function exportTreasuryCsv() {
    const rows = [["date", "type", "amount", "from", "to", "description", "reference", "status"]];
    filteredTreasuryTransactions().forEach((row) => rows.push([
      row.transaction_date,
      treasuryTypeLabel(row.type),
      row.amount,
      formatEntityName(row.source_type, row.source_id),
      formatEntityName(row.destination_type, row.destination_id),
      row.description,
      row.reference_number || "",
      row.cancelled ? "cancelled" : "active",
    ]));
    const csv = rows.map((row) => row.map((cell) => '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bariq-treasury-" + todayIso() + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function filteredTreasuryTransactions() {
    const q = state.treasurySearch.trim().toLowerCase();
    const has = (...values) => values.some((v) => String(v || "").toLowerCase().includes(q));
    return state.treasuryTransactions.filter((row) => {
      if (state.treasuryTypeFilter && row.type !== state.treasuryTypeFilter) return false;
      if (state.treasuryStatusFilter === "active" && row.cancelled) return false;
      if (state.treasuryStatusFilter === "cancelled" && !row.cancelled) return false;
      if (!q) return true;
      return has(row.description, row.reference_number, row.notes, row.type, treasuryTypeLabel(row.type));
    });
  }

  async function deleteStoredRow(table, id) {
    if (!table || !id) return;
    const allowed = new Set(["erp_bank_accounts", "erp_fixed_assets", "erp_liabilities", "erp_receivables"]);
    if (!allowed.has(table)) return toast("جدول غير مسموح بحذفه من الواجهة.");
    if (!confirm("حذف هذا السجل من قاعدة البيانات؟")) return;
    await ErpRepository.delete(table, id);
    toast("تم حذف السجل.");
    await loadData();
  }

  function setFormDates() {
    document.querySelectorAll('input[type="date"][data-today]').forEach((input) => {
      if (!input.value) input.value = todayIso();
    });
  }

  function hydrateUser() {
    try {
      const saved = JSON.parse(localStorage.getItem("bariq_admin_auth_v1") || "{}");
      if ($("erpUserName")) $("erpUserName").textContent = sessionStorage.getItem("admin_name") || saved.name || "Bariq Admin";
    } catch (_) {}
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

  function bindEvents() {
    ensureSidebarOverlay();
    if (window.innerWidth <= 900) setMobileMenuOpen(false);

    $("erpMenuBtn")?.addEventListener("click", () => {
      setMobileMenuOpen(!document.body.classList.contains("erp-nav-open"));
    });

    document.addEventListener("click", (event) => {
      if (!document.body.classList.contains("erp-nav-open")) return;
      if (event.target.closest(".erp-sidebar") && !event.target.closest("#erpMenuBtn")) {
        if (event.target.closest("a.erp-nav-item, button.erp-nav-item")) {
          setMobileMenuOpen(false);
        }
        return;
      }
      if (!event.target.closest("#erpMenuBtn")) {
        setMobileMenuOpen(false);
      }
    });

    document.querySelectorAll("[data-treasury-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const action = form.dataset.treasuryForm;
        const run = {
          "treasury-setup": () => saveTreasurySetup(form),
          "treasury-transaction": () => addTreasuryTransaction(form),
          "fixed-asset": () => addFixedAsset(form),
          "installment-payment": () => recordInstallmentPayment(form),
          liability: () => addLiability(form),
          receivable: () => addReceivable(form),
          "inventory-value": () => updateInventoryValue(form),
        }[action];
        if (run) run().catch((e) => toast(e.message));
      });
    });

    document.addEventListener("click", (event) => {
      const deleteRowBtn = event.target.closest("[data-delete-row-table][data-delete-row-id]");
      if (deleteRowBtn) {
        event.preventDefault();
        deleteStoredRow(deleteRowBtn.dataset.deleteRowTable, deleteRowBtn.dataset.deleteRowId).catch((e) => toast(e.message));
        return;
      }
      const cancelTreasuryBtn = event.target.closest("[data-cancel-treasury-id]");
      if (cancelTreasuryBtn) {
        event.preventDefault();
        cancelTreasuryTransaction(cancelTreasuryBtn.dataset.cancelTreasuryId).catch((e) => toast(e.message));
      }
    });

    $("erpTreasurySearch")?.addEventListener("input", (event) => {
      state.treasurySearch = event.target.value || "";
      renderTreasuryTransactions();
    });
    $("erpTreasuryTypeFilter")?.addEventListener("change", (event) => {
      state.treasuryTypeFilter = event.target.value || "";
      renderTreasuryTransactions();
    });
    $("erpTreasuryStatusFilter")?.addEventListener("change", (event) => {
      state.treasuryStatusFilter = event.target.value || "";
      renderTreasuryTransactions();
    });
    $("erpTreasuryTxType")?.addEventListener("change", () => {
      updateTreasuryTransactionForm();
      checkReserveWarning();
    });
    $("erpTreasurySourceType")?.addEventListener("change", () => {
      renderTreasuryEntityOptions($("erpTreasurySourceType").value, $("erpTreasurySourceId"));
      checkReserveWarning();
    });
    $("erpTreasuryDestType")?.addEventListener("change", () => {
      renderTreasuryEntityOptions($("erpTreasuryDestType").value, $("erpTreasuryDestId"));
      checkReserveWarning();
    });
    [$("erpTreasurySourceType"), $("erpTreasurySourceId"), $("erpTreasuryDestType"), $("erpTreasuryDestId"), $("erpTreasuryTxType")].forEach((el) => {
      el?.addEventListener("change", checkReserveWarning);
      el?.addEventListener("input", checkReserveWarning);
    });
    $("erpExportTreasuryCsv")?.addEventListener("click", exportTreasuryCsv);

    document.querySelectorAll(".erp-periods button").forEach((btn) => btn.addEventListener("click", () => setPeriod(btn.dataset.period)));
    $("erpCustomDay")?.addEventListener("change", (event) => {
      state.customDay = event.target.value || "";
      setPeriod("custom-day");
    });
    $("erpCustomMonth")?.addEventListener("change", (event) => {
      state.customMonth = event.target.value || "";
      setPeriod("custom-month");
    });
    $("erpCustomYear")?.addEventListener("input", (event) => {
      state.customYear = event.target.value || "";
      setPeriod("custom-year");
    });
  }

  function setPeriod(period) {
    state.period = period;
    document.querySelectorAll(".erp-periods button").forEach((btn) => btn.classList.toggle("active", btn.dataset.period === period));
    const dayInput = $("erpCustomDay");
    const monthInput = $("erpCustomMonth");
    const yearInput = $("erpCustomYear");
    if (dayInput) dayInput.hidden = period !== "custom-day";
    if (monthInput) monthInput.hidden = period !== "custom-month";
    if (yearInput) yearInput.hidden = period !== "custom-year";
    renderAll();
  }

  async function boot() {
    document.body.classList.add("erp-menu-ready");
    hydrateUser();
    bindEvents();
    setFormDates();
    renderAll();
    if (!window.sbFetch) {
      await new Promise((resolve) => {
        let tries = 0;
        const timer = setInterval(() => {
          tries += 1;
          if (window.sbFetch || tries > 50) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    }
    try {
      await loadData();
    } catch (e) {
      console.error("[Treasury] loadData failed:", e);
      toast("فشل تحميل البيانات: " + e.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
