(function () {
  "use strict";

  const state = {
    view: "dashboard",
    period: "month",
    customDay: "",
    customMonth: "",
    customYear: "",
    selectedEmployeeId: "",
    editingManualOrderId: "",
    editingTransactionId: "",
    editingMaterialId: "",
    editingPurchaseId: "",
    editingPurchaseItemId: "",
    editingSupplierId: "",
    editingEmployeeId: "",
    editingPayrollId: "",
    editingDocumentId: "",
    orderSearch: "",
    orderStatusFilter: "",
    orderSort: "number",
    orderDateFrom: "",
    orderDateTo: "",
    purchaseItems: [],
    erpUser: null,
    erpUsers: [],
    transactions: [],
    manualOrders: [],
    categories: [],
    suppliers: [],
    materials: [],
    stock: [],
    purchases: [],
    employees: [],
    employeeNotes: [],
    payroll: [],
    documents: [],
    alerts: [],
  };

  const titles = {
    dashboard: ["لوحة القيادة", "نظام إدارة داخلي يعتمد فقط على البيانات التي يتم إدخالها يدويًا."],
    orders: ["الطلبات", "إدخال ومتابعة الطلبات يدويًا داخل نظام الإدارة."],
    finance: ["المالية", "دفتر شبيه Excel للإيرادات والمصروفات والحسابات التلقائية."],
    expenses: ["المصروفات", "تسجيل مصروفات الشركة يدويًا مع التصنيفات والموردين والفواتير."],
    inventory: ["المخزون والخامات", "إدارة الخامات وحركات المخزون يدويًا داخل النظام."],
    purchases: ["المشتريات", "تسجيل مشتريات الموردين واستلامها داخل النظام."],
    suppliers: ["الموردين", "إدارة الموردين وأرصدة الشراء والدفع."],
    hr: ["الموظفين", "ملفات الموظفين الداخلية بدون أي سحب من لوحة الأدمن."],
    payroll: ["الرواتب", "مسيرات الرواتب والحسابات الشهرية من ملفات الموظفين."],
    documents: ["المستندات", "إدارة المستندات والتنبيهات قبل الانتهاء."],
    reports: ["التقارير", "تقارير مالية وتشغيلية مبنية على جداول النظام فقط."],
    settings: ["الصلاحيات", "صلاحيات نظام الإدارة وسجل التدقيق المقترح."],
  };

  const paymentMethods = ["نقدي", "تحويل بنكي", "بطاقة", "شيك", "أخرى"];
  const stockTypes = {
    purchase: "شراء",
    consumption: "استهلاك",
    waste: "تالف",
    addition: "إضافة",
    adjustment: "تصحيح",
    transfer: "تحويل",
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

  function money(value) {
    return "AED " + (Number(value) || 0).toLocaleString("en-AE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function num(value, decimals) {
    return (Number(value) || 0).toLocaleString("en-AE", {
      maximumFractionDigits: decimals == null ? 2 : decimals,
    });
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

  function periodTransactions() {
    return state.transactions.filter((row) => inPeriod(row.transaction_date || row.created_at));
  }

  function incomeRows() {
    return periodTransactions().filter((row) => row.type === "income");
  }

  function expenseRows() {
    return periodTransactions().filter((row) => row.type === "expense");
  }

  function periodManualOrders() {
    return state.manualOrders.filter((row) => row.status !== "cancelled" && inPeriod(row.created_at || row.updated_at));
  }

  function periodPurchases() {
    return state.purchases.filter((row) => row.status !== "cancelled" && inPeriod(row.purchase_date || row.created_at));
  }

  function periodPayroll() {
    return state.payroll.filter((row) => inPeriod(row.payroll_month || row.created_at));
  }

  function total(rows) {
    return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }

  function totalManualOrders(rows) {
    return rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  }

  function totalManualRemaining(rows) {
    return rows.reduce((sum, row) => {
      const remaining = row.remaining == null ? Number(row.total || 0) - Number(row.deposit || 0) : Number(row.remaining || 0);
      return sum + Math.max(0, remaining);
    }, 0);
  }

  function totals() {
    const manualIncome = totalManualOrders(periodManualOrders());
    const income = total(incomeRows()) + manualIncome;
    const manualExpenses = total(expenseRows());
    const purchaseCost = periodPurchases().reduce((sum, p) => sum + Number(p.total || 0), 0);
    const payrollCost = periodPayroll().reduce((sum, run) => sum + Number(run.total || run.net_total || 0), 0);
    const expenses = manualExpenses + purchaseCost + payrollCost;
    const stockValue = state.materials.reduce((sum, material) => sum + Number(material.current_stock || 0) * Number(material.average_cost || material.opening_cost || 0), 0);
    const supplierDue = state.purchases.reduce((sum, p) => sum + Math.max(0, Number(p.total || 0) - Number(p.paid || 0)), 0);
    const receivables = totalManualRemaining(state.manualOrders.filter((row) => !["delivered", "cancelled"].includes(row.status)));
    const debt = supplierDue;
    return {
      income,
      expenses,
      grossProfit: income - expenses,
      operatingExpenses: expenses,
      operatingProfit: income - expenses,
      netProfit: income - expenses,
      margin: income ? ((income - expenses) / income) * 100 : 0,
      manualIncome,
      manualExpenses,
      purchaseCost,
      payrollCost,
      stockValue,
      supplierDue,
      receivables,
      debt,
    };
  }

  async function erpFetch(path, opts) {
    if (!window.sbFetch) throw new Error("Supabase client is not ready");
    return window.sbFetch(path, Object.assign({ requireAuth: true }, opts || {}));
  }

  async function loadTable(path, fallback) {
    try {
      return await erpFetch(path);
    } catch (error) {
      console.warn("[ERP] load failed:", path, error.message);
      return fallback || [];
    }
  }

  async function loadData() {
    setSync("جاري التحميل");
    renderSkeletons();
    const [
      categories,
      manualOrders,
      suppliers,
      transactions,
      materials,
      purchases,
      purchaseItems,
      employees,
      employeeNotes,
      payroll,
      documents,
      alerts,
      erpUsers,
    ] = await Promise.all([
      loadTable("erp_expense_categories?active=eq.true&order=type.asc,sort_order.asc,name.asc"),
      loadTable("erp_manual_orders?order=created_at.desc&limit=200"),
      loadTable("erp_suppliers?order=created_at.desc&limit=200"),
      loadTable("erp_transactions?order=transaction_date.desc,created_at.desc&limit=500"),
      loadTable("erp_material_stock_summary?active=eq.true&order=name.asc"),
      loadTable("erp_purchases?order=purchase_date.desc,created_at.desc&limit=200"),
      loadTable("erp_purchase_items?limit=500"),
      loadTable("erp_employees?order=created_at.desc&limit=200"),
      loadTable("erp_employee_notes?order=event_date.desc,created_at.desc&limit=500"),
      loadTable("erp_payroll_summary?order=payroll_month.desc&limit=120"),
      loadTable("erp_documents?active=eq.true&order=expiry_date.asc&limit=200"),
      loadTable("erp_alerts?resolved=eq.false&order=created_at.desc&limit=100"),
      loadTable("erp_users?select=user_id,full_name,role,active,permissions,created_at&order=created_at.asc&limit=100"),
    ]);
    Object.assign(state, { categories, manualOrders, suppliers, transactions, materials, purchases, purchaseItems, employees, employeeNotes, payroll, documents, alerts, erpUsers });
    state.erpUser = erpUsers.find((u) => String(u.user_id) === String(currentUserId())) || state.erpUser || null;
    updateErpUserBadge(state.erpUser);
    setSync("متصل");
    renderAll();
    rebuildDynamicForms();
    applyPermissionUi();
  }

  function renderSkeletons() {
    if ($("erpKpis")) $("erpKpis").innerHTML = Array.from({ length: 6 }).map(() => '<div class="erp-skeleton"></div>').join("");
  }

  function renderKpis() {
    const target = $("erpKpis");
    if (!target) return;

    const allOrdersInPeriod = state.manualOrders.filter((row) => inPeriod(row.created_at || row.updated_at));
    const activeOrders = allOrdersInPeriod.filter((row) => row.status !== "cancelled");
    const deliveredOrders = allOrdersInPeriod.filter((row) => row.status === "delivered");
    const pendingOrders = allOrdersInPeriod.filter((row) => !["delivered", "cancelled"].includes(row.status));
    const orderReceivables = totalManualRemaining(pendingOrders);
    const purchases = state.purchases.filter((row) => inPeriod(row.purchase_date || row.created_at));
    const purchaseDue = purchases.reduce((sum, row) => sum + Math.max(0, Number(row.total || 0) - Number(row.paid || 0)), 0);
    const expenseData = expenseRows();
    const incomeData = incomeRows();
    const payrollData = periodPayroll();
    const lowStock = state.materials.filter((m) => Number(m.current_stock || 0) <= Number(m.minimum_stock || 0));
    const docsExpiring = state.documents.filter((d) => daysUntil(d.expiry_date) <= Number(d.alert_days || 30));
    const activeEmployees = state.employees.filter((e) => e.active !== false);
    const totalSalary = activeEmployees.reduce((sum, e) => sum + employeePayroll(e).net, 0);
    const t = totals();

    const byStatus = (status) => allOrdersInPeriod.filter((row) => row.status === status).length;
    const average = (rows, getter) => rows.length ? rows.reduce((sum, row) => sum + Number(getter(row) || 0), 0) / rows.length : 0;

    const dashboardKpis = [
      { label: "إجمالي الإيرادات", value: money(t.income), note: "قيود مالية + طلبات يدوية", icon: "💸", bg: "var(--erp-blue-soft)", change: (incomeData.length + activeOrders.length) + " مصدر" },
      { label: "إجمالي المصروفات", value: money(t.expenses), note: "مصروفات + مشتريات + رواتب", icon: "🧾", bg: "var(--erp-peach-soft)", change: (expenseData.length + periodPurchases().length + payrollData.length) + " قيد" },
      { label: "صافي الربح", value: money(t.netProfit), note: "هامش " + t.margin.toFixed(1) + "%", icon: "📈", bg: "var(--erp-mint-soft)", change: t.netProfit >= 0 ? "ربح" : "خسارة" },
      { label: "مديونية", value: money(t.debt), note: "مبالغ مستحقة للموردين", icon: "📌", bg: "var(--erp-peach-soft)", change: periodPurchases().length + " شراء" },
      { label: "مستحقات", value: money(t.receivables), note: "طلبات لم يتم تسليمها", icon: "🧾", bg: "var(--erp-blue-soft)", change: pendingOrders.length + " طلب" },
      { label: "تنبيهات", value: num(lowStock.length + docsExpiring.length, 0), note: "مخزون ومستندات", icon: "🔔", bg: "var(--erp-purple-soft)", change: lowStock.length + " مخزون" },
    ];

    const viewKpis = {
      dashboard: dashboardKpis,
      orders: [
        { label: "إجمالي الطلبات", value: num(allOrdersInPeriod.length, 0), note: "حسب الفترة المختارة", icon: "🧾", bg: "var(--erp-blue-soft)", change: activeOrders.length + " نشط" },
        { label: "قيد المعالجة", value: num(byStatus("processing"), 0), note: "طلبات جاري تنفيذها", icon: "⚙️", bg: "var(--erp-purple-soft)", change: byStatus("processing") + " طلب" },
        { label: "جاهز", value: num(byStatus("ready"), 0), note: "جاهز للتسليم", icon: "🎁", bg: "var(--erp-mint-soft)", change: byStatus("ready") + " طلب" },
        { label: "تم التسليم", value: num(deliveredOrders.length, 0), note: "طلبات مسددة بالكامل", icon: "✅", bg: "var(--erp-mint-soft)", change: deliveredOrders.length + " مسدد" },
        { label: "المستحق", value: money(orderReceivables), note: "على الطلبات غير المسلمة فقط", icon: "💳", bg: "var(--erp-peach-soft)", change: pendingOrders.length + " طلب" },
        { label: "إجمالي الطلبات", value: money(totalManualOrders(activeOrders)), note: "قيمة الطلبات غير الملغية", icon: "💰", bg: "var(--erp-blue-soft)", change: allOrdersInPeriod.length + " سجل" },
      ],
      finance: [
        { label: "إيرادات الفترة", value: money(total(incomeData)), note: "الإيرادات اليدوية", icon: "💸", bg: "var(--erp-blue-soft)", change: incomeData.length + " قيد" },
        { label: "عدد قيود الإيراد", value: num(incomeData.length, 0), note: "قيود محفوظة", icon: "🧾", bg: "var(--erp-mint-soft)", change: "إيرادات" },
        { label: "متوسط الإيراد", value: money(average(incomeData, r => r.amount)), note: "متوسط القيد", icon: "📊", bg: "var(--erp-peach-soft)", change: incomeData.length ? "محسوب" : "0" },
        { label: "مستحقات العملاء", value: money(orderReceivables), note: "طلبات غير مسلمة", icon: "💳", bg: "var(--erp-blue-soft)", change: pendingOrders.length + " طلب" },
        { label: "صافي الفترة", value: money(t.netProfit), note: "بعد المصروفات", icon: "📈", bg: "var(--erp-mint-soft)", change: t.netProfit >= 0 ? "ربح" : "خسارة" },
        { label: "إجمالي القيود", value: num(periodTransactions().length, 0), note: "إيراد ومصروف", icon: "📚", bg: "var(--erp-purple-soft)", change: periodTransactions().length + " قيد" },
      ],
      expenses: [
        { label: "مصروفات الفترة", value: money(total(expenseData)), note: "مصروفات مدخلة يدويًا", icon: "🧾", bg: "var(--erp-peach-soft)", change: expenseData.length + " قيد" },
        { label: "عدد المصروفات", value: num(expenseData.length, 0), note: "سجلات المصروفات", icon: "📄", bg: "var(--erp-blue-soft)", change: expenseData.length + " سجل" },
        { label: "متوسط المصروف", value: money(average(expenseData, r => r.amount)), note: "متوسط قيمة القيد", icon: "📊", bg: "var(--erp-mint-soft)", change: "متوسط" },
        { label: "مشتريات الفترة", value: money(periodPurchases().reduce((s,p)=>s+Number(p.total||0),0)), note: "أوامر الشراء", icon: "🛒", bg: "var(--erp-blue-soft)", change: periodPurchases().length + " أمر" },
        { label: "رواتب الفترة", value: money(payrollData.reduce((s,p)=>s+Number(p.total||p.net_total||0),0)), note: "مسيرات الرواتب", icon: "💰", bg: "var(--erp-purple-soft)", change: payrollData.length + " مسير" },
        { label: "إجمالي تشغيل", value: money(t.expenses), note: "مصروفات + مشتريات + رواتب", icon: "📌", bg: "var(--erp-peach-soft)", change: "تشغيل" },
      ],
      inventory: [
        { label: "عدد الخامات", value: num(state.materials.length, 0), note: "خامات مسجلة", icon: "📦", bg: "var(--erp-blue-soft)", change: state.materials.length + " خامة" },
        { label: "قيمة المخزون", value: money(t.stockValue), note: "المتوفر × متوسط التكلفة", icon: "💰", bg: "var(--erp-mint-soft)", change: "مخزون" },
        { label: "مخزون منخفض", value: num(lowStock.length, 0), note: "وصل لحد التنبيه", icon: "⚠️", bg: "var(--erp-peach-soft)", change: lowStock.length + " خامة" },
        { label: "مخزون سليم", value: num(Math.max(0,state.materials.length-lowStock.length), 0), note: "أعلى من الحد الأدنى", icon: "✅", bg: "var(--erp-mint-soft)", change: "سليم" },
        { label: "متوسط قيمة خامة", value: money(state.materials.length ? t.stockValue/state.materials.length : 0), note: "من القيمة الحالية", icon: "📊", bg: "var(--erp-blue-soft)", change: "متوسط" },
        { label: "تنبيهات المخزون", value: num(lowStock.length, 0), note: "تحتاج متابعة", icon: "🔔", bg: "var(--erp-purple-soft)", change: lowStock.length + " تنبيه" },
      ],
      purchases: [
        { label: "إجمالي المشتريات", value: money(purchases.reduce((s,p)=>s+Number(p.total||0),0)), note: "حسب الفترة", icon: "🛒", bg: "var(--erp-blue-soft)", change: purchases.length + " أمر" },
        { label: "المدفوع", value: money(purchases.reduce((s,p)=>s+Number(p.paid||0),0)), note: "مدفوع للموردين", icon: "💵", bg: "var(--erp-mint-soft)", change: "مدفوع" },
        { label: "المستحق", value: money(purchaseDue), note: "إجمالي - المدفوع", icon: "📌", bg: "var(--erp-peach-soft)", change: purchases.filter(p=>Number(p.total||0)>Number(p.paid||0)).length + " أمر" },
        { label: "أوامر مستلمة", value: num(purchases.filter(p=>p.status==="received").length,0), note: "تم الاستلام", icon: "✅", bg: "var(--erp-mint-soft)", change: "مستلم" },
        { label: "أوامر مفتوحة", value: num(purchases.filter(p=>!["received","cancelled"].includes(p.status)).length,0), note: "لم تستلم بعد", icon: "⏳", bg: "var(--erp-blue-soft)", change: "مفتوح" },
        { label: "متوسط الأمر", value: money(average(purchases, p=>p.total)), note: "متوسط قيمة الشراء", icon: "📊", bg: "var(--erp-purple-soft)", change: purchases.length + " أمر" },
      ],
      suppliers: [
        { label: "عدد الموردين", value: num(state.suppliers.length,0), note: "موردين مسجلين", icon: "🏢", bg: "var(--erp-blue-soft)", change: state.suppliers.length + " مورد" },
        { label: "إجمالي المشتريات", value: money(state.purchases.reduce((s,p)=>s+Number(p.total||0),0)), note: "من جميع الموردين", icon: "🛒", bg: "var(--erp-peach-soft)", change: state.purchases.length + " أمر" },
        { label: "مستحق للموردين", value: money(t.supplierDue), note: "إجمالي - المدفوع", icon: "📌", bg: "var(--erp-peach-soft)", change: "مستحق" },
        { label: "مدفوع للموردين", value: money(state.purchases.reduce((s,p)=>s+Number(p.paid||0),0)), note: "إجمالي المدفوع", icon: "💵", bg: "var(--erp-mint-soft)", change: "مدفوع" },
        { label: "متوسط المورد", value: money(state.suppliers.length ? state.purchases.reduce((s,p)=>s+Number(p.total||0),0)/state.suppliers.length : 0), note: "متوسط المشتريات", icon: "📊", bg: "var(--erp-blue-soft)", change: "متوسط" },
        { label: "موردين لهم مستحق", value: num(state.suppliers.filter(s=>state.purchases.some(p=>String(p.supplier_id)===String(s.id) && Number(p.total||0)>Number(p.paid||0))).length,0), note: "أرصدة مفتوحة", icon: "⚠️", bg: "var(--erp-purple-soft)", change: "متابعة" },
      ],
      hr: [
        { label: "الموظفون", value: num(state.employees.length,0), note: "إجمالي الملفات", icon: "👥", bg: "var(--erp-blue-soft)", change: activeEmployees.length + " نشط" },
        { label: "نشط", value: num(activeEmployees.length,0), note: "موظفين نشطين", icon: "✅", bg: "var(--erp-mint-soft)", change: "نشط" },
        { label: "متوقف", value: num(state.employees.length-activeEmployees.length,0), note: "غير نشط", icon: "⛔", bg: "var(--erp-peach-soft)", change: "متوقف" },
        { label: "صافي الرواتب", value: money(totalSalary), note: "رواتب + بدلات - خصومات", icon: "💰", bg: "var(--erp-blue-soft)", change: activeEmployees.length + " موظف" },
        { label: "متوسط الراتب", value: money(activeEmployees.length ? totalSalary/activeEmployees.length : 0), note: "للموظفين النشطين", icon: "📊", bg: "var(--erp-purple-soft)", change: "متوسط" },
        { label: "إقامات قريبة", value: num(state.employees.filter(e=>e.residence_expiry && daysUntil(e.residence_expiry)<=30).length,0), note: "خلال 30 يوم", icon: "🔔", bg: "var(--erp-peach-soft)", change: "تنبيه" },
      ],
      payroll: [
        { label: "مسيرات الرواتب", value: num(payrollData.length,0), note: "حسب الفترة", icon: "💰", bg: "var(--erp-blue-soft)", change: payrollData.length + " مسير" },
        { label: "تكلفة الرواتب", value: money(payrollData.reduce((s,p)=>s+Number(p.total||p.net_total||0),0)), note: "إجمالي المسيرات", icon: "🧾", bg: "var(--erp-peach-soft)", change: "تكلفة" },
        { label: "معتمد", value: num(payrollData.filter(p=>p.status==="approved").length,0), note: "مسيرات معتمدة", icon: "✅", bg: "var(--erp-mint-soft)", change: "معتمد" },
        { label: "مدفوع", value: num(payrollData.filter(p=>p.status==="paid").length,0), note: "مسيرات مدفوعة", icon: "💵", bg: "var(--erp-mint-soft)", change: "مدفوع" },
        { label: "مسودة", value: num(payrollData.filter(p=>p.status==="draft").length,0), note: "تحتاج مراجعة", icon: "📝", bg: "var(--erp-purple-soft)", change: "مسودة" },
        { label: "الموظفون", value: num(activeEmployees.length,0), note: "موظفون نشطون", icon: "👥", bg: "var(--erp-blue-soft)", change: activeEmployees.length + " موظف" },
      ],
      documents: [
        { label: "المستندات", value: num(state.documents.length,0), note: "مستندات نشطة", icon: "📁", bg: "var(--erp-blue-soft)", change: state.documents.length + " مستند" },
        { label: "قريبة الانتهاء", value: num(docsExpiring.length,0), note: "حسب فترة التنبيه", icon: "🔔", bg: "var(--erp-peach-soft)", change: docsExpiring.length + " تنبيه" },
        { label: "منتهية", value: num(state.documents.filter(d=>daysUntil(d.expiry_date)<0).length,0), note: "تاريخ الانتهاء مر", icon: "⛔", bg: "var(--erp-peach-soft)", change: "منتهي" },
        { label: "سليمة", value: num(state.documents.filter(d=>daysUntil(d.expiry_date)>Number(d.alert_days||30)).length,0), note: "خارج فترة التنبيه", icon: "✅", bg: "var(--erp-mint-soft)", change: "سليم" },
        { label: "تنبيه 30 يوم", value: num(state.documents.filter(d=>daysUntil(d.expiry_date)>=0 && daysUntil(d.expiry_date)<=30).length,0), note: "خلال شهر", icon: "⏳", bg: "var(--erp-purple-soft)", change: "30 يوم" },
        { label: "أقرب انتهاء", value: state.documents.length ? Math.min(...state.documents.map(d=>daysUntil(d.expiry_date)).filter(v=>Number.isFinite(v))) + " يوم" : "-", note: "أقرب مستند", icon: "📅", bg: "var(--erp-blue-soft)", change: "متابعة" },
      ],
      reports: dashboardKpis,
      settings: [
        { label: "حالة النظام", value: "متصل", note: "جلسة الإدارة", icon: "🟢", bg: "var(--erp-mint-soft)", change: "جاهز" },
        { label: "الموظفون", value: num(state.employees.length,0), note: "ملفات النظام", icon: "👥", bg: "var(--erp-blue-soft)", change: "بيانات" },
        { label: "الموردون", value: num(state.suppliers.length,0), note: "موردون مسجلون", icon: "🏢", bg: "var(--erp-blue-soft)", change: "بيانات" },
        { label: "المستندات", value: num(state.documents.length,0), note: "مستندات نشطة", icon: "📁", bg: "var(--erp-purple-soft)", change: "بيانات" },
        { label: "التنبيهات", value: num(currentAlerts().length,0), note: "تنبيهات النظام", icon: "🔔", bg: "var(--erp-peach-soft)", change: "متابعة" },
        { label: "الفترة", value: state.period, note: "الفترة الحالية", icon: "📅", bg: "var(--erp-mint-soft)", change: "فلتر" },
      ],
    };

    const kpis = viewKpis[state.view] || dashboardKpis;
    target.innerHTML = kpis.map((item) => `
      <article class="erp-kpi" style="background:${item.bg}">
        <span class="erp-kpi-icon">${item.icon}</span>
        <div>
          <div class="erp-kpi-label">${esc(item.label)}</div>
          <div class="erp-kpi-value">${esc(item.value)}</div>
          <div class="erp-kpi-foot"><span class="erp-kpi-change">${esc(item.change)}</span><span>${esc(item.note)}</span></div>
        </div>
      </article>`).join("");
  }

  function renderRevenueChart() {
    const rows = lastSevenDays().map((day) => {
      const dayRows = state.transactions.filter((row) => String(row.transaction_date || "").slice(0, 10) === day.key);
      const dayManualOrders = state.manualOrders.filter((row) => row.status !== "cancelled" && String(row.created_at || row.updated_at || "").slice(0, 10) === day.key);
      const dayPurchases = state.purchases.filter((row) => row.status !== "cancelled" && String(row.purchase_date || row.created_at || "").slice(0, 10) === day.key);
      const dayPayroll = state.payroll.filter((row) => String(row.payroll_month || row.created_at || "").slice(0, 10) === day.key);
      return {
        label: day.label,
        income: total(dayRows.filter((row) => row.type === "income")) + totalManualOrders(dayManualOrders),
        expense: total(dayRows.filter((row) => row.type === "expense")) +
          dayPurchases.reduce((sum, row) => sum + Number(row.total || 0), 0) +
          dayPayroll.reduce((sum, row) => sum + Number(row.total || row.net_total || 0), 0),
      };
    });
    const max = Math.max(1, ...rows.map((row) => Math.max(row.income, row.expense)));
    $("erpRevenueChart").innerHTML = rows.map((row) => `
      <div class="erp-chart-col">
        <div class="erp-chart-bars">
          <i class="erp-bar-sales" title="إيرادات ${money(row.income)}" style="height:${Math.max(4, Math.round((row.income / max) * 100))}%"></i>
          <i class="erp-bar-expense" title="مصروفات ${money(row.expense)}" style="height:${Math.max(4, Math.round((row.expense / max) * 100))}%"></i>
        </div>
        <small>${esc(row.label)}</small>
      </div>`).join("");
  }

  function lastSevenDays() {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("ar-AE", { weekday: "short" }) });
    }
    return days;
  }

  function expenseByCategory() {
    const map = {};
    expenseRows().forEach((row) => {
      const key = row.category || categoryName(row.category_id) || "مصروفات أخرى";
      map[key] = (map[key] || 0) + Number(row.amount || 0);
    });
    periodPurchases().forEach((row) => {
      map["مشتريات"] = (map["مشتريات"] || 0) + Number(row.total || 0);
    });
    periodPayroll().forEach((row) => {
      map["رواتب"] = (map["رواتب"] || 0) + Number(row.total || row.net_total || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  function renderExpenseDonut() {
    const entries = expenseByCategory();
    const sum = entries.reduce((acc, entry) => acc + entry[1], 0);
    const colors = ["#5b6ee1", "#74d4ae", "#ffb077", "#f58fb0", "#9f8cff"];
    let acc = 0;
    const slices = entries.map((entry, index) => {
      const start = sum ? (acc / sum) * 360 : 0;
      acc += entry[1];
      const end = sum ? (acc / sum) * 360 : 0;
      return `${colors[index % colors.length]} ${start}deg ${end}deg`;
    });
    const donut = $("erpExpenseDonut");
    donut.style.background = slices.length ? `conic-gradient(${slices.join(",")})` : "conic-gradient(#dbe3ef 0deg, #dbe3ef 360deg)";
    donut.querySelector("span").textContent = sum ? Math.round((entries[0][1] / sum) * 100) + "%" : "0%";
    $("erpExpenseLegend").innerHTML = entries.length ? entries.map((entry, index) => `
      <div class="erp-legend-item"><span><i class="erp-dot" style="background:${colors[index % colors.length]}"></i>${esc(entry[0])}</span><b>${money(entry[1])}</b></div>`).join("") : '<div class="erp-empty">لا توجد مصروفات مسجلة لهذه الفترة.</div>';
  }

  function renderInsights() {
    const t = totals();
    const low = state.materials.filter((m) => Number(m.current_stock || 0) <= Number(m.minimum_stock || 0));
    const duePurchases = state.purchases.filter((p) => Math.max(0, Number(p.total || 0) - Number(p.paid || 0)) > 0);
    const expiringDocs = state.documents.filter((d) => daysUntil(d.expiry_date) <= Number(d.alert_days || 30));
    const insights = [
      { title: t.netProfit >= 0 ? "صافي الربح موجب" : "صافي الربح منخفض", text: `الدخل ${money(t.income)} يشمل ${money(t.manualIncome)} من الطلبات اليدوية، والمصروفات ${money(t.expenses)}.` },
      { title: low.length ? "مخزون منخفض" : "المخزون مستقر", text: low.length ? `${low.length} خامة تحت حد التنبيه.` : "لا توجد خامات تحت الحد الأدنى." },
      { title: duePurchases.length ? "مستحقات موردين" : "لا توجد مستحقات بارزة", text: duePurchases.length ? `يوجد ${duePurchases.length} فاتورة شراء بها مبلغ مستحق.` : "أرصدة الموردين المسجلة مستقرة." },
      { title: expiringDocs.length ? "مستندات قاربت الانتهاء" : "المستندات آمنة", text: expiringDocs.length ? `${expiringDocs.length} مستند يحتاج متابعة.` : "لا توجد مستندات قريبة الانتهاء." },
    ];
    $("erpInsights").innerHTML = insights.map(renderInsight).join("");
    $("erpRuleInsights").innerHTML = insights.concat([
      { title: "قاعدة الفصل", text: "هذه التقارير لا تستخدم طلبات أو منتجات أو عملاء المتجر." },
      { title: "قاعدة الإدخال", text: "كل الأرقام تظهر من جداول النظام التي يتم إدخالها يدويًا." },
    ]).map(renderInsight).join("");
  }

  function renderInsight(item) {
    return `<div class="erp-insight"><strong>${esc(item.title)}</strong><small>${esc(item.text)}</small></div>`;
  }

  function renderRecentTransactions() {
    const rows = periodTransactions().slice(0, 10);
    $("erpRecentTransactions").innerHTML = rows.length ? rows.map((row) => `
      <div class="erp-list-item">
        <span><strong>${esc(row.description)}</strong><small>${esc(row.transaction_date)} - ${esc(row.type === "income" ? "إيراد" : "مصروف")} - ${esc(row.payment_method || "بدون طريقة دفع")}</small></span>
        <b class="erp-amount">${row.type === "expense" ? "-" : ""}${money(row.amount)}</b>
      </div>`).join("") : '<div class="erp-empty">لا توجد معاملات في النظام بعد. ابدأ بإضافة إيراد أو مصروف.</div>';
  }

  function orderStatusLabel(status) {
    return {
      new: "جديد",
      processing: "في التصنيع",
      ready: "جاهز",
      delivered: "تم التسليم",
      cancelled: "ملغي",
    }[status] || "جديد";
  }

  function orderSortValue(value) {
    const raw = String(value == null ? "" : value).replace(/[^0-9.-]/g, "");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
  }

  function renderManualOrders() {
    const target = $("erpManualOrdersRows");
    if (!target) return;
    const q = state.orderSearch.trim().toLowerCase();
    const rows = state.manualOrders.filter((order) => {
      const matchStatus = !state.orderStatusFilter || order.status === state.orderStatusFilter;
      const matchText = !q || [order.order_number, order.customer_name, order.customer_phone, order.customer_email, order.customer_address]
        .some((value) => String(value || "").toLowerCase().includes(q));
      const orderDate = String(order.created_at || order.updated_at || "").slice(0, 10);
      const matchFrom = !state.orderDateFrom || (orderDate && orderDate >= state.orderDateFrom);
      const matchTo = !state.orderDateTo || (orderDate && orderDate <= state.orderDateTo);
      return matchStatus && matchText && matchFrom && matchTo;
    }).sort((a, b) => {
      if (state.orderSort === "newest") {
        const ad = new Date(a.created_at || a.updated_at || 0).getTime() || 0;
        const bd = new Date(b.created_at || b.updated_at || 0).getTime() || 0;
        if (ad !== bd) return bd - ad;
      } else if (state.orderSort === "oldest") {
        const ad = new Date(a.created_at || a.updated_at || 0).getTime() || 0;
        const bd = new Date(b.created_at || b.updated_at || 0).getTime() || 0;
        if (ad !== bd) return ad - bd;
      } else if (state.orderSort === "number" || state.orderSort === "custom") {
        const av = orderSortValue(a.order_number);
        const bv = orderSortValue(b.order_number);
        if (av !== bv) return av - bv;
      }
      return String(a.order_number || "").localeCompare(String(b.order_number || ""), undefined, { numeric: true, sensitivity: "base" });
    });

    const statusOptions = (current) => [
      ["new", "جديد"], ["processing", "في التصنيع"], ["ready", "جاهز"], ["delivered", "تم التسليم"], ["cancelled", "ملغي"],
    ].map(([value, label]) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`).join("");

    target.innerHTML = rows.length ? rows.map((order) => {
      const deposit = Number(order.deposit || 0);
      const remaining = order.remaining == null ? Math.max(0, Number(order.total || 0) - deposit) : Number(order.remaining || 0);
      const settled = order.status === "delivered";
      const address = String(order.customer_address || "").trim();
      const customerText = [order.customer_name, address].filter(Boolean).join(" · ");
      return `
        <tr class="${settled ? "erp-order-settled" : ""}">
          <td><b>#${esc(order.order_number)}</b></td>
          <td title="${esc(customerText)}"><span class="erp-order-customer"><b>${esc(order.customer_name)}</b>${address ? `<small>· ${esc(address)}</small>` : ""}</span></td>
          <td>${esc(order.customer_phone || "")}</td>
          <td><select class="erp-status-select" data-order-status-id="${esc(order.id)}" aria-label="حالة الطلب">${statusOptions(order.status || "new")}</select></td>
          <td><b>${money(order.total)}</b></td>
          <td>${settled ? '<span class="erp-paid-mark">—</span>' : money(deposit)}</td>
          <td>${settled ? '<span class="erp-paid-mark">مسدد</span>' : `<b>${money(remaining)}</b>`}</td>
          <td><span class="erp-row-actions"><button class="erp-action-mini" type="button" data-edit-manual-order-id="${esc(order.id)}" title="تعديل" aria-label="تعديل">✏️</button><button class="erp-danger-mini" type="button" data-delete-row-table="erp_manual_orders" data-delete-row-id="${esc(order.id)}" title="حذف" aria-label="حذف">🗑️</button></span></td>
        </tr>`;
    }).join("") : '<tr><td colspan="8">لا توجد طلبات مطابقة.</td></tr>';
  }

  async function updateManualOrderStatus(orderId, status) {
    const order = state.manualOrders.find((row) => String(row.id) === String(orderId));
    if (!order) return;
    await erpFetch(`erp_manual_orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      prefer: "return=minimal",
    });
    order.status = status;
    toast(status === "delivered" ? "تم تسليم الطلب واعتباره مسددًا بالكامل." : "تم تحديث حالة الطلب.");
    await loadData();
  }

  function renderActivity() {
    const activity = [
      ["تم تحميل معاملات النظام", `${state.transactions.length} قيد يدوي`],
      ["تم تحميل الخامات", `${state.materials.length} خامة داخلية`],
      ["تم تحميل الموردين", `${state.suppliers.length} مورد`],
      ["تم تحميل الطلبات", `${state.manualOrders.length} طلب يدوي`],
      ["فصل بيانات المتجر", "لا يوجد اعتماد على طلبات أو منتجات أو عملاء المتجر"],
    ];
    $("erpActivity").innerHTML = activity.map((row) => `<div class="erp-timeline-item"><span><strong>${esc(row[0])}</strong><small>${esc(row[1])}</small></span><span class="erp-status">النظام</span></div>`).join("");
    $("erpAuditLog").innerHTML = activity.map((row) => `<div class="erp-timeline-item"><span><strong>${esc(row[0])}</strong><small>${esc(row[1])}</small></span><span class="erp-status">سجل</span></div>`).join("");
    $("erpHrActivity").innerHTML = [
      ["ملفات الموظفين", `${state.employees.length} موظف داخل النظام`],
      ["الحضور", "يدوي أو Import Excel لاحقًا فقط"],
    ].map((row) => `<div class="erp-timeline-item"><span><strong>${esc(row[0])}</strong><small>${esc(row[1])}</small></span></div>`).join("");
  }

  function renderLedger() {
    const rows = periodTransactions();
    $("erpLedgerRows").innerHTML = rows.length ? rows.map((row) => `
      <tr>
        <td>${esc(row.transaction_date)}</td>
        <td contenteditable data-table="erp_transactions" data-id="${esc(row.id)}" data-field="description">${esc(row.description)}</td>
        <td>${esc(row.type === "income" ? "إيراد" : "مصروف")}</td>
        <td contenteditable data-table="erp_transactions" data-id="${esc(row.id)}" data-field="amount">${money(row.amount)}</td>
        <td>${esc(row.external_reference || row.invoice_number || "النظام")}</td>
        <td><span class="erp-row-actions"><button class="erp-action-mini" type="button" data-edit-transaction-id="${esc(row.id)}" title="تعديل" aria-label="تعديل">✏️</button><button class="erp-danger-mini" type="button" data-delete-row-table="erp_transactions" data-delete-row-id="${esc(row.id)}" title="حذف" aria-label="حذف">🗑️</button></span></td>
      </tr>`).join("") : '<tr><td colspan="6">لا توجد قيود مالية بعد.</td></tr>';
  }

  function renderProfitEngine() {
    const t = totals();
    $("erpProfitEngine").innerHTML = [
      ["إجمالي الإيرادات", money(t.income), "مجموع كل الإيرادات اليدوية"],
      ["إجمالي المصروفات", money(t.expenses), "المصروفات اليدوية + أوامر الشراء + الرواتب"],
      ["تكلفة المشتريات", money(t.purchaseCost), "إجمالي أوامر الشراء غير الملغية"],
      ["إجمالي الربح", money(t.grossProfit), "الإيرادات ناقص المصروفات"],
      ["مصروفات التشغيل", money(t.operatingExpenses), "مصروفات التشغيل"],
      ["الربح التشغيلي", money(t.operatingProfit), "نتيجة التشغيل"],
      ["صافي الربح", money(t.netProfit), "النتيجة النهائية"],
      ["هامش الربح", t.margin.toFixed(1) + "%", "صافي الربح من إجمالي الإيرادات"],
    ].map((row) => `<div class="erp-metric"><strong>${esc(row[0])}</strong><small>${esc(row[2])}</small><b class="erp-amount">${esc(row[1])}</b></div>`).join("");
  }

  function renderExpenses() {
    $("erpExpensesList").innerHTML = expenseRows().length ? expenseRows().map((row) => `
      <div class="erp-list-item"><span><strong>${esc(row.description)}</strong><small>${esc(row.category || categoryName(row.category_id))} - ${esc(row.supplier_id ? supplierName(row.supplier_id) : "بدون مورد")} · 📅 ${esc(String(row.transaction_date || row.created_at || "").slice(0,10) || "-")}</small></span><span class="erp-row-actions"><b class="erp-amount">${money(row.amount)}</b><button class="erp-action-mini" type="button" data-edit-transaction-id="${esc(row.id)}" title="تعديل" aria-label="تعديل">✏️</button><button class="erp-danger-mini" type="button" data-delete-row-table="erp_transactions" data-delete-row-id="${esc(row.id)}" title="حذف" aria-label="حذف">🗑️</button></span></div>`).join("") : '<div class="erp-empty">لا توجد مصروفات. أضف مصروفًا يدويًا من النموذج.</div>';
  }

  function renderInventory() {
    $("erpMaterialsRows").innerHTML = state.materials.length ? state.materials.map((m) => {
      const current = Number(m.current_stock || 0);
      const min = Number(m.minimum_stock || 0);
      const low = current <= min;
      return `<tr><td>${esc(m.name)}</td><td>${esc(m.unit)}</td><td>${num(current, 3)}</td><td>${num(min, 3)}</td><td><span class="erp-status" style="background:${low ? "var(--erp-peach-soft)" : "var(--erp-mint-soft)"}">${low ? "مخزون منخفض" : "جيد"}</span></td><td><span class="erp-row-actions"><button class="erp-action-mini" type="button" data-edit-material-id="${esc(m.id)}" title="تعديل" aria-label="تعديل">✏️</button><button class="erp-danger-mini" type="button" data-delete-row-table="erp_materials" data-delete-row-id="${esc(m.id)}" title="حذف" aria-label="حذف">🗑️</button></span></td></tr>`;
    }).join("") : '<tr><td colspan="6">لا توجد خامات. أضف خامة داخل النظام.</td></tr>';
    const low = state.materials.filter((m) => Number(m.current_stock || 0) <= Number(m.minimum_stock || 0));
    $("erpLowStock").innerHTML = low.length ? low.map((m) => `<div class="erp-list-item"><span><strong>${esc(m.name)}</strong><small>المتوفر ${num(m.current_stock, 3)} ${esc(m.unit)}</small></span><span class="erp-status">تنبيه</span></div>`).join("") : '<div class="erp-empty">لا توجد خامات تحت الحد الأدنى.</div>';
  }

  function renderPurchases() {
    const materialById = new Map(state.materials.map((m) => [String(m.id), m]));
    const itemsByPurchase = new Map();
    state.purchaseItems.forEach((item) => {
      const key = String(item.purchase_id || "");
      if (!itemsByPurchase.has(key)) itemsByPurchase.set(key, []);
      itemsByPurchase.get(key).push(item);
    });
    const rows = state.purchases.slice().sort((a,b) => new Date(b.purchase_date || b.created_at || 0) - new Date(a.purchase_date || a.created_at || 0));
    $("erpPurchases").innerHTML = rows.length ? rows.map((p) => {
      const due = Math.max(0, Number(p.total || 0) - Number(p.paid || 0));
      const items = itemsByPurchase.get(String(p.id)) || [];
      const item = items[0] || null;
      const material = item ? materialById.get(String(item.material_id)) : null;
      const date = String(p.purchase_date || p.created_at || "").slice(0,10);
      const quantity = item ? num(item.quantity || 0, 3) : "-";
      const unitCost = item ? money(item.unit_cost || 0) : "-";
      const materialName = material?.name || "بدون خامة";
      return `<div class="erp-list-item erp-purchase-row">
        <span class="erp-purchase-info">
          <strong>${esc(p.invoice_number || "فاتورة شراء")}</strong>
          <small>${esc(supplierName(p.supplier_id))} · 📅 ${esc(date || "-")}</small>
          <small>الخامة: ${esc(materialName)} · الكمية: ${esc(quantity)} · سعر الوحدة: ${esc(unitCost)}</small>
        </span>
        <span class="erp-row-actions"><b class="erp-amount">${due > 0 ? money(due) + " مستحق" : "مسدد"}</b><button class="erp-action-mini" type="button" data-edit-purchase-id="${esc(p.id)}" title="تعديل" aria-label="تعديل">✏️</button><button class="erp-danger-mini" type="button" data-delete-row-table="erp_purchases" data-delete-row-id="${esc(p.id)}" title="حذف" aria-label="حذف">🗑️</button></span>
      </div>`;
    }).join("") : '<div class="erp-empty">لا توجد مشتريات مسجلة.</div>';
    const low = state.materials.filter((m) => Number(m.current_stock || 0) <= Number(m.minimum_stock || 0));
    $("erpPurchaseInsights").innerHTML = low.length ? low.map((m) => renderInsight({ title: "احتياج شراء: " + m.name, text: `المتوفر ${num(m.current_stock, 3)} والحد الأدنى ${num(m.minimum_stock, 3)}.` })).join("") : renderInsight({ title: "لا توجد احتياجات شراء عاجلة", text: "المواد المسجلة أعلى من الحد الأدنى." });
  }

  function renderSuppliers() {
    $("erpSuppliersRows").innerHTML = state.suppliers.length ? state.suppliers.map((s) => {
      const supplierPurchases = state.purchases.filter((p) => p.supplier_id === s.id);
      const due = supplierPurchases.reduce((sum, p) => sum + Math.max(0, Number(p.total || 0) - Number(p.paid || 0)), 0);
      return `<tr><td>${esc(s.name)}</td><td>${esc(s.category || "عام")}</td><td>${esc(s.phone || "")}</td><td title="${esc(s.address || "")}">${esc(s.address || "-")}</td><td><span class="erp-status">${money(due)} مستحق</span></td><td><span class="erp-row-actions"><button class="erp-action-mini" type="button" data-edit-supplier-id="${esc(s.id)}" title="تعديل" aria-label="تعديل">✏️</button><button class="erp-danger-mini" type="button" data-delete-row-table="erp_suppliers" data-delete-row-id="${esc(s.id)}" title="حذف" aria-label="حذف">🗑️</button></span></td></tr>`;
    }).join("") : '<tr><td colspan="6">لا يوجد موردين.</td></tr>';
  }

  function renderHr() {
    $("erpEmployeesRows").innerHTML = state.employees.length ? state.employees.map((e) => `<tr class="${String(e.id) === String(state.selectedEmployeeId) ? "erp-row-active" : ""}"><td><button class="erp-link-btn" type="button" data-employee-id="${esc(e.id)}">${esc(e.full_name)}</button></td><td>${esc(e.department || "")}</td><td>${esc(e.job_title || "")}</td><td>${esc(String(e.hire_date || "").slice(0,10) || "-")}</td><td><span class="erp-status">${e.active ? "نشط" : "متوقف"}</span></td><td><span class="erp-row-actions"><button class="erp-action-mini" type="button" data-edit-employee-id="${esc(e.id)}" title="تعديل" aria-label="تعديل">✏️</button><button class="erp-danger-mini" type="button" data-delete-employee-id="${esc(e.id)}" title="حذف" aria-label="حذف">🗑️</button></span></td></tr>`).join("") : '<tr><td colspan="6">لا يوجد موظفين.</td></tr>';
    if (!state.selectedEmployeeId && state.employees[0]) state.selectedEmployeeId = state.employees[0].id;
    renderEmployeeProfile();
  }

  function selectedEmployee() {
    return state.employees.find((e) => String(e.id) === String(state.selectedEmployeeId)) || null;
  }

  function employeePayroll(employee) {
    const salary = Number(employee?.salary || 0);
    const allowances = Number(employee?.allowances || 0);
    const overtime = Number(employee?.overtime_hours || 0) * Number(employee?.overtime_rate || 0);
    const deductions = Number(employee?.deductions || 0);
    const latePenalty = Number(employee?.late_penalty || 0);
    return { salary, allowances, overtime, deductions, latePenalty, net: salary + allowances + overtime - deductions - latePenalty };
  }

  function renderEmployeeProfile() {
    const target = $("erpEmployeeProfile");
    if (!target) return;
    const employee = selectedEmployee();
    if (!employee) {
      target.className = "erp-employee-profile-empty";
      target.innerHTML = "اختار موظف من القائمة لعرض ملفه.";
      return;
    }
    const pay = employeePayroll(employee);
    const notes = state.employeeNotes.filter((note) => String(note.employee_id) === String(employee.id)).slice(0, 12);
    const score = Math.max(0, Math.min(100, Number(employee.performance_percent || 0)));
    const remainingLeave = Number(employee.annual_leave_days || 0) - Number(employee.used_leave_days || 0);
    target.className = "erp-employee-profile";
    target.innerHTML = `
      <aside class="erp-employee-side">
        <img class="erp-employee-photo" src="${esc(employee.photo_url || "/assets/icon.png")}" alt="">
        <h3>${esc(employee.full_name)}</h3>
        <p>${esc([employee.job_title, employee.department].filter(Boolean).join(" - "))}</p>
        <div class="erp-employee-score">
          <strong>نسبة التفوق ${num(score, 0)}%</strong>
          <div class="erp-progress"><i style="width:${score}%"></i></div>
          <small>التقييم: ${num(employee.rating || 0, 1)} من 5</small>
        </div>
        <div class="erp-employee-metrics">
          <div class="erp-employee-metric"><small>صافي الراتب</small><b>${money(pay.net)}</b></div>
          <div class="erp-employee-metric"><small>الإجازة المتبقية</small><b>${num(remainingLeave, 1)} يوم</b></div>
          <div class="erp-employee-metric"><small>الأوفر تايم</small><b>${money(pay.overtime)}</b></div>
          <div class="erp-employee-metric"><small>التأخير</small><b>${num(employee.late_minutes || 0, 0)} دقيقة</b></div>
        </div>
        ${employee.residence_attachment_url ? `<a class="erp-secondary" href="${esc(employee.residence_attachment_url)}" target="_blank" rel="noopener" style="width:100%;margin-top:12px">فتح صورة الإقامة</a>` : ""}
      </aside>
      <section class="erp-employee-panel">
        <form class="erp-form" data-erp-form="employee-profile" data-employee-id="${esc(employee.id)}">
          <label class="erp-file-label">صورة الموظف<input name="photo_file" type="file" accept="image/*"></label>
          <label class="erp-file-label">صورة الإقامة<input name="residence_file" type="file" accept="image/*,application/pdf"></label>
          <label>انتهاء الإقامة<input name="residence_expiry" type="date" value="${esc(employee.residence_expiry || "")}"></label>
          <label>ملاحظات تجديد الإقامة<input name="residence_renewal_notes" value="${esc(employee.residence_renewal_notes || "")}"></label>
          <label>الراتب<input name="salary" type="number" step="0.01" value="${esc(employee.salary || 0)}"></label>
          <label>البدلات<input name="allowances" type="number" step="0.01" value="${esc(employee.allowances || 0)}"></label>
          <label>الخصومات<input name="deductions" type="number" step="0.01" value="${esc(employee.deductions || 0)}"></label>
          <label>ساعات الأوفر تايم<input name="overtime_hours" type="number" step="0.01" value="${esc(employee.overtime_hours || 0)}"></label>
          <label>قيمة ساعة الأوفر تايم<input name="overtime_rate" type="number" step="0.01" value="${esc(employee.overtime_rate || 0)}"></label>
          <label>دقائق التأخير<input name="late_minutes" type="number" step="1" value="${esc(employee.late_minutes || 0)}"></label>
          <label>خصم التأخير<input name="late_penalty" type="number" step="0.01" value="${esc(employee.late_penalty || 0)}"></label>
          <label>رصيد الإجازة<input name="annual_leave_days" type="number" step="0.5" value="${esc(employee.annual_leave_days || 0)}"></label>
          <label>الإجازة المستخدمة<input name="used_leave_days" type="number" step="0.5" value="${esc(employee.used_leave_days || 0)}"></label>
          <label>نسبة التفوق<input name="performance_percent" type="number" min="0" max="100" step="1" value="${esc(employee.performance_percent || 0)}"></label>
          <label>تقييم الموظف<input name="rating" type="number" min="0" max="5" step="0.1" value="${esc(employee.rating || 0)}"></label>
          <label style="grid-column:1/-1">المميزات<textarea name="strengths" rows="3">${esc(employee.strengths || "")}</textarea></label>
          <label style="grid-column:1/-1">الأخطاء<textarea name="mistakes" rows="3">${esc(employee.mistakes || "")}</textarea></label>
          <label style="grid-column:1/-1">ملاحظات التقييم<textarea name="evaluation_notes" rows="3">${esc(employee.evaluation_notes || employee.notes || "")}</textarea></label>
          <button class="erp-primary" type="submit">حفظ ملف الموظف</button>
        </form>
        <form class="erp-form" data-erp-form="employee-note" data-employee-id="${esc(employee.id)}" style="margin-top:16px">
          <label>نوع الملاحظة<select name="note_type"><option value="note">ملاحظة</option><option value="strength">ميزة</option><option value="mistake">خطأ</option><option value="warning">تنبيه</option><option value="reward">مكافأة</option><option value="leave">إجازة</option><option value="late">تأخير</option><option value="overtime">أوفر تايم</option></select></label>
          <label>التاريخ<input name="event_date" type="date" value="${todayIso()}"></label>
          <label>القيمة<input name="value" type="number" step="0.01" placeholder="اختياري"></label>
          <label>العنوان<input name="title" required placeholder="مثال: تأخير، إنجاز، خطأ تصنيع"></label>
          <label style="grid-column:1/-1">التفاصيل<input name="body" placeholder="تفاصيل الملاحظة"></label>
          <button class="erp-secondary" type="submit">إضافة للسجل</button>
        </form>
        <div class="erp-employee-notes">
          ${notes.length ? notes.map((note) => `<div class="erp-employee-note"><strong>${esc(note.title)}</strong><small>${esc(note.event_date || "")} - ${esc(note.note_type || "note")} ${note.value != null ? " - " + money(note.value) : ""}</small><p>${esc(note.body || "")}</p></div>`).join("") : '<div class="erp-empty">لا توجد ملاحظات في سجل الموظف.</div>'}
        </div>
      </section>`;
  }

  function renderPayroll() {
    $("erpPayrollRows").innerHTML = state.payroll.length ? state.payroll.map((p) => `<tr><td>${esc(String(p.payroll_month || "").slice(0, 7))}</td><td>${num(p.employee_count || 0, 0)}</td><td>${money(p.total || 0)}</td><td><span class="erp-status">${esc(p.status)}</span></td><td><span class="erp-row-actions"><button class="erp-action-mini" type="button" data-edit-payroll-id="${esc(p.id)}" title="تعديل" aria-label="تعديل">✏️</button><button class="erp-danger-mini" type="button" data-delete-row-table="erp_payroll" data-delete-row-id="${esc(p.id)}" title="حذف" aria-label="حذف">🗑️</button></span></td></tr>`).join("") : '<tr><td colspan="5">لا توجد مسيرات رواتب.</td></tr>';
    const t = totals();
    $("erpPayrollSummary").innerHTML = [
      ["تكلفة الرواتب", money(t.payrollCost), "من مسيرات الرواتب"],
      ["الموظفون", num(state.employees.length, 0), "موظفين مسجلين"],
      ["متوسط الراتب", money(state.employees.length ? state.employees.reduce((s, e) => s + Number(e.salary || 0), 0) / state.employees.length : 0), "من ملفات الموظفين"],
    ].map((row) => `<div class="erp-metric"><strong>${esc(row[0])}</strong><small>${esc(row[2])}</small><b class="erp-amount">${esc(row[1])}</b></div>`).join("");
  }

  function renderDocuments() {
    $("erpDocumentsRows").innerHTML = state.documents.length ? state.documents.map((d) => `<tr><td>${esc(d.document_type)}</td><td>${esc(d.owner_name || employeeName(d.employee_id) || "")}</td><td>${esc(d.expiry_date || "")}</td><td><span class="erp-status">قبل ${esc(d.alert_days || 30)} يوم</span></td><td><span class="erp-row-actions"><button class="erp-action-mini" type="button" data-edit-document-id="${esc(d.id)}" title="تعديل" aria-label="تعديل">✏️</button><button class="erp-danger-mini" type="button" data-delete-row-table="erp_documents" data-delete-row-id="${esc(d.id)}" title="حذف" aria-label="حذف">🗑️</button></span></td></tr>`).join("") : '<tr><td colspan="5">لا توجد مستندات.</td></tr>';
    const expiring = state.documents.filter((d) => daysUntil(d.expiry_date) <= Number(d.alert_days || 30));
    $("erpDocumentAlerts").innerHTML = expiring.length ? expiring.map((d) => `<div class="erp-list-item"><span><strong>${esc(d.document_type)}</strong><small>ينتهي في ${esc(d.expiry_date)}</small></span><span class="erp-status">${daysUntil(d.expiry_date)} يوم</span></div>`).join("") : '<div class="erp-empty">لا توجد مستندات قريبة الانتهاء.</div>';
  }

  function renderReports() {
    const t = totals();
    $("erpReportRows").innerHTML = [
      ["إجمالي الإيرادات", money(t.income), "قيود الإيراد + الطلبات اليدوية غير الملغية"],
      ["إيرادات الطلبات اليدوية", money(t.manualIncome), "إجمالي الطلبات اليدوية غير الملغية"],
      ["إجمالي المصروفات", money(t.expenses), "كل المصروفات اليدوية + أوامر الشراء + الرواتب"],
      ["تكلفة المشتريات", money(t.purchaseCost), "أوامر الشراء غير الملغية"],
      ["صافي الربح", money(t.netProfit), "الإيرادات ناقص المصروفات"],
      ["قيمة مخزون الخامات", money(t.stockValue), "المتوفر مضروبًا في متوسط التكلفة"],
      ["تكلفة الرواتب", money(t.payrollCost), "من مسيرات الرواتب"],
      ["مستحقات الموردين", money(t.supplierDue), "إجمالي المشتريات ناقص المدفوع"],
      ["مستندات قاربت الانتهاء", num(state.documents.filter((d) => daysUntil(d.expiry_date) <= Number(d.alert_days || 30)).length, 0), "حسب أيام التنبيه"],
      ["مخزون منخفض", num(state.materials.filter((m) => Number(m.current_stock || 0) <= Number(m.minimum_stock || 0)).length, 0), "المتوفر أقل من حد التنبيه"],
    ].map((row) => `<tr><td>${esc(row[0])}</td><td><b>${esc(row[1])}</b></td><td>${esc(row[2])}</td></tr>`).join("");
  }

  function currentUserId() {
    try { const token = sessionStorage.getItem("admin_token") || JSON.parse(localStorage.getItem("bariq_admin_auth_v1") || "{}").access || ""; const part=token.split(".")[1]; if(!part) return ""; return JSON.parse(atob(part.replace(/-/g,"+").replace(/_/g,"/"))).sub || ""; } catch (_) { return ""; }
  }

  const permissionSections = [
    ["orders","الطلبات"],["finance","المالية والمصروفات"],["inventory","المخزون"],["purchases","المشتريات"],
    ["suppliers","الموردين"],["hr","الموظفين"],["payroll","الرواتب"],["documents","المستندات"],["reports","التقارير"]
  ];
  const permissionActions = [["read","عرض"],["create","إضافة"],["edit","تعديل"],["delete","حذف"]];
  function isOwner(){ return ["owner","admin"].includes(String(state.erpUser?.role||"").toLowerCase()); }
  function permissionSummary(u){
    if(["owner","admin"].includes(String(u.role||"").toLowerCase())) return "كل الصلاحيات";
    const p=u.permissions||{}; const enabled=permissionSections.filter(([k])=>p[k]?.read).map(([,n])=>n); return enabled.length?enabled.join("، "):"بدون صلاحيات";
  }
  function renderSettings() {
    const rows=$("erpRolesRows"); if(!rows) return;
    rows.innerHTML = state.erpUsers.length ? state.erpUsers.map((u)=>`<tr><td><b>${esc(u.full_name||"مستخدم")}</b><small class="erp-user-role">${esc(u.role||"")}</small></td><td>${esc(permissionSummary(u))}</td><td><span class="erp-status">${u.active?"نشط":"موقوف"}</span></td><td>${["owner","admin"].includes(String(u.role||"").toLowerCase())?'<span class="erp-owner-lock">🔒 المالك</span>':`<span class="erp-row-actions"><button class="erp-action-mini" type="button" data-edit-erp-user="${esc(u.user_id)}">✏️</button><button class="erp-secondary erp-user-toggle" type="button" data-toggle-erp-user="${esc(u.user_id)}">${u.active?"إيقاف":"تفعيل"}</button></span>`}</td></tr>`).join("") : '<tr><td colspan="4">لا توجد حسابات.</td></tr>';
    const panel=$("erpUserAdminPanel"); if(panel) panel.hidden=!isOwner();
    const perms=$("erpPermissionsGrid"); if(perms && !perms.dataset.ready){ perms.innerHTML=permissionSections.map(([key,name])=>`<fieldset class="erp-permission-group"><legend>${esc(name)}</legend>${permissionActions.map(([a,label])=>`<label><input type="checkbox" name="perm_${key}_${a}" checked> ${label}</label>`).join("")}</fieldset>`).join(""); perms.dataset.ready="1"; }
  }
  function collectPermissions(form){ const out={}; permissionSections.forEach(([key])=>{out[key]={};permissionActions.forEach(([a])=>out[key][a]=!!form.elements[`perm_${key}_${a}`]?.checked)});return out; }
  function fillPermissions(form,u){ const p=u?.permissions||{}; permissionSections.forEach(([key])=>permissionActions.forEach(([a])=>{const el=form.elements[`perm_${key}_${a}`];if(el)el.checked=u?!!p[key]?.[a]:true;})); }
  async function callUserAdmin(payload){
    const token=sessionStorage.getItem("admin_token")||JSON.parse(localStorage.getItem("bariq_admin_auth_v1")||"{}").access||"";
    const res=await fetch("https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/erp-user-admin",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||"تعذر إدارة الحساب"); return data;
  }
  async function saveErpUser(form){
    const editing=form.dataset.userId||""; const payload={action:editing?"update":"create",user_id:editing||undefined,full_name:form.elements.full_name.value.trim(),email:form.elements.email.value.trim(),password:form.elements.password.value,permissions:collectPermissions(form)};
    if(editing&&!payload.password) delete payload.password; await callUserAdmin(payload); toast(editing?"تم تحديث الحساب والصلاحيات.":"تم إنشاء الحساب والصلاحيات."); form.reset(); form.dataset.userId=""; $("erpUserFormTitle").textContent="إنشاء حساب جديد"; $("erpUserEmail").disabled=false; fillPermissions(form,null); await loadData();
  }
  function editErpUser(id){ const u=state.erpUsers.find(x=>String(x.user_id)===String(id)); const form=$("erpUserForm"); if(!u||!form)return; form.dataset.userId=u.user_id; form.elements.full_name.value=u.full_name||""; form.elements.email.value=""; form.elements.email.placeholder="الإيميل لا يتغير من هنا"; form.elements.email.disabled=true; form.elements.password.value=""; $("erpUserFormTitle").textContent="تعديل صلاحيات "+(u.full_name||""); fillPermissions(form,u); form.scrollIntoView({behavior:"smooth",block:"start"}); }
  async function toggleErpUser(id){ const u=state.erpUsers.find(x=>String(x.user_id)===String(id)); if(!u)return; await callUserAdmin({action:"update",user_id:id,active:!u.active,permissions:u.permissions||{}}); toast(!u.active?"تم تفعيل الحساب.":"تم إيقاف الحساب."); await loadData(); }
  async function logoutErp(){ try{await window.Supabase?.Auth?.signOut?.()}catch(_){} sessionStorage.removeItem("admin_ok");sessionStorage.removeItem("admin_token");sessionStorage.removeItem("admin_refresh_token");sessionStorage.removeItem("admin_token_exp");localStorage.removeItem("bariq_admin_auth_v1");location.replace("/erp-login.html"); }


  function renderTopProducts() {
    const target = $("topProducts");
    if (target) {
      target.innerHTML = '<div class="erp-empty">تم فصل نظام الإدارة عن منتجات المتجر. استخدم تقارير المخزون والخامات بدل منتجات الموقع.</div>';
    }
  }

  function renderStatusBreakdown() {
    const target = $("statusBreakdown");
    if (target) {
      target.innerHTML = '<div class="erp-empty">تم فصل نظام الإدارة عن طلبات المتجر. حالات التنفيذ هنا ستكون من المشتريات والرواتب والمستندات فقط.</div>';
    }
  }


  const viewPermissionSection = { orders:"orders", finance:"finance", expenses:"finance", inventory:"inventory", purchases:"purchases", suppliers:"suppliers", hr:"hr", payroll:"payroll", documents:"documents", reports:"reports" };
  function canPermission(section, action="read") {
    if (!state.erpUser) return false;
    if (["owner","admin"].includes(String(state.erpUser.role||"").toLowerCase())) return true;
    return !!state.erpUser.permissions?.[section]?.[action];
  }
  function applyPermissionUi(){
    document.querySelectorAll(".erp-nav-item[data-view]").forEach((btn)=>{ const v=btn.dataset.view; if(v==="dashboard") return btn.hidden=false; if(v==="settings") return btn.hidden=!isOwner(); const sec=viewPermissionSection[v]; btn.hidden=sec?!canPermission(sec,"read"):false; });
    const formMap={"manual-order":"orders",income:"finance",expense:"finance",material:"inventory",stock:"inventory",purchase:"purchases",supplier:"suppliers",employee:"hr",payroll:"payroll",document:"documents"};
    document.querySelectorAll("[data-erp-form]").forEach((form)=>{ const sec=formMap[form.dataset.erpForm]; if(sec) form.hidden=!canPermission(sec,"create"); });
    Object.entries(viewPermissionSection).forEach(([view,sec])=>{ const root=$("view-"+view); if(!root)return; root.querySelectorAll("[data-edit-manual-order-id],[data-edit-transaction-id],[data-edit-material-id],[data-edit-purchase-id],[data-edit-supplier-id],[data-edit-employee-id],[data-edit-payroll-id],[data-edit-document-id],[contenteditable]").forEach(el=>{ if(el.matches("[contenteditable]")) el.contentEditable=canPermission(sec,"edit")?"true":"false"; else el.hidden=!canPermission(sec,"edit"); }); root.querySelectorAll("[data-delete-row-table],[data-delete-employee-id]").forEach(el=>el.hidden=!canPermission(sec,"delete")); });
  }
  function renderAll() {
    renderKpis();
    renderRevenueChart();
    renderExpenseDonut();
    renderInsights();
    renderRecentTransactions();
    renderManualOrders();
    renderActivity();
    renderLedger();
    renderProfitEngine();
    renderExpenses();
    renderInventory();
    renderPurchases();
    renderSuppliers();
    renderHr();
    renderPayroll();
    renderDocuments();
    renderReports();
    renderSettings();
    renderTopProducts();
    renderStatusBreakdown();
    updateLastSync();
    applyPermissionUi();
  }

  function categoryName(id) {
    const row = state.categories.find((c) => String(c.id) === String(id));
    return row ? row.name : "";
  }

  function supplierName(id) {
    const row = state.suppliers.find((s) => String(s.id) === String(id));
    return row ? row.name : "بدون مورد";
  }

  function employeeName(id) {
    const row = state.employees.find((e) => String(e.id) === String(id));
    return row ? row.full_name : "";
  }

  function daysUntil(dateValue) {
    if (!dateValue) return 999999;
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return 999999;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }

  function currentAlerts() {
    const lowStock = state.materials
      .filter((m) => Number(m.current_stock || 0) <= Number(m.minimum_stock || 0))
      .map((m) => ({
        title: "مخزون منخفض",
        text: `${m.name}: المتوفر ${num(m.current_stock, 3)} ${m.unit || ""}`,
        url: "/erp#/inventory",
      }));
    const documents = state.documents
      .filter((d) => daysUntil(d.expiry_date) <= Number(d.alert_days || 30))
      .map((d) => ({
        title: "مستند قريب الانتهاء",
        text: `${d.document_type || "مستند"} ينتهي في ${d.expiry_date || ""}`,
        url: "/erp#/documents",
      }));
    const dbAlerts = state.alerts.map((a) => ({
      title: a.title || a.type || "تنبيه",
      text: a.message || a.description || "",
      url: "/erp#/dashboard",
    }));
    return lowStock.concat(documents, dbAlerts);
  }

  function updateNotificationBadge() {
    const count = currentAlerts().length;
    const badge = $("erpNotifyBadge");
    if (badge) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.hidden = count < 1;
    }
    if ("setAppBadge" in navigator) {
      if (count > 0) navigator.setAppBadge(count).catch(() => {});
      else if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => {});
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: count > 0 ? "SET_BADGE" : "CLEAR_BADGE", count });
    }
  }

  async function enableNotifications() {
    const alerts = currentAlerts();
    if (!("Notification" in window)) return toast("المتصفح لا يدعم الإشعارات.");
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return toast("لم يتم تفعيل الإشعارات.");
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
    const first = alerts[0] || { title: "تنبيهات بريق", text: "تم تفعيل إشعارات نظام الإدارة.", url: "/erp" };
    if (reg?.showNotification) {
      await reg.showNotification(first.title, {
        body: first.text || "يوجد تحديث داخل نظام الإدارة.",
        icon: "/assets/icon-96.png",
        badge: "/assets/icon-96.png",
        tag: "bariq-erp-alert",
        data: { url: first.url || "/erp" },
      });
    } else {
      new Notification(first.title, { body: first.text || "يوجد تحديث داخل نظام الإدارة.", icon: "/assets/icon-96.png" });
    }
    updateNotificationBadge();
    toast("تم تفعيل الإشعارات.");
  }

  function setSync(text) {
    if ($("erpSyncState")) $("erpSyncState").textContent = text;
  }

  function updateLastSync() {
    if ($("erpLastSync")) $("erpLastSync").textContent = "آخر تحديث: " + new Date().toLocaleTimeString("ar-AE", { hour: "2-digit", minute: "2-digit" });
    updateNotificationBadge();
  }

  function setView(view) {
    if (!titles[view]) view = "dashboard";
    if (view === "settings" && !isOwner()) { toast("إدارة الحسابات للمالك فقط."); view = "dashboard"; }
    const required = viewPermissionSection[view];
    if (required && !canPermission(required,"read")) { toast("ليس لديك صلاحية عرض هذا القسم."); view = "dashboard"; }
    state.view = view;
    document.querySelectorAll(".erp-nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
    document.querySelectorAll(".erp-view").forEach((section) => section.classList.toggle("active", section.id === "view-" + view));
    if ($("erpPageTitle")) $("erpPageTitle").textContent = titles[view][0];
    if ($("erpPageSubtitle")) $("erpPageSubtitle").textContent = titles[view][1];
    document.body.classList.remove("erp-nav-open");
    history.replaceState(null, "", "#/" + view);
    renderKpis();
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
    if (period === "custom-day" && dayInput && !dayInput.value) state.customDay = "";
    if (period === "custom-month" && monthInput && !monthInput.value) state.customMonth = "";
    if (period === "custom-year" && yearInput && !yearInput.value) state.customYear = "";
    renderAll();
  }

  function categoryOptions(type) {
    const rows = state.categories
      .filter((c) => c.type === type)
      .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
      .join("");
    return rows || '<option value="">لا توجد تصنيفات في النظام بعد</option>';
  }

  function supplierOptions() {
    const rows = state.suppliers.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
    return '<option value="">بدون مورد</option>' + (rows || '<option value="" disabled>أضف مورد أولًا</option>');
  }

  function materialOptions() {
    return state.materials.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("") || '<option value="">أضف خامة أولًا</option>';
  }

  function rebuildDynamicForms() {
    const incomeCat = categoryOptions("income");
    const expenseCat = categoryOptions("expense");
    const suppliers = supplierOptions();
    const materials = materialOptions();
    document.querySelectorAll("[data-income-categories]").forEach((el) => { el.innerHTML = incomeCat; });
    document.querySelectorAll("[data-expense-categories]").forEach((el) => { el.innerHTML = expenseCat; });
    document.querySelectorAll("[data-suppliers]").forEach((el) => { el.innerHTML = suppliers; });
    document.querySelectorAll("[data-materials]").forEach((el) => { el.innerHTML = materials; });
    document.querySelectorAll("[data-payment-methods]").forEach((el) => { el.innerHTML = paymentMethods.map((m) => `<option>${esc(m)}</option>`).join(""); });
  }

  async function addManualOrder(form) {
    const data = new FormData(form);
    const payload = {
      order_number: data.get("order_number"),
      customer_name: data.get("customer_name"),
      customer_phone: data.get("customer_phone") || null,
      customer_email: data.get("customer_email") || null,
      customer_address: data.get("customer_address") || null,
      status: data.get("status") || "new",
      total: Number(data.get("total") || 0),
      deposit: Number(data.get("deposit") || 0),
      notes: data.get("notes") || null,
    };
    if (!payload.order_number || !payload.customer_name) return toast("اكتب رقم الطلب واسم العميل.");
    const editingId = state.editingManualOrderId;
    await erpFetch(editingId ? `erp_manual_orders?id=eq.${encodeURIComponent(editingId)}` : "erp_manual_orders", {
      method: editingId ? "PATCH" : "POST",
      body: JSON.stringify(payload),
      prefer: "return=minimal",
    });
    state.editingManualOrderId = "";
    const submit = form.querySelector("[data-manual-order-submit]");
    if (submit) submit.textContent = "حفظ الطلب";
    form.reset();
    toast(editingId ? "تم تعديل الطلب اليدوي." : "تم حفظ الطلب اليدوي.");
    await loadData();
  }

  function updateManualOrderRemaining(form) {
    if (!form) return;
    const total = Number(form.elements.total?.value || 0);
    const deposit = Number(form.elements.deposit?.value || 0);
    const remaining = Math.max(0, total - deposit);
    if (form.elements.remaining_display) form.elements.remaining_display.value = money(remaining);
  }

  function editManualOrder(orderId) {
    const order = state.manualOrders.find((row) => String(row.id) === String(orderId));
    const form = document.querySelector('[data-erp-form="manual-order"]');
    if (!order || !form) return;
    state.editingManualOrderId = orderId;
    form.elements.order_number.value = order.order_number || "";
    form.elements.customer_name.value = order.customer_name || "";
    form.elements.customer_phone.value = order.customer_phone || "";
    form.elements.customer_email.value = order.customer_email || "";
    form.elements.customer_address.value = order.customer_address || "";
    form.elements.total.value = Number(order.total || 0);
    form.elements.deposit.value = Number(order.deposit || 0);
    form.elements.status.value = order.status || "new";
    form.elements.notes.value = order.notes || "";
    updateManualOrderRemaining(form);
    const submit = form.querySelector("[data-manual-order-submit]");
    if (submit) submit.textContent = "حفظ التعديل";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function deleteStoredRow(table, id) {
    if (!table || !id) return;
    const allowed = new Set(["erp_manual_orders", "erp_transactions", "erp_materials", "erp_purchases", "erp_suppliers", "erp_payroll", "erp_documents"]);
    if (!allowed.has(table)) return toast("جدول غير مسموح بحذفه من الواجهة.");
    if (!confirm("حذف هذا السجل من قاعدة البيانات؟")) return;
    await erpFetch(`${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    toast("تم حذف السجل.");
    await loadData();
  }

  async function addTransaction(form, type) {
    const data = new FormData(form);
    const payload = {
      type,
      transaction_date: data.get("transaction_date") || todayIso(),
      amount: Number(data.get("amount") || 0),
      category_id: data.get("category_id") || null,
      category: data.get("category_text") || null,
      description: data.get("description") || (type === "income" ? "إيراد" : "مصروف"),
      payment_method: data.get("payment_method") || null,
      supplier_id: data.get("supplier_id") || null,
      external_reference: data.get("external_reference") || null,
      invoice_number: data.get("invoice_number") || null,
      notes: data.get("notes") || null,
    };
    if (!payload.amount || payload.amount < 0) return toast("اكتب مبلغ صحيح.");
    const editingId = state.editingTransactionId;
    await erpFetch(editingId ? `erp_transactions?id=eq.${encodeURIComponent(editingId)}` : "erp_transactions", {
      method: editingId ? "PATCH" : "POST",
      body: JSON.stringify(payload),
      prefer: "return=minimal",
    });
    state.editingTransactionId = "";
    form.reset();
    setFormDates();
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = type === "income" ? "حفظ الإيراد" : "حفظ المصروف";
    toast(editingId ? "تم تعديل المعاملة." : (type === "income" ? "تم حفظ الإيراد في Supabase." : "تم حفظ المصروف في Supabase."));
    await loadData();
  }

  function editTransaction(id) {
    const row = state.transactions.find((item) => String(item.id) === String(id));
    if (!row) return;
    const form = document.querySelector(`[data-erp-form="${row.type === "income" ? "income" : "expense"}"]`);
    if (!form) return;
    state.editingTransactionId = id;
    setView(row.type === "income" ? "finance" : "expenses");
    form.elements.transaction_date.value = String(row.transaction_date || todayIso()).slice(0, 10);
    form.elements.amount.value = Number(row.amount || 0);
    if (form.elements.description) form.elements.description.value = row.description || "";
    if (form.elements.category_id) form.elements.category_id.value = row.category_id || "";
    if (form.elements.payment_method) form.elements.payment_method.value = row.payment_method || "";
    if (form.elements.supplier_id) form.elements.supplier_id.value = row.supplier_id || "";
    if (form.elements.external_reference) form.elements.external_reference.value = row.external_reference || "";
    if (form.elements.invoice_number) form.elements.invoice_number.value = row.invoice_number || "";
    if (form.elements.notes) form.elements.notes.value = row.notes || "";
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ التعديل";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function addMaterial(form) {
    const data = new FormData(form);
    const payload = {
      name: data.get("name"),
      code: data.get("code") || null,
      unit: data.get("unit") || "piece",
      opening_quantity: Number(data.get("opening_quantity") || 0),
      opening_cost: Number(data.get("opening_cost") || 0),
      minimum_stock: Number(data.get("minimum_stock") || 0),
      supplier_id: data.get("supplier_id") || null,
      location: data.get("location") || null,
      notes: data.get("notes") || null,
    };
    const editingId = state.editingMaterialId;
    await erpFetch(editingId ? `erp_materials?id=eq.${encodeURIComponent(editingId)}` : "erp_materials", {
      method: editingId ? "PATCH" : "POST",
      body: JSON.stringify(payload),
      prefer: "return=minimal",
    });
    state.editingMaterialId = "";
    form.reset();
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ الخامة";
    toast(editingId ? "تم تعديل الخامة." : "تم حفظ الخامة في Supabase.");
    await loadData();
  }

  function editMaterial(id) {
    const row = state.materials.find((item) => String(item.id) === String(id));
    const form = document.querySelector('[data-erp-form="material"]');
    if (!row || !form) return;
    state.editingMaterialId = id;
    setView("inventory");
    form.elements.name.value = row.name || "";
    form.elements.code.value = row.code || "";
    form.elements.unit.value = row.unit || "piece";
    form.elements.opening_quantity.value = Number(row.opening_quantity || 0);
    form.elements.opening_cost.value = Number(row.opening_cost || row.average_cost || 0);
    form.elements.minimum_stock.value = Number(row.minimum_stock || 0);
    form.elements.supplier_id.value = row.supplier_id || "";
    form.elements.location.value = row.location || "";
    form.elements.notes.value = row.notes || "";
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ التعديل";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function addStockMovement(form) {
    const data = new FormData(form);
    await erpFetch("erp_stock_movements", {
      method: "POST",
      body: JSON.stringify({
        material_id: data.get("material_id"),
        movement_date: data.get("movement_date") || todayIso(),
        movement_type: data.get("movement_type"),
        quantity: Number(data.get("quantity") || 0),
        unit_cost: data.get("unit_cost") ? Number(data.get("unit_cost")) : null,
        reference: data.get("reference") || null,
        notes: data.get("notes") || null,
      }),
      prefer: "return=minimal",
    });
    form.reset();
    setFormDates();
    toast("تم حفظ حركة المخزون.");
    await loadData();
  }

  async function addPurchase(form) {
    const data = new FormData(form);
    const quantity = Number(data.get("quantity") || 0);
    const unitCost = Number(data.get("unit_cost") || 0);
    const total = quantity * unitCost;
    const editingId = state.editingPurchaseId;
    const paid = Math.max(0, Number(data.get("paid") || 0));
    const paymentStatus = paid <= 0 ? "unpaid" : (paid >= total ? "paid" : "partial");
    const purchasePayload = {
      supplier_id: data.get("supplier_id"),
      purchase_date: data.get("purchase_date") || todayIso(),
      invoice_number: data.get("invoice_number") || null,
      total,
      paid,
      payment_status: paymentStatus,
      status: data.get("status") || "draft",
      notes: data.get("notes") || null,
    };

    if (editingId) {
      await erpFetch(`erp_purchases?id=eq.${encodeURIComponent(editingId)}`, {
        method: "PATCH", body: JSON.stringify(purchasePayload), prefer: "return=minimal",
      });
      const itemPayload = { material_id: data.get("material_id"), quantity, unit_cost: unitCost };
      if (state.editingPurchaseItemId) {
        await erpFetch(`erp_purchase_items?id=eq.${encodeURIComponent(state.editingPurchaseItemId)}`, {
          method: "PATCH", body: JSON.stringify(itemPayload), prefer: "return=minimal",
        });
      } else {
        await erpFetch("erp_purchase_items", {
          method: "POST", body: JSON.stringify(Object.assign({ purchase_id: editingId }, itemPayload)), prefer: "return=minimal",
        });
      }
      state.editingPurchaseId = "";
      state.editingPurchaseItemId = "";
      form.reset();
      setFormDates();
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = "حفظ أمر الشراء";
      toast("تم تعديل أمر الشراء.");
      await loadData();
      return;
    }

    const purchaseRows = await erpFetch("erp_purchases", {
      method: "POST", body: JSON.stringify(purchasePayload), prefer: "return=representation",
    });
    const purchase = Array.isArray(purchaseRows) ? purchaseRows[0] : purchaseRows;
    if (!purchase?.id) throw new Error("Purchase was not saved");
    await erpFetch("erp_purchase_items", {
      method: "POST",
      body: JSON.stringify({ purchase_id: purchase.id, material_id: data.get("material_id"), quantity, unit_cost: unitCost }),
      prefer: "return=minimal",
    });
    if (data.get("status") === "received") {
      await erpFetch("erp_stock_movements", {
        method: "POST",
        body: JSON.stringify({
          material_id: data.get("material_id"), movement_date: data.get("purchase_date") || todayIso(), movement_type: "purchase",
          quantity, unit_cost: unitCost, reference: data.get("invoice_number") || purchase.id, notes: "Auto stock receipt from purchase order",
        }),
        prefer: "return=minimal",
      });
    }
    form.reset();
    setFormDates();
    toast("تم حفظ أمر الشراء في النظام.");
    await loadData();
  }

  async function editPurchase(id) {
    const row = state.purchases.find((item) => String(item.id) === String(id));
    const form = document.querySelector('[data-erp-form="purchase"]');
    if (!row || !form) return;
    const items = await loadTable(`erp_purchase_items?purchase_id=eq.${encodeURIComponent(id)}&limit=1`, []);
    const item = Array.isArray(items) ? items[0] : null;
    state.editingPurchaseId = id;
    state.editingPurchaseItemId = item?.id || "";
    setView("purchases");
    form.elements.supplier_id.value = row.supplier_id || "";
    form.elements.purchase_date.value = String(row.purchase_date || todayIso()).slice(0, 10);
    form.elements.invoice_number.value = row.invoice_number || "";
    form.elements.material_id.value = item?.material_id || "";
    form.elements.quantity.value = Number(item?.quantity || 0);
    form.elements.unit_cost.value = Number(item?.unit_cost || 0);
    form.elements.paid.value = Number(row.paid || 0);
    form.elements.payment_status.value = row.payment_status || "unpaid";
    form.elements.status.value = row.status || "draft";
    form.elements.notes.value = row.notes || "";
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ التعديل";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function addSupplier(form) {
    const data = new FormData(form);
    const payload = {
      name: data.get("name"), phone: data.get("phone") || null, email: data.get("email") || null,
      category: data.get("category") || null, address: data.get("address") || null, notes: data.get("notes") || null,
    };
    const editingId = state.editingSupplierId;
    await erpFetch(editingId ? `erp_suppliers?id=eq.${encodeURIComponent(editingId)}` : "erp_suppliers", {
      method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload), prefer: "return=minimal",
    });
    state.editingSupplierId = "";
    form.reset();
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ المورد";
    toast(editingId ? "تم تعديل المورد." : "تم حفظ المورد.");
    await loadData();
  }

  function editSupplier(id) {
    const row = state.suppliers.find((item) => String(item.id) === String(id));
    const form = document.querySelector('[data-erp-form="supplier"]');
    if (!row || !form) return;
    state.editingSupplierId = id;
    setView("suppliers");
    form.elements.name.value = row.name || "";
    form.elements.phone.value = row.phone || "";
    form.elements.email.value = row.email || "";
    form.elements.category.value = row.category || "";
    form.elements.address.value = row.address || "";
    form.elements.notes.value = row.notes || "";
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ التعديل";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function addEmployee(form) {
    const data = new FormData(form);
    const payload = {
      full_name: data.get("full_name"), job_title: data.get("job_title") || null, department: data.get("department") || null,
      salary: Number(data.get("salary") || 0), hire_date: data.get("hire_date") || null, phone: data.get("phone") || null,
      emirates_id: data.get("emirates_id") || null, residence_expiry: data.get("residence_expiry") || null,
      passport_number: data.get("passport_number") || null, allowances: Number(data.get("allowances") || 0),
      deductions: Number(data.get("deductions") || 0), notes: data.get("notes") || null,
    };
    const editingId = state.editingEmployeeId;
    await erpFetch(editingId ? `erp_employees?id=eq.${encodeURIComponent(editingId)}` : "erp_employees", {
      method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload), prefer: "return=minimal",
    });
    state.editingEmployeeId = "";
    form.reset();
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ الموظف";
    toast(editingId ? "تم تعديل الموظف." : "تم حفظ الموظف.");
    await loadData();
  }

  function editEmployee(id) {
    const row = state.employees.find((item) => String(item.id) === String(id));
    const form = document.querySelector('[data-erp-form="employee"]');
    if (!row || !form) return;
    state.editingEmployeeId = id;
    setView("hr");
    ["full_name","job_title","department","hire_date","phone","emirates_id","residence_expiry","passport_number","notes"].forEach((name) => {
      if (form.elements[name]) form.elements[name].value = row[name] || "";
    });
    ["salary","allowances","deductions"].forEach((name) => { if (form.elements[name]) form.elements[name].value = Number(row[name] || 0); });
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ التعديل";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function deleteEmployee(employeeId) {
    const employee = state.employees.find((row) => String(row.id) === String(employeeId));
    if (!employee) return;
    if (!confirm(`حذف الموظف ${employee.full_name}؟ سيتم حذف ملفه وملاحظاته المرتبطة.`)) return;
    await erpFetch(`erp_employees?id=eq.${encodeURIComponent(employeeId)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    if (String(state.selectedEmployeeId) === String(employeeId)) state.selectedEmployeeId = "";
    toast("تم حذف الموظف.");
    await loadData();
  }

  async function uploadEmployeeFile(file, employeeId, type) {
    if (!file || !window.Supabase?.Storage?.upload) return "";
    const folder = `erp-employees/${String(employeeId).replace(/[^a-z0-9-]/gi, "")}/${type}`;
    return window.Supabase.Storage.upload(file, folder);
  }

  async function saveEmployeeProfile(form) {
    const employeeId = form.dataset.employeeId;
    if (!employeeId) return;
    const data = new FormData(form);
    const payload = {
      residence_expiry: data.get("residence_expiry") || null,
      residence_renewal_notes: data.get("residence_renewal_notes") || null,
      salary: Number(data.get("salary") || 0),
      allowances: Number(data.get("allowances") || 0),
      deductions: Number(data.get("deductions") || 0),
      overtime_hours: Number(data.get("overtime_hours") || 0),
      overtime_rate: Number(data.get("overtime_rate") || 0),
      late_minutes: Number(data.get("late_minutes") || 0),
      late_penalty: Number(data.get("late_penalty") || 0),
      annual_leave_days: Number(data.get("annual_leave_days") || 0),
      used_leave_days: Number(data.get("used_leave_days") || 0),
      performance_percent: Math.max(0, Math.min(100, Number(data.get("performance_percent") || 0))),
      rating: Math.max(0, Math.min(5, Number(data.get("rating") || 0))),
      strengths: data.get("strengths") || null,
      mistakes: data.get("mistakes") || null,
      evaluation_notes: data.get("evaluation_notes") || null,
      notes: data.get("evaluation_notes") || null,
    };
    const photo = data.get("photo_file");
    const residence = data.get("residence_file");
    if (photo && photo.size) payload.photo_url = await uploadEmployeeFile(photo, employeeId, "photo");
    if (residence && residence.size) payload.residence_attachment_url = await uploadEmployeeFile(residence, employeeId, "residence");
    await erpFetch(`erp_employees?id=eq.${encodeURIComponent(employeeId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      prefer: "return=minimal",
    });
    toast("تم حفظ ملف الموظف.");
    state.selectedEmployeeId = employeeId;
    await loadData();
    state.selectedEmployeeId = employeeId;
    renderEmployeeProfile();
  }

  async function addEmployeeNote(form) {
    const employeeId = form.dataset.employeeId;
    if (!employeeId) return;
    const data = new FormData(form);
    await erpFetch("erp_employee_notes", {
      method: "POST",
      body: JSON.stringify({
        employee_id: employeeId,
        note_type: data.get("note_type") || "note",
        title: data.get("title"),
        body: data.get("body") || null,
        value: data.get("value") === "" ? null : Number(data.get("value") || 0),
        event_date: data.get("event_date") || todayIso(),
      }),
      prefer: "return=minimal",
    });
    form.reset();
    toast("تمت إضافة الملاحظة للملف.");
    state.selectedEmployeeId = employeeId;
    await loadData();
    state.selectedEmployeeId = employeeId;
    renderEmployeeProfile();
  }

  async function addPayroll(form) {
    const data = new FormData(form);
    const month = data.get("payroll_month");
    const editingId = state.editingPayrollId;
    const payload = { payroll_month: month ? `${month}-01` : todayIso().slice(0, 8) + "01", status: data.get("status") || "draft", notes: data.get("notes") || null };
    if (editingId) {
      await erpFetch(`erp_payroll?id=eq.${encodeURIComponent(editingId)}`, { method: "PATCH", body: JSON.stringify(payload), prefer: "return=minimal" });
      state.editingPayrollId = "";
      form.reset();
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = "إنشاء المسير";
      toast("تم تعديل مسير الرواتب.");
      await loadData();
      return;
    }
    const activeEmployees = state.employees.filter((employee) => employee.active !== false);
    if (!activeEmployees.length) return toast("أضف موظفين نشطين قبل إنشاء مسير الرواتب.");
    const payrollRows = await erpFetch("erp_payroll", { method: "POST", body: JSON.stringify(payload), prefer: "return=representation" });
    const payroll = Array.isArray(payrollRows) ? payrollRows[0] : payrollRows;
    if (!payroll?.id) throw new Error("لم يتم حفظ مسير الرواتب");
    const items = activeEmployees.map((employee) => {
      const basic = Number(employee.salary || 0), allowances = Number(employee.allowances || 0);
      const overtime = Number(employee.overtime_hours || 0) * Number(employee.overtime_rate || 0);
      const deductions = Number(employee.deductions || 0), latePenalty = Number(employee.late_penalty || 0);
      return { payroll_id: payroll.id, employee_id: employee.id, basic_salary: basic, allowances, overtime, deductions: deductions + latePenalty, advance: 0 };
    });
    await erpFetch("erp_payroll_items", { method: "POST", body: JSON.stringify(items), prefer: "return=minimal" });
    form.reset();
    toast("تم إنشاء مسير الرواتب من بيانات الموظفين.");
    await loadData();
  }

  function editPayroll(id) {
    const row = state.payroll.find((item) => String(item.id) === String(id));
    const form = document.querySelector('[data-erp-form="payroll"]');
    if (!row || !form) return;
    state.editingPayrollId = id;
    setView("payroll");
    form.elements.payroll_month.value = String(row.payroll_month || "").slice(0, 7);
    form.elements.status.value = row.status || "draft";
    form.elements.notes.value = row.notes || "";
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ التعديل";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function addDocument(form) {
    const data = new FormData(form);
    const payload = {
      document_type: data.get("document_type"), document_number: data.get("document_number") || null, owner_type: data.get("owner_type") || null,
      owner_name: data.get("owner_name") || null, employee_id: data.get("employee_id") || null, issue_date: data.get("issue_date") || null,
      expiry_date: data.get("expiry_date") || null, alert_days: Number(data.get("alert_days") || 30), notes: data.get("notes") || null,
    };
    const editingId = state.editingDocumentId;
    await erpFetch(editingId ? `erp_documents?id=eq.${encodeURIComponent(editingId)}` : "erp_documents", {
      method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload), prefer: "return=minimal",
    });
    state.editingDocumentId = "";
    form.reset();
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ المستند";
    toast(editingId ? "تم تعديل المستند." : "تم حفظ المستند.");
    await loadData();
  }

  function editDocument(id) {
    const row = state.documents.find((item) => String(item.id) === String(id));
    const form = document.querySelector('[data-erp-form="document"]');
    if (!row || !form) return;
    state.editingDocumentId = id;
    setView("documents");
    ["document_type","document_number","owner_type","owner_name","issue_date","expiry_date","notes"].forEach((name) => {
      if (form.elements[name]) form.elements[name].value = row[name] || "";
    });
    if (form.elements.alert_days) form.elements.alert_days.value = Number(row.alert_days || 30);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "حفظ التعديل";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function inlineSave(cell) {
    const table = cell.dataset.table;
    const id = cell.dataset.id;
    const field = cell.dataset.field;
    if (!table || !id || !field) return;
    let value = cell.textContent.trim();
    if (field === "amount") value = Number(value.replace(/[^\d.]/g, ""));
    await erpFetch(`${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ [field]: value }),
      prefer: "return=minimal",
    });
    toast("تم حفظ التعديل.");
    await loadData();
  }

  function exportCsv() {
    const rows = [["type", "date", "description", "amount", "category", "payment_method", "reference"]];
    periodTransactions().forEach((row) => rows.push([row.type, row.transaction_date, row.description, row.amount, row.category || categoryName(row.category_id), row.payment_method || "", row.external_reference || row.invoice_number || ""]));
    const csv = rows.map((row) => row.map((cell) => `"${String(cell == null ? "" : cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bariq-erp-report-" + todayIso() + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

  function bindEvents() {
    document.querySelectorAll(".erp-nav-item").forEach((btn) => btn.addEventListener("click", () => setView(btn.dataset.view)));
    document.querySelectorAll(".erp-periods button").forEach((btn) => btn.addEventListener("click", () => setPeriod(btn.dataset.period)));
    $("erpMenuBtn").addEventListener("click", () => document.body.classList.toggle("erp-nav-open"));
    document.addEventListener("click", (event) => {
      if (document.body.classList.contains("erp-nav-open") && !event.target.closest(".erp-sidebar") && !event.target.closest("#erpMenuBtn")) {
        document.body.classList.remove("erp-nav-open");
      }
    });
    document.addEventListener("focusout", (event) => {
      if (event.target.matches("[contenteditable][data-table]")) inlineSave(event.target).catch((e) => toast(e.message));
    });
    document.addEventListener("click", (event) => {
      const editErpUserBtn = event.target.closest("[data-edit-erp-user]");
      if (editErpUserBtn) { event.preventDefault(); editErpUser(editErpUserBtn.dataset.editErpUser); return; }
      const toggleErpUserBtn = event.target.closest("[data-toggle-erp-user]");
      if (toggleErpUserBtn) { event.preventDefault(); toggleErpUser(toggleErpUserBtn.dataset.toggleErpUser).catch((e)=>toast(e.message)); return; }
      const deleteRowBtn = event.target.closest("[data-delete-row-table][data-delete-row-id]");
      if (deleteRowBtn) {
        event.preventDefault();
        deleteStoredRow(deleteRowBtn.dataset.deleteRowTable, deleteRowBtn.dataset.deleteRowId).catch((e) => toast(e.message));
        return;
      }
      const editManualOrderBtn = event.target.closest("[data-edit-manual-order-id]");
      if (editManualOrderBtn) {
        event.preventDefault();
        editManualOrder(editManualOrderBtn.dataset.editManualOrderId);
        return;
      }
      const editTransactionBtn = event.target.closest("[data-edit-transaction-id]");
      if (editTransactionBtn) { event.preventDefault(); editTransaction(editTransactionBtn.dataset.editTransactionId); return; }
      const editMaterialBtn = event.target.closest("[data-edit-material-id]");
      if (editMaterialBtn) { event.preventDefault(); editMaterial(editMaterialBtn.dataset.editMaterialId); return; }
      const editPurchaseBtn = event.target.closest("[data-edit-purchase-id]");
      if (editPurchaseBtn) { event.preventDefault(); editPurchase(editPurchaseBtn.dataset.editPurchaseId).catch((e) => toast(e.message)); return; }
      const editSupplierBtn = event.target.closest("[data-edit-supplier-id]");
      if (editSupplierBtn) { event.preventDefault(); editSupplier(editSupplierBtn.dataset.editSupplierId); return; }
      const editEmployeeBtn = event.target.closest("[data-edit-employee-id]");
      if (editEmployeeBtn) { event.preventDefault(); editEmployee(editEmployeeBtn.dataset.editEmployeeId); return; }
      const editPayrollBtn = event.target.closest("[data-edit-payroll-id]");
      if (editPayrollBtn) { event.preventDefault(); editPayroll(editPayrollBtn.dataset.editPayrollId); return; }
      const editDocumentBtn = event.target.closest("[data-edit-document-id]");
      if (editDocumentBtn) { event.preventDefault(); editDocument(editDocumentBtn.dataset.editDocumentId); return; }
      const deleteEmployeeBtn = event.target.closest("[data-delete-employee-id]");
      if (deleteEmployeeBtn) {
        event.preventDefault();
        deleteEmployee(deleteEmployeeBtn.dataset.deleteEmployeeId).catch((e) => toast(e.message));
        return;
      }
      const employeeBtn = event.target.closest("[data-employee-id]");
      if (employeeBtn && employeeBtn.classList.contains("erp-link-btn")) {
        event.preventDefault();
        state.selectedEmployeeId = employeeBtn.dataset.employeeId;
        renderHr();
        renderEmployeeProfile();
        $("erpEmployeeProfile")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    document.addEventListener("submit", (event) => {
      const form = event.target.closest('[data-erp-form="employee-profile"], [data-erp-form="employee-note"]');
      if (!form) return;
      event.preventDefault();
      const run = form.dataset.erpForm === "employee-profile" ? saveEmployeeProfile(form) : addEmployeeNote(form);
      run.catch((e) => toast(e.message));
    });
    document.querySelectorAll("[data-erp-form]").forEach((form) => {
      if (form.dataset.erpForm === "manual-order") {
        ["total", "deposit"].forEach((name) => form.elements[name]?.addEventListener("input", () => updateManualOrderRemaining(form)));
        updateManualOrderRemaining(form);
      }
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const action = form.dataset.erpForm;
        if (action === "employee-profile" || action === "employee-note") return;
        const run = {
          "manual-order": () => addManualOrder(form),
          income: () => addTransaction(form, "income"),
          expense: () => addTransaction(form, "expense"),
          material: () => addMaterial(form),
          stock: () => addStockMovement(form),
          purchase: () => addPurchase(form),
          supplier: () => addSupplier(form),
          employee: () => addEmployee(form),
          payroll: () => addPayroll(form),
          document: () => addDocument(form),
        }[action];
        if (run) run().catch((e) => toast(e.message));
      });
    });
    $("erpExportCsv")?.addEventListener("click", exportCsv);
    $("erpLogoutBtn")?.addEventListener("click", logoutErp);
    $("erpQuickLogoutBtn")?.addEventListener("click", logoutErp);
    $("erpUserForm")?.addEventListener("submit", (event) => { event.preventDefault(); saveErpUser(event.currentTarget).catch((e)=>toast(e.message)); });
    $("erpUserCancel")?.addEventListener("click", () => { const f=$("erpUserForm"); f.reset(); f.dataset.userId=""; $("erpUserEmail").disabled=false; $("erpUserFormTitle").textContent="إنشاء حساب جديد"; fillPermissions(f,null); });
    $("erpPrintReport")?.addEventListener("click", () => window.print());
    document.addEventListener("change", (event) => {
      const statusSelect = event.target.closest("[data-order-status-id]");
      if (!statusSelect) return;
      updateManualOrderStatus(statusSelect.dataset.orderStatusId, statusSelect.value).catch((e) => {
        toast(e.message);
        loadData().catch(() => {});
      });
    });
    $("erpSearch").addEventListener("input", renderSearch);
    $("erpCustomDay")?.addEventListener("change", (event) => {
      state.customDay = event.target.value || "";
      state.period = "custom-day";
      setPeriod("custom-day");
    });
    $("erpCustomMonth")?.addEventListener("change", (event) => {
      state.customMonth = event.target.value || "";
      state.period = "custom-month";
      setPeriod("custom-month");
    });
    $("erpCustomYear")?.addEventListener("input", (event) => {
      state.customYear = event.target.value || "";
      state.period = "custom-year";
      setPeriod("custom-year");
    });
    $("erpOrderSearch")?.addEventListener("input", (event) => {
      state.orderSearch = event.target.value || "";
      renderManualOrders();
    });
    $("erpOrderStatusFilter")?.addEventListener("change", (event) => {
      state.orderStatusFilter = event.target.value || "";
      renderManualOrders();
    });
    $("erpOrderSort")?.addEventListener("change", (event) => {
      state.orderSort = event.target.value || "number";
      const custom = state.orderSort === "custom";
      if ($("erpOrderDateRange")) $("erpOrderDateRange").hidden = !custom;
      renderManualOrders();
    });
    $("erpOrderDateFrom")?.addEventListener("change", (event) => { state.orderDateFrom = event.target.value || ""; renderManualOrders(); });
    $("erpOrderDateTo")?.addEventListener("change", (event) => { state.orderDateTo = event.target.value || ""; renderManualOrders(); });
    $("erpNotifyBtn").addEventListener("click", () => enableNotifications().catch((e) => toast(e.message)));
  }

  function renderSearch() {
    const q = $("erpSearch").value.trim().toLowerCase();
    const box = $("erpSearchResults");
    if (!box) return;
    if (!q) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const has = (...values) => values.some((v) => String(v || "").toLowerCase().includes(q));
    const results = []
      .concat(state.manualOrders.filter((row) => has(row.order_number, row.customer_name, row.customer_phone, row.customer_email, row.customer_address)).map((row) => ({
        title: `طلب يدوي #${row.order_number}`,
        text: `${row.customer_name || ""} - ${row.customer_phone || ""} - ${orderStatusLabel(row.status)}`,
        view: "orders",
      })))
      .concat(state.transactions.filter((row) => has(row.description, row.category, row.payment_method, row.external_reference, row.invoice_number, row.amount)).map((row) => ({
        title: row.description || "معاملة",
        text: `${row.transaction_date || ""} - ${row.type === "income" ? "إيراد" : "مصروف"} - ${money(row.amount)}`,
        view: row.type === "income" ? "finance" : "expenses",
      })))
      .concat(state.materials.filter((row) => has(row.name, row.code, row.unit, row.location)).map((row) => ({
        title: row.name,
        text: `المتوفر ${num(row.current_stock, 3)} ${row.unit || ""}`,
        view: "inventory",
      })))
      .concat(state.suppliers.filter((row) => has(row.name, row.phone, row.email, row.category, row.address)).map((row) => ({
        title: row.name,
        text: `${row.category || "مورد"} - ${row.phone || ""}`,
        view: "suppliers",
      })))
      .concat(state.employees.filter((row) => has(row.full_name, row.job_title, row.department, row.phone, row.emirates_id, row.strengths, row.mistakes, row.evaluation_notes)).map((row) => ({
        title: row.full_name,
        text: `${row.department || ""} - ${row.job_title || ""}`,
        view: "hr",
      })))
      .concat(state.documents.filter((row) => has(row.document_type, row.document_number, row.owner_name, row.owner_type)).map((row) => ({
        title: row.document_type,
        text: `${row.owner_name || ""} - ${row.expiry_date || ""}`,
        view: "documents",
      })));

    box.hidden = false;
    box.innerHTML = `
      <h2>نتائج البحث (${num(results.length, 0)})</h2>
      <div class="erp-search-result-grid">
        ${results.length ? results.slice(0, 30).map((row) => `
          <button class="erp-search-result" type="button" data-search-view="${esc(row.view)}">
            <span><strong>${esc(row.title)}</strong><small>${esc(row.text)}</small></span>
            <b>فتح</b>
          </button>`).join("") : '<div class="erp-empty">لا توجد نتائج مطابقة.</div>'}
      </div>`;
    box.querySelectorAll("[data-search-view]").forEach((btn) => btn.addEventListener("click", () => setView(btn.dataset.searchView)));
  }

  function setFormDates() {
    document.querySelectorAll('input[type="date"][data-today]').forEach((input) => {
      if (!input.value) input.value = todayIso();
    });
  }

  function erpRoleLabel(role) {
    const value = String(role || "").toLowerCase();
    if (value === "accountant") return "محاسب";
    if (value === "owner") return "مدير النظام";
    if (value === "admin") return "مدير النظام";
    return "مستخدم ERP";
  }

  function updateErpUserBadge(user) {
    if (!user) return;
    if ($("erpUserName")) $("erpUserName").textContent = user.full_name || "مستخدم ERP";
    if ($("erpUserRole")) $("erpUserRole").textContent = erpRoleLabel(user.role);
    const avatar = document.querySelector(".erp-user .erp-avatar");
    if (avatar) avatar.textContent = String(user.full_name || "B").trim().charAt(0).toUpperCase() || "B";
  }

  function hydrateUser() {
    try {
      const saved = JSON.parse(localStorage.getItem("bariq_admin_auth_v1") || "{}");
      if ($("erpUserName")) $("erpUserName").textContent = sessionStorage.getItem("admin_name") || saved.name || "Bariq Admin";
      if ($("erpUserRole")) $("erpUserRole").textContent = "مستخدم ERP";
    } catch (_) {}
  }

  async function ensureErpAccess() {
    if (!window.sbFetch) throw new Error("Supabase غير جاهز");
    try {
      const rows = await window.sbFetch("erp_users?active=eq.true&select=user_id,full_name,role,active&limit=1", { requireAuth: true });
      const user = Array.isArray(rows) ? rows[0] : null;
      if (!user || !["owner", "accountant", "admin"].includes(String(user.role || "").toLowerCase())) {
        clearErpSession();
        location.replace("/erp-login.html?error=forbidden&return=" + encodeURIComponent(location.pathname + location.search + location.hash));
        return false;
      }
      state.erpUser = user;
      if (user.full_name) sessionStorage.setItem("admin_name", user.full_name);
      updateErpUserBadge(user);
      return true;
    } catch (error) {
      console.warn("[ERP] access denied", error);
      clearErpSession();
      location.replace("/erp-login.html?error=forbidden&return=" + encodeURIComponent(location.pathname + location.search + location.hash));
      return false;
    }
  }

  function clearErpSession() {
    ["admin_ok","admin_token","admin_refresh_token","admin_token_exp","admin_name"].forEach((key) => sessionStorage.removeItem(key));
    localStorage.removeItem("bariq_admin_auth_v1");
  }

  async function boot() {
    document.body.classList.add("erp-menu-ready");
    const allowed = await ensureErpAccess();
    if (!allowed) return;
    hydrateUser();
    bindEvents();
    setFormDates();
    setPeriod(state.period);
    const hash = location.hash.replace(/^#\/?/, "");
    if (hash && titles[hash]) setView(hash);
    renderAll();
    loadData().catch((e) => toast(e.message));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch((e) => { console.error(e); location.replace("/erp-login.html"); }));
  } else {
    boot().catch((e) => { console.error(e); location.replace("/erp-login.html"); });
  }
})();
