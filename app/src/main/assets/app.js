
(() => {
  "use strict";

  const KEY = "mpn36_v2_data";
  const $ = id => document.getElementById(id);

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const CURRENCY_LOCALES = {
    MXN:"es-MX", USD:"en-US", EUR:"es-ES", COP:"es-CO",
    ARS:"es-AR", CLP:"es-CL", PEN:"es-PE", BRL:"pt-BR",
    GBP:"en-GB", JPY:"ja-JP", CAD:"en-CA", AUD:"en-AU",
    CHF:"de-CH", CNY:"zh-CN", INR:"en-IN", KRW:"ko-KR",
    PAB:"es-PA", UYU:"es-UY", DOP:"es-DO", GTQ:"es-GT",
    CRC:"es-CR", BOB:"es-BO", PYG:"es-PY", HNL:"es-HN",
    NIO:"es-NI", SEK:"sv-SE", NOK:"nb-NO", NZD:"en-NZ",
    SGD:"en-SG", ZAR:"en-ZA"
  };

  function money(n) {
    const code = data.settings.currency || "MXN";
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALES[code] || "es-MX", {
        style: "currency",
        currency: code
      }).format(Number(n) || 0);
    } catch {
      return `${code} ${(Number(n) || 0).toFixed(2)}`;
    }
  }

  function uid() {
    return window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;",
      '"':"&quot;", "'":"&#39;"
    }[c]));
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        return {
          ...d,
          products: Array.isArray(d.products) ? d.products : [],
          sales: Array.isArray(d.sales) ? d.sales : [],
          expenses: Array.isArray(d.expenses) ? d.expenses : [],
          stockMoves: Array.isArray(d.stockMoves) ? d.stockMoves : [],
          notes: Array.isArray(d.notes) ? d.notes : [],
          customers: Array.isArray(d.customers) ? d.customers : [],
          creditMovements: Array.isArray(d.creditMovements) ? d.creditMovements : [],
          cashCuts: Array.isArray(d.cashCuts) ? d.cashCuts : [],
          suppliers: Array.isArray(d.suppliers) ? d.suppliers : [],
          purchases: Array.isArray(d.purchases) ? d.purchases : [],
          settings: {
            ...(d.settings || {}),
            currency: d.settings?.currency || "MXN"
          }
        };
      }
    } catch (e) {
      console.error("Error cargando datos:", e);
    }

    return {
      products: [],
      sales: [],
      expenses: [],
      stockMoves: [],
      notes: [], customers: [], creditMovements: [], cashCuts: [], suppliers: [], purchases: [],
      settings: { currency: "MXN", theme: "classic" },
      gamification: { coins: 0, rewardedMilestones: [], purchasedThemes: ["classic"] }
    };
  }

  let data = loadData();
  data.notes = Array.isArray(data.notes) ? data.notes : [];
  data.customers = Array.isArray(data.customers) ? data.customers : [];
  data.creditMovements = Array.isArray(data.creditMovements) ? data.creditMovements : [];
  data.cashCuts = Array.isArray(data.cashCuts) ? data.cashCuts : [];
  data.suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
  data.purchases = Array.isArray(data.purchases) ? data.purchases : [];
  data.settings = { currency: "MXN", theme: "classic", businessName: "", mode: "light", mascotEnabled: true, productView: "grid", accentColor: "#315f82", fontScale: "normal", dashboardCards: "all", ...(data.settings || {}) };
  data.gamification = {
    coins: Math.max(0, Number(data.gamification?.coins) || 0),
    rewardedMilestones: Array.isArray(data.gamification?.rewardedMilestones) ? data.gamification.rewardedMilestones : [],
    purchasedThemes: Array.isArray(data.gamification?.purchasedThemes) ? data.gamification.purchasedThemes : ["classic"]
  };
  if (!data.gamification.purchasedThemes.includes("classic")) data.gamification.purchasedThemes.unshift("classic");
  // Los tres temas nuevos son gratuitos y quedan disponibles incluso en datos de versiones anteriores.
  ["hacker", "nature", "cbtis36", "tech-blue", "cyberpunk", "galaxy", "vaporwave"].forEach(id => {
    if (!data.gamification.purchasedThemes.includes(id)) data.gamification.purchasedThemes.push(id);
  });
  let salesChart = null;
  let editingExpenseId = null;
  let comparisonChart = null;
  let statsMoneyChart = null;
  let statsExpenseChart = null;

  function save(options = {}) {
    try {
      updateStreakRewards(Boolean(options.saleRegisteredToday));
      localStorage.setItem(KEY, JSON.stringify(data));
      renderAll();
    } catch (e) {
      console.error("Error guardando datos:", e);
      toast("No se pudieron guardar los datos.");
    }
  }

  function toast(msg) {
    const el = $("toast");
    if (!el) {
      alert(msg);
      return;
    }
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 2800);
  }

  function num(id) {
    return Number($(id).value) || 0;
  }

  function product(id) {
    return data.products.find(p => p.id === id);
  }

  function productCost(p) {
    return Number(p.materials || 0) + Number(p.labor || 0);
  }

  function addDays(date, n) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function inRange(date, from, to) {
    return (!from || date >= from) && (!to || date <= to);
  }

  function currentPeriod() {
    const period = $("dashboardPeriod").value;
    if (period === "all") return { from: "", to: today() };
    if (period === "today") return { from: today(), to: today() };
    return { from: addDays(today(), -(Number(period) - 1)), to: today() };
  }

  function totals(from = "", to = "") {
    const ss = data.sales.filter(s => inRange(s.date, from, to));
    const es = data.expenses.filter(e => inRange(e.date, from, to));
    const revenue = ss.reduce((a, s) => a + s.price * s.qty, 0);
    const costs = ss.reduce((a, s) => a + s.cost * s.qty, 0);
    const gross = revenue - costs;
    const expenseTotal = es.reduce((a, e) => a + e.amount, 0);
    return {
      ss, es, revenue, costs, gross, expenseTotal,
      net: gross - expenseTotal
    };
  }

  function emptyRow(cols, msg = "Sin registros todavía") {
    return `<tr><td colspan="${cols}" class="empty">${escapeHtml(msg)}</td></tr>`;
  }

  function renderProductOptions() {
    const opts = data.products.map(p =>
      `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (stock: ${p.stock})</option>`
    ).join("");

    $("stockProduct").innerHTML = opts || '<option value="">Agrega primero un producto</option>';
    $("saleProduct").innerHTML = opts || '<option value="">Agrega primero un producto</option>';
    updateSalePreview();
  }

  function renderProducts() {
    const q = $("productSearch").value.trim().toLowerCase();
    const list = data.products.filter(p => p.name.toLowerCase().includes(q));
    const cards = $("productCards");
    if (cards) cards.innerHTML = list.map(p => `<article class="product-card"><div class="product-card-image">${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.name)}">` : `<span aria-hidden="true">📦</span>`}</div><div class="product-card-body"><strong>${escapeHtml(p.name)}</strong><p>${money(p.price)} · Stock: ${p.stock}</p><p class="muted">Costo ${money(productCost(p))} · Ganancia ${money(p.price-productCost(p))}</p><div class="product-card-actions"><button type="button" class="row-button" data-favorite-product="${escapeHtml(p.id)}">${p.favorite ? "★ Favorito" : "☆ Favorito"}</button><button type="button" class="row-button" data-edit-product="${escapeHtml(p.id)}">Editar</button></div></div></article>`).join("") || `<p class="muted">No hay productos que coincidan.</p>`;
    if (cards) cards.classList.toggle("hidden", data.settings.productView !== "grid");
    const tableWrap = $("productTableWrap"); if (tableWrap) tableWrap.classList.toggle("hidden", data.settings.productView === "grid");
    $("productRows").innerHTML = list.map(p => `
      <tr>
        <td><button class="row-button" data-favorite-product="${escapeHtml(p.id)}">${p.favorite ? "★ " : "☆ "}</button>${p.image ? `<img class="table-product-image" src="${p.image}" alt="">` : ""}${escapeHtml(p.name)}</td>
        <td>${money(productCost(p))}</td>
        <td>${money(p.price)}</td>
        <td>${money(p.price - productCost(p))}</td>
        <td>${p.stock}</td>
        <td>
          <button class="row-button" data-edit-product="${escapeHtml(p.id)}">Editar</button>
          <button class="row-button danger" data-delete-product="${escapeHtml(p.id)}">Eliminar</button>
        </td>
      </tr>
    `).join("") || emptyRow(6);

    $("stockRows").innerHTML = data.stockMoves.slice().reverse().map(m => `
      <tr>
        <td>${escapeHtml(m.date)}</td>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.typeLabel)}</td>
        <td>${m.qty}</td>
        <td>${escapeHtml(m.reason || "—")}</td>
      </tr>
    `).join("") || emptyRow(5);

    renderProductOptions();
  }

  function renderSales() {
    $("saleRows").innerHTML = data.sales.slice().reverse().map(s => `
      <tr>
        <td>${escapeHtml(s.date)}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${s.qty}</td>
        <td>${money(s.price)}</td>
        <td>${money(s.qty * s.price)}</td>
        <td><button class="row-button danger" data-delete-sale="${escapeHtml(s.id)}">Eliminar</button></td>
      </tr>
    `).join("") || emptyRow(6);
  }

  function renderExpenses() {
    $("expenseRows").innerHTML = data.expenses.slice().reverse().map(e => `
      <tr>
        <td>${escapeHtml(e.date)}</td>
        <td>${escapeHtml(e.name)}</td>
        <td>${e.type === "fixed" ? "Fijo" : "Variable"}</td>
        <td>${money(e.amount)}</td>
        <td><button class="row-button" data-edit-expense="${escapeHtml(e.id)}">Editar</button> <button class="row-button danger" data-delete-expense="${escapeHtml(e.id)}">Eliminar</button></td>
      </tr>
    `).join("") || emptyRow(5);

    $("expenseTotal").textContent = money(
      data.expenses.reduce((a, e) => a + e.amount, 0)
    );
  }

  function renderDashboard() {
    const { from, to } = currentPeriod();
    const t = totals(from, to);

    $("metricSales").textContent = money(t.revenue);
    $("metricCosts").textContent = money(t.costs);
    $("metricGross").textContent = money(t.gross);
    $("metricNet").textContent = money(t.net);

    const low = data.products.filter(p => p.stock <= p.minStock);

    $("lowStockRows").innerHTML = low.map(p => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${p.stock}</td>
        <td>${p.minStock}</td>
        <td><span class="status low">Stock bajo</span></td>
      </tr>
    `).join("") || emptyRow(4, "No hay productos con stock bajo");

    $("inventorySummary").innerHTML = `
      <div class="inventory-box"><span>Productos registrados</span><strong>${data.products.length}</strong></div>
      <div class="inventory-box"><span>Unidades disponibles</span><strong>${data.products.reduce((a, p) => a + p.stock, 0)}</strong></div>
      <div class="inventory-box"><span>Productos con stock bajo</span><strong>${low.length}</strong></div>
      <div class="inventory-box"><span>Valor a costo actual*</span><strong>${money(data.products.reduce((a, p) => a + p.stock * productCost(p), 0))}</strong></div>
    `;

    const dates = [];
    for (let i = 6; i >= 0; i--) dates.push(addDays(today(), -i));

    const labels = dates.map(d => d.slice(5));
    const rev = dates.map(d => data.sales.filter(s => s.date === d).reduce((a, s) => a + s.price * s.qty, 0));
    const cost = dates.map(d => data.sales.filter(s => s.date === d).reduce((a, s) => a + s.cost * s.qty, 0));

    const canvas = $("salesChart");

    if (window.Chart && canvas) {
      if (salesChart) salesChart.destroy();

      salesChart = new Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "Ventas", data: rev, backgroundColor: "#2563eb", borderRadius: 5 },
            { label: "Costo vendido", data: cost, backgroundColor: "#cbd5e1", borderRadius: 5 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: v => `${data.settings.currency} ${v}` }
            }
          }
        }
      });
    }
  }

  function reportRange() {
    return { from: $("reportFrom").value, to: $("reportTo").value };
  }

  function renderReport() {
    const { from, to } = reportRange();
    const t = totals(from, to);

    $("reportSales").textContent = money(t.revenue);
    $("reportCosts").textContent = money(t.costs);
    $("reportExpenses").textContent = money(t.expenseTotal);
    $("reportNet").textContent = money(t.net);

    const groups = {};
    t.ss.forEach(s => {
      const g = groups[s.productId] || (groups[s.productId] = {
        name: s.name, qty: 0, revenue: 0, cost: 0
      });
      g.qty += s.qty;
      g.revenue += s.qty * s.price;
      g.cost += s.qty * s.cost;
    });

    $("reportProductRows").innerHTML = Object.values(groups).map(g => `
      <tr>
        <td>${escapeHtml(g.name)}</td>
        <td>${g.qty}</td>
        <td>${money(g.revenue)}</td>
        <td>${money(g.revenue - g.cost)}</td>
      </tr>
    `).join("") || emptyRow(4, "No hay ventas en este periodo");
  }


  const THEMES = [
    { id: "classic", name: "Azul y tierra", cost: 0, description: "Azul sereno, arena y tonos naturales.", colors: ["#315f82", "#d8cbb7"], preview: "linear-gradient(135deg,#315f82 50%,#d8cbb7 50%)" },
    { id: "ocean", name: "Océano", cost: 3, description: "Azules tranquilos y claros.", colors: ["#173b56", "#7db5d0"], preview: "linear-gradient(135deg,#173b56 50%,#7db5d0 50%)" },
    { id: "forest", name: "Bosque", cost: 5, description: "Verdes apagados y beige tierra.", colors: ["#334536", "#c5b58f"], preview: "linear-gradient(135deg,#334536 50%,#c5b58f 50%)" },
    { id: "violet", name: "Neón violeta", cost: 7, description: "Violeta y rosa brillante.", colors: ["#24113f", "#e879f9"], preview: "linear-gradient(135deg,#24113f 50%,#e879f9 50%)" },
    { id: "sunset", name: "Terracota", cost: 9, description: "Arcilla, café y arena cálida.", colors: ["#543b2d", "#c98b68"], preview: "linear-gradient(135deg,#543b2d 50%,#c98b68 50%)" },
    { id: "hacker", name: "Hacker", cost: 0, description: "Negro profundo y verde neón.", colors: ["#001b0b", "#39ff88"], preview: "linear-gradient(135deg,#001b0b 50%,#39ff88 50%)" },
    { id: "nature", name: "Naturaleza", cost: 0, description: "Verdes de bosque y tonos tierra.", colors: ["#234d35", "#d5e6c9"], preview: "linear-gradient(135deg,#234d35 50%,#d5e6c9 50%)" },
    { id: "cbtis36", name: "Escolar", cost: 0, description: "Azul escolar y blanco.", colors: ["#123b70", "#e6eef9"], preview: "linear-gradient(135deg,#123b70 50%,#e6eef9 50%)" },
    { id: "bandera-bi", name: "Bandera bi", cost: 0, creatorCode: "bis3xual", description: "Rosa, morado y azul inspirados en la bandera bisexual.", colors: ["#d64b8b", "#4d6bc9"], preview: "linear-gradient(135deg,#d64b8b 0%,#9b59b6 50%,#4d6bc9 100%)" },
    { id: "atardecer", name: "Atardecer", cost: 0, creatorCode: "post-meridium", description: "Coral, naranja y violeta cálidos.", colors: ["#df684b", "#f2ad55"], preview: "linear-gradient(135deg,#df684b 0%,#f2ad55 50%,#7853a6 100%)" },
    { id: "eclipse", name: "Eclipse", cost: 0, creatorCode: "solrequiem", description: "Negro profundo con destellos violetas y solares.", colors: ["#30264f", "#e6a84c"], preview: "linear-gradient(135deg,#11111f 0%,#6550a4 55%,#e6a84c 100%)" },
    { id: "tech-blue", name: "Azul tecnológico", cost: 0, description: "Negro profundo, azul eléctrico y detalles tecnológicos. Gratis.", colors: ["#080d16", "#168bff"], preview: "linear-gradient(135deg,#080d16 0%,#111d30 55%,#168bff 100%)" },
    { id: "pride", name: "Pride", cost: 0, creatorCode: "Pride", description: "Paleta arcoíris inspirada en la bandera LGBT+.", colors: ["#e84775", "#4d9dfa"], preview: "linear-gradient(120deg,#e84775 0%,#f7c943 35%,#39a96b 65%,#4d9dfa 100%)" },
    { id: "trans", name: "Trans", cost: 0, creatorCode: "trans", description: "Azul claro, rosa y blanco inspirados en la bandera trans.", colors: ["#8bcfff", "#f4a8c8"], preview: "linear-gradient(135deg,#8bcfff 0%,#f4a8c8 35%,#ffffff 50%,#f4a8c8 65%,#8bcfff 100%)" },
    { id: "abrosexual", name: "Abrosexual", cost: 0, creatorCode: "abrosexual", description: "Verde, blanco y rosa inspirados en la bandera abrosexual.", colors: ["#54a878", "#e98db7"], preview: "linear-gradient(135deg,#54a878 0%,#dff3e5 35%,#ffffff 50%,#f6c8dc 65%,#e98db7 100%)" },
    { id: "paleontology", name: "Paleontología", cost: 0, creatorCode: "dinosauriogrr", description: "Verde helecho, arena y tonos de fósil para amantes de los dinosaurios.", colors: ["#345b3b", "#d8c49a"], preview: "linear-gradient(135deg,#203d2b 0%,#54784a 45%,#d8c49a 100%)" },
    { id: "halloween2026", name: "Halloween 2026", cost: 0, creatorCode: "halloween2026", seasonal: "halloween", description: "Noche embrujada: carbón, calabaza, violeta y detalles fantasmales. Disponible del 25 al 31 de octubre de 2026.", colors: ["#ff7518", "#32104a"], preview: "linear-gradient(135deg,#12091f 0%,#5b217d 45%,#ff7518 46%,#ffb347 100%)" },
    { id: "navidad2026", name: "Navidad 2026", cost: 0, creatorCode: "Navidad2026", seasonal: "christmas", description: "Verde pino, rojo cereza, nieve y detalles dorados. Disponible del 1 al 31 de diciembre de 2026.", colors: ["#0f5132", "#c62828"], preview: "linear-gradient(135deg,#073b2a 0%,#0f7a4a 48%,#b51f32 49%,#f2c14e 100%)" },
    { id: "retro", name: "Retro", cost: 0, creatorCode: "v3.6", seasonal: "retro", description: "Interfaz clásica inspirada en Windows 7: cristal azul Aero, bordes brillantes, botones degradados y tipografía Segoe UI. Disponible hasta el 1 de enero de 2027.", colors: ["#d97736", "#f2dfb3"], preview: "linear-gradient(135deg,#d9f1ff 0%,#4c9bd5 28%,#1b5b96 58%,#dcefff 100%)" },
    { id: "hearts", name: "Corazones", cost: 15, description: "Rosas, corazones y detalles románticos.", colors: ["#c02669", "#ffe4ef"], preview: "linear-gradient(135deg,#6d123f,#e84383 55%,#ffe4ef)" },
    { id: "sea-life", name: "Vida marina", cost: 18, description: "Un océano decorado con peces, burbujas y olas.", colors: ["#075985", "#67e8f9"], preview: "linear-gradient(135deg,#082f49,#0284c7 55%,#67e8f9)" },
    { id: "accounting", name: "Contabilidad", cost: 20, description: "Libros contables, calculadoras, gráficas y símbolos financieros.", colors: ["#166534", "#dcfce7"], preview: "linear-gradient(135deg,#14532d,#16a34a 55%,#dcfce7)" },
    { id: "cyberpunk", name: "Cyberpunk", cost: 0, description: "Neón cian y violeta con una estética futurista.", colors: ["#21113f", "#22e6e6", "#ff4fd8"], preview: "linear-gradient(135deg,#120b25 0%,#542080 48%,#22e6e6 100%)" },
    { id: "galaxy", name: "Galaxia", cost: 0, description: "Azules cósmicos, violeta y luz estelar.", colors: ["#101637", "#7256d8", "#75d7ff"], preview: "linear-gradient(135deg,#080e2c 0%,#493c9a 55%,#75d7ff 100%)" },
    { id: "vaporwave", name: "Vaporwave", cost: 0, description: "Rosa, naranja y morado retro.", colors: ["#ff6eb4", "#8c5cff", "#ffb45e"], preview: "linear-gradient(135deg,#ff6eb4 0%,#8c5cff 55%,#ffb45e 100%)" }
  ];

  const APP_VERSION = { name: "3.7.01", code: 18, buildDate: "26 de octubre de 2026" };

  function seasonalThemeIsAvailable(theme, date = today()) {
    if (!theme?.seasonal) return true;
    if (theme.seasonal === "halloween") return date >= "2026-10-25" && date <= "2026-10-31";
    if (theme.seasonal === "christmas") return date >= "2026-12-01" && date <= "2026-12-31";
    if (theme.seasonal === "retro") return date >= "2026-10-25" && date <= "2027-01-01";
    return false;
  }

  function expireSeasonalThemes() {
    const current = THEMES.find(theme => theme.id === data.settings.theme && theme.seasonal);
    if (current && !seasonalThemeIsAvailable(current)) {
      const fallback = data.settings.previousThemeBeforeSeasonal;
      data.settings.theme = THEMES.some(theme => theme.id === fallback && !theme.seasonal) ? fallback : "classic";
      delete data.settings.previousThemeBeforeSeasonal;
    }
    const expiredIds = THEMES.filter(theme => theme.seasonal && !seasonalThemeIsAvailable(theme)).map(theme => theme.id);
    if (expiredIds.length) data.gamification.purchasedThemes = data.gamification.purchasedThemes.filter(id => id === "retro" || !expiredIds.includes(id));
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.error("No se pudo actualizar el tema de temporada:", e); }
  }

  function saleDates() {
    return [...new Set(data.sales.map(s => s.date).filter(Boolean))].sort();
  }

  function streakInfo() {
    const dates = new Set(saleDates());
    let count = 0;
    let cursor = today();
    if (!dates.has(cursor)) cursor = addDays(cursor, -1);
    while (dates.has(cursor)) {
      count++;
      cursor = addDays(cursor, -1);
    }
    const startDate = count ? addDays(cursor, 1) : "";
    const day = Number(today().slice(8, 10));
    const monthPrefix = today().slice(0, 7);
    const daysInMonth = new Date(Number(today().slice(0, 4)), Number(today().slice(5, 7)), 0).getDate();
    let monthCount = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const date = `${monthPrefix}-${String(i).padStart(2, "0")}`;
      if (dates.has(date)) monthCount++;
    }
    const fullMonth = monthCount === daysInMonth;
    return { dates, count, startDate, daysInMonth, monthCount, fullMonth, day };
  }

  function updateStreakRewards(saleRegisteredToday = false) {
    if (!data.gamification) data.gamification = { coins: 0, rewardedMilestones: [], purchasedThemes: ["classic"] };
    if (!Array.isArray(data.gamification.rewardedMilestones)) data.gamification.rewardedMilestones = [];
    // Una moneda por día, solo al registrar al menos una venta con fecha de hoy.
    if (!saleRegisteredToday || !data.sales.some(s => s.date === today())) return;
    const dailyReward = `daily:${today()}`;
    if (!data.gamification.rewardedMilestones.includes(dailyReward)) {
      data.gamification.rewardedMilestones.push(dailyReward);
      data.gamification.coins += 1;
    }
  }

  function renderStreak() {
    const el = $("streakCount");
    if (!el) return;
    const info = streakInfo();
    $("streakCount").textContent = String(info.count);
    $("streakMessage").textContent = info.count
      ? `¡Bien hecho! ${info.monthCount} de ${info.daysInMonth} días con ventas este mes. Registra una venta hoy para mantenerla.`
      : "Registra al menos una venta hoy para comenzar o recuperar tu racha.";
    const progress = info.count % 7;
    const percent = info.fullMonth ? 100 : (progress / 7) * 100;
    $("streakProgress").style.width = `${percent}%`;
    const rewardedToday = data.gamification.rewardedMilestones.includes(`daily:${today()}`);
    $("streakProgressText").textContent = rewardedToday
      ? "Moneda de hoy ganada · vuelve mañana para mantener la racha"
      : "Registra una venta hoy para ganar 1 moneda";
    $("streakCalendar").innerHTML = Array.from({ length: info.daysInMonth }, (_, idx) => {
      const d = idx + 1;
      const date = `${today().slice(0, 7)}-${String(d).padStart(2, "0")}`;
      const active = info.dates.has(date);
      return `<span class="calendar-day ${active ? "has-sale" : ""} ${date === today() ? "is-today" : ""}" title="${date}${active ? ": venta registrada" : ""}">${d}</span>`;
    }).join("");
  }

  function periodBounds(period) {
    const end = today();
    if (period === "today") return { from: end, to: end, days: 1, label: "Hoy" };
    if (period === "month") {
      const from = `${end.slice(0, 7)}-01`;
      return { from, to: end, days: Math.max(1, Math.round((new Date(end + "T12:00:00") - new Date(from + "T12:00:00")) / 86400000) + 1), label: "Este mes" };
    }
    if (period === "all") {
      const dates = [...data.sales, ...data.expenses].map(x => x.date).filter(Boolean).sort();
      const from = dates[0] || end;
      const days = Math.max(1, Math.round((new Date(end + "T12:00:00") - new Date(from + "T12:00:00")) / 86400000) + 1);
      return { from, to: end, days, label: "Todo" };
    }
    const days = Number(period) || 7;
    return { from: addDays(end, -(days - 1)), to: end, days, label: `Últimos ${days} días` };
  }

  function periodSeries(from, to) {
    const dates = [];
    let d = from;
    while (d <= to && dates.length < 4000) {
      dates.push(d);
      d = addDays(d, 1);
    }
    return {
      dates,
      revenue: dates.map(date => data.sales.filter(s => s.date === date).reduce((sum, s) => sum + s.price * s.qty, 0)),
      costs: dates.map(date => data.sales.filter(s => s.date === date).reduce((sum, s) => sum + s.cost * s.qty, 0)),
      gross: dates.map(date => data.sales.filter(s => s.date === date).reduce((sum, s) => sum + (s.price - s.cost) * s.qty, 0)),
      expenses: dates.map(date => data.expenses.filter(e => e.date === date).reduce((sum, e) => sum + e.amount, 0))
    };
  }

  function rangeValues(values) {
    return values.length ? { max: Math.max(...values), min: Math.min(...values) } : { max: 0, min: 0 };
  }

  function renderStatistics() {
    if (!$("statsPeriod")) return;
    const p = periodBounds($("statsPeriod").value);
    const t = totals(p.from, p.to);
    const units = t.ss.reduce((sum, s) => sum + s.qty, 0);
    const byDay = {};
    t.ss.forEach(s => { byDay[s.date] = (byDay[s.date] || 0) + 1; });
    const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    const expenseRange = rangeValues(t.es.map(e => e.amount));
    const costRange = rangeValues(t.ss.map(s => s.cost * s.qty));
    const grossRange = rangeValues(t.ss.map(s => (s.price - s.cost) * s.qty));
    $("statUnits").textContent = String(units);
    $("statTransactions").textContent = String(t.ss.length);
    $("statTransactionsLabel").textContent = p.label;
    $("statBestSalesDay").textContent = String(best ? best[1] : 0);
    $("statBestSalesDate").textContent = best ? `${best[0]} (${best[1]} operaciones)` : "Sin ventas";
    $("statExpenseRange").textContent = `${money(expenseRange.max)} / ${money(expenseRange.min)}`;
    $("statCostRange").textContent = `${money(costRange.max)} / ${money(costRange.min)}`;
    $("statGrossRange").textContent = `${money(grossRange.max)} / ${money(grossRange.min)}`;

    const current = periodSeries(p.from, p.to);
    const prevTo = addDays(p.from, -1);
    const prevFrom = addDays(prevTo, -(p.days - 1));
    const previous = periodSeries(prevFrom, prevTo);
    $("statsCompareLabel").textContent = `${p.label} vs. ${prevFrom} al ${prevTo}`;

    if (window.Chart) {
      if (comparisonChart) comparisonChart.destroy();
      comparisonChart = new Chart($("comparisonChart"), {
        type: "bar",
        data: { labels: ["Ventas", "Costos", "Utilidad bruta", "Gastos"], datasets: [
          { label: "Periodo actual", data: [t.revenue, t.costs, t.gross, t.expenseTotal], backgroundColor: "#d4a72c", borderRadius: 5 },
          { label: "Periodo anterior", data: [
            previous.revenue.reduce((a,b)=>a+b,0),
            previous.costs.reduce((a,b)=>a+b,0),
            previous.gross.reduce((a,b)=>a+b,0),
            previous.expenses.reduce((a,b)=>a+b,0)
          ], backgroundColor: "#64748b", borderRadius: 5 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } }
      });
      if (statsMoneyChart) statsMoneyChart.destroy();
      statsMoneyChart = new Chart($("statsMoneyChart"), {
        type: "line",
        data: { labels: current.dates.map(d => d.slice(5)), datasets: [
          { label: "Ventas", data: current.revenue, borderColor: "#d4a72c", tension: .25 },
          { label: "Costo de ventas", data: current.costs, borderColor: "#64748b", tension: .25 },
          { label: "Utilidad bruta", data: current.gross, borderColor: "#16a34a", tension: .25 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } }
      });
      if (statsExpenseChart) statsExpenseChart.destroy();
      statsExpenseChart = new Chart($("statsExpenseChart"), {
        type: "bar",
        data: { labels: current.dates.map(d => d.slice(5)), datasets: [
          { label: "Gastos", data: current.expenses, backgroundColor: "#f97316", borderRadius: 4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }
  }

  function applyTheme() {
    expireSeasonalThemes();
    renderShop();
    const theme = THEMES.find(t => t.id === data.settings.theme && seasonalThemeIsAvailable(t)) || THEMES[0];
    document.documentElement.dataset.appTheme = theme.id;
    // Aplica primero el modo elegido para que cada tema use su paleta clara u oscura.
    document.documentElement.dataset.mode = data.settings.mode === "dark" ? "dark" : "light";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme.colors[0];
  }

  function renderShop() {
    if (!$ ("themeShop")) return;
    $("fireCoins").textContent = String(data.gamification.coins);
    $("themeShop").innerHTML = THEMES.filter(theme => seasonalThemeIsAvailable(theme)).map(theme => {
      const owned = data.gamification.purchasedThemes.includes(theme.id);
      const active = data.settings.theme === theme.id;
      const lockedCreatorTheme = Boolean(theme.creatorCode) && !owned;
      const action = lockedCreatorTheme ? "Desbloquear con código" : active ? "Tema activo" : owned ? "Aplicar tema" : theme.cost === 0 ? "Obtener gratis" : `Comprar · ${theme.cost} 🔥`;
      const price = lockedCreatorTheme ? "Bloqueado" : (theme.creatorCode && owned) ? "Desbloqueado gratis" : theme.cost === 0 ? "Gratis" : `${theme.cost} 🔥`;
      const previewIcons = {
        classic: "🏪", ocean: "🌊🐟", forest: "🌲🍃", violet: "💜✨", sunset: "🌅☀️",
        hacker: "💻⌨️{ }", nature: "🌿🦋", cbtis36: "🏫📚✏️", "bandera-bi": "💗💜💙",
        atardecer: "🌇🟠", eclipse: "🌑✨", "tech-blue": "🔷💠⚡", pride: "🏳️‍🌈",
        trans: "🏳️‍⚧️", abrosexual: "💚🤍💗", paleontology: "🦴🦖🦴",
        halloween2026: "🎃🕸️💀👻", navidad2026: "🎄❄️🎁", retro: "🖥️💿",
        hearts: "💗💖💕", "sea-life": "🐠🐟🫧", accounting: "🧾📊🧮", cyberpunk: "🌃⚡", galaxy: "🌌✨", vaporwave: "🌅💿"
      };
      return `<article class="theme-card ${active ? "theme-active" : ""} ${lockedCreatorTheme ? "theme-locked" : ""}">
        <div class="theme-preview theme-preview-${theme.id}" style="background:${theme.preview}" role="img" aria-label="Vista previa de ${escapeHtml(theme.name)}">
          <span class="preview-art" aria-hidden="true">${previewIcons[theme.id] || "🎨"}</span>
          <span class="preview-palette" aria-hidden="true">${theme.colors.map(color => `<i style="background:${color}"></i>`).join("")}</span>
        </div>
        <div class="theme-card-body"><h3>${escapeHtml(theme.name)}</h3><p>${escapeHtml(theme.description)}</p>
        <div class="theme-card-footer"><strong>${price}</strong>
        <button class="button ${active || lockedCreatorTheme ? "secondary" : ""}" data-theme-action="${theme.id}" ${active || lockedCreatorTheme ? "disabled" : ""}>${action}</button></div></div>
      </article>`;
    }).join("");
  }

  function handleThemeAction(id) {
    const theme = THEMES.find(t => t.id === id);
    if (!theme) return;
    if (!seasonalThemeIsAvailable(theme)) { toast("Este tema solo está disponible durante su temporada."); renderShop(); return; }
    const owned = data.gamification.purchasedThemes.includes(id);
    if (theme.creatorCode && !owned) {
      toast("Este tema está bloqueado. Ve a Ajustes → Desbloquear temas e introduce el código recibido.");
      return;
    }
    if (!owned) {
      if (theme.cost === 0) {
        data.gamification.purchasedThemes.push(id);
      } else {
        if (data.gamification.coins < theme.cost) {
          toast(`Necesitas ${theme.cost} monedas de fuego para comprar este tema.`);
          return;
        }
        if (!confirm(`¿Comprar "${theme.name}" por ${theme.cost} monedas de fuego?`)) return;
        data.gamification.coins -= theme.cost;
        data.gamification.purchasedThemes.push(id);
      }
    }
    if (theme.seasonal) {
      if (!THEMES.find(item => item.id === data.settings.theme)?.seasonal) data.settings.previousThemeBeforeSeasonal = data.settings.theme || "classic";
    } else {
      delete data.settings.previousThemeBeforeSeasonal;
    }
    data.settings.theme = id;
    applyTheme();
    save();
    toast(owned || theme.cost === 0 ? `Tema "${theme.name}" aplicado.` : `¡Compraste "${theme.name}"!`);
  }

  function redeemCreatorCode() {
    const input = $("creatorThemeCode");
    const message = $("creatorCodeMessage");
    const code = String(input?.value || "").trim().toLowerCase();
    const theme = THEMES.find(item => item.creatorCode && item.creatorCode.toLowerCase() === code);
    if (!code) {
      if (message) message.textContent = "Escribe un código antes de canjearlo.";
      toast("Escribe un código de creador.");
      return;
    }
    if (!theme || !seasonalThemeIsAvailable(theme)) {
      if (message) message.textContent = theme ? "Este código solo se puede usar durante su temporada." : "Código no válido. Revisa que esté escrito correctamente.";
      toast("Código no válido.");
      return;
    }
    if (data.gamification.purchasedThemes.includes(theme.id)) {
      if (message) message.textContent = `El tema ${theme.name} ya está desbloqueado.`;
      toast("Ese tema ya estaba desbloqueado.");
      input.value = "";
      return;
    }
    data.gamification.purchasedThemes.push(theme.id);
    save();
    if (message) message.textContent = `¡Código aceptado! ${theme.name} se desbloqueó gratis. Abre la Tienda de temas para activarlo.`;
    if (input) input.value = "";
    toast(`¡${theme.name} desbloqueado gratis!`);
  }
  $("redeemCreatorCode")?.addEventListener("click", redeemCreatorCode);
  $("creatorThemeCode")?.addEventListener("keydown", event => {
    if (event.key === "Enter") redeemCreatorCode();
  });

  // Herramientas locales de desarrollador para pruebas de la tienda. No es una barrera de seguridad: el código vive en el cliente.
  const DEVELOPER_TEST_CODE = "Developer3.6";
  $("developerAccessButton")?.addEventListener("click", () => {
    const entered = String($("developerAccessCode")?.value || "").trim();
    const status = $("developerAccessStatus");
    if (entered !== DEVELOPER_TEST_CODE) {
      if (status) status.textContent = "Código incorrecto.";
      toast("Código de desarrollador incorrecto.");
      return;
    }
    $("developerTools")?.classList.remove("hidden");
    if (status) status.textContent = "Acceso de pruebas habilitado en este dispositivo.";
    if ($("developerAccessCode")) $("developerAccessCode").value = "";
  });
  $("developerInfiniteCoins")?.addEventListener("click", () => {
    if (!$("developerTools") || $("developerTools").classList.contains("hidden")) return;
    data.gamification.coins = 999999999;
    save();
    renderShop();
    toast("Saldo máximo de prueba cargado. Puedes comprar todos los temas.");
  });
  $("developerHideTools")?.addEventListener("click", () => $("developerTools")?.classList.add("hidden"));

  $("themeShop")?.addEventListener("click", e => {
    const button = e.target.closest("[data-theme-action]");
    if (button) handleThemeAction(button.dataset.themeAction);
  });
  $("statsPeriod")?.addEventListener("change", renderStatistics);

  function renderNotes() {
    const list = $("notesList");
    if (!list) return;
    if (!Array.isArray(data.notes) || !data.notes.length) {
      list.innerHTML = '<article class="panel empty">Todavía no tienes notas. Escribe una arriba para guardar tu primer recordatorio.</article>';
      return;
    }
    list.innerHTML = data.notes.slice().reverse().map(note => `
      <article class="note-card">
        <p>${escapeHtml(note.text || "")}</p>
        <footer><time>${escapeHtml(note.date || "")}</time><button class="row-button danger" type="button" data-delete-note="${escapeHtml(note.id)}">Eliminar</button></footer>
      </article>`).join("");
  }

  function renderAll() {
    renderProducts();
    renderSales();
    renderExpenses();
    renderDashboard();
    renderReport();
    renderStreak();
    renderStatistics();
    renderShop();
    renderNotes();
    applyTheme();
    renderSystemVersion();
  }

  function updateSalePreview() {
    const p = product($("saleProduct").value);
    const qty = Math.max(0, num("saleQty"));
    const price = $("salePrice").value === "" ? (p ? p.price : 0) : num("salePrice");

    $("saleStock").textContent = p ? String(p.stock) : "—";
    $("saleTotal").textContent = money(qty * price);

    if (p && $("salePrice").value === "") $("salePrice").value = p.price;
  }

  function go(view) {
    document.querySelectorAll(".view").forEach(v =>
      v.classList.toggle("hidden", v.id !== "view-" + view)
    );
    document.querySelectorAll(".tab").forEach(b =>
      b.classList.toggle("active", b.dataset.view === view)
    );
    document.querySelectorAll(".menu-item").forEach(b =>
      b.classList.toggle("active", b.dataset.view === view)
    );
    const menu = $("moreMenu");
    const menuButton = $("moreMenuButton");
    if (menu) menu.classList.add("hidden");
    if (menuButton) menuButton.setAttribute("aria-expanded", "false");
    if (view === "notes") renderNotes();
    if (view === "dashboard") { renderDashboard(); renderStreak(); }
    if (view === "reports") renderReport();
    if (view === "statistics") renderStatistics();
    if (view === "shop") renderShop();
    if (view === "taxes") updateTax();
    if (view === "version") renderSystemVersion();
  }

  function renderSystemVersion() {
    const version = $("appVersionLabel");
    if (version) version.textContent = `Versión ${APP_VERSION.name}`;
    const build = $("appBuildNumber");
    const date = $("appBuildDate");
    if (build) build.textContent = String(APP_VERSION.code);
    if (date) date.textContent = APP_VERSION.buildDate;
  }

  document.querySelectorAll(".tab").forEach(b =>
    b.addEventListener("click", () => go(b.dataset.view))
  );
  document.querySelectorAll(".menu-item").forEach(b =>
    b.addEventListener("click", () => go(b.dataset.view))
  );

  document.querySelectorAll("[data-goto]").forEach(b =>
    b.addEventListener("click", () => go(b.dataset.goto))
  );

  const moreMenuButton = $("moreMenuButton");
  const moreMenu = $("moreMenu");
  if (moreMenuButton && moreMenu) {
    moreMenuButton.addEventListener("click", () => {
      const open = moreMenu.classList.contains("hidden");
      moreMenu.classList.toggle("hidden", !open);
      moreMenuButton.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", e => {
      if (!e.target.closest(".more-menu-wrap")) {
        moreMenu.classList.add("hidden");
        moreMenuButton.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        moreMenu.classList.add("hidden");
        moreMenuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  if ($("addNote")) {
    $("addNote").addEventListener("click", () => {
      const text = ($("noteText").value || "").trim();
      if (!text) { toast("Escribe una nota antes de guardarla."); return; }
      if (!Array.isArray(data.notes)) data.notes = [];
      data.notes.push({ id: uid(), text: text.slice(0, 2000), date: today() });
      $("noteText").value = "";
      save();
      toast("Nota guardada.");
    });
  }
  if ($("notesList")) {
    $("notesList").addEventListener("click", e => {
      const button = e.target.closest("[data-delete-note]");
      if (!button) return;
      if (!confirm("¿Eliminar esta nota?")) return;
      data.notes = (data.notes || []).filter(note => note.id !== button.dataset.deleteNote);
      save();
      toast("Nota eliminada.");
    });
  }

  $("productForm").addEventListener("submit", e => {
    e.preventDefault();

    const id = $("productId").value;
    const name = $("productName").value.trim();
    const materials = num("productMaterials");
    const labor = num("productLabor");
    const price = num("productPrice");
    const stock = num("productStock");
    const minStock = num("productMinStock");
    const barcode = ($("productBarcode")?.value || "").trim().slice(0, 80);

    if (!name || [materials, labor, price, stock, minStock].some(v => v < 0) ||
        !Number.isInteger(stock) || !Number.isInteger(minStock)) {
      toast("Revisa los datos del producto.");
      return;
    }

    if (id) {
      const p = product(id);
      if (!p) return;

      p.name = name;
      p.materials = materials;
      p.labor = labor;
      p.price = price;
      p.minStock = minStock;
      p.barcode = barcode;
      p.favorite = Boolean($("productFavorite")?.checked);
      if (pendingProductImage) p.image = pendingProductImage;

      const diff = stock - p.stock;
      if (diff !== 0) {
        p.stock = stock;
        data.stockMoves.push({
          id: uid(), date: today(), productId: id, name,
          typeLabel: "Ajuste por edición", qty: Math.abs(diff),
          reason: "Actualización de existencias"
        });
      }
      toast("Producto actualizado.");
    } else {
      data.products.push({
        id: uid(), name, materials, labor, price, stock, minStock, barcode,
        image: pendingProductImage || "", favorite: Boolean($("productFavorite")?.checked), createdAt: today()
      });
      toast("Producto agregado.");
    }

    $("productForm").reset();
    pendingProductImage = "";
    if ($("productImageFile")) $("productImageFile").value = "";
    $("productId").value = "";
    if ($("productBarcode")) $("productBarcode").value = "";
    $("productLabor").value = "0";
    $("productStock").value = "0";
    $("productMinStock").value = "3";
    $("productSubmit").textContent = "Agregar producto";
    $("cancelProductEdit").classList.add("hidden");
    save();
  });

  $("cancelProductEdit").addEventListener("click", () => {
    pendingProductImage = "";
    if ($("productImageFile")) $("productImageFile").value = "";
    $("productForm").reset();
    $("productId").value = "";
    if ($("productBarcode")) $("productBarcode").value = "";
    $("productLabor").value = "0";
    $("productStock").value = "0";
    $("productMinStock").value = "3";
    $("productSubmit").textContent = "Agregar producto";
    $("cancelProductEdit").classList.add("hidden");
  });

  $("productRows").addEventListener("click", e => {
    const favorite = e.target.closest("[data-favorite-product]");
    const edit = e.target.closest("[data-edit-product]");
    const del = e.target.closest("[data-delete-product]");
    if (favorite) { const p = product(favorite.dataset.favoriteProduct); if (p) { p.favorite = !p.favorite; save(); toast(p.favorite ? "Producto añadido a favoritos." : "Producto quitado de favoritos."); } return; }

    if (edit) {
      const p = product(edit.dataset.editProduct);
      if (!p) return;

      $("productId").value = p.id;
      $("productName").value = p.name;
      if ($("productFavorite")) $("productFavorite").checked = Boolean(p.favorite);
      pendingProductImage = p.image || "";
      if ($("productBarcode")) $("productBarcode").value = p.barcode || "";
      $("productMaterials").value = p.materials;
      $("productLabor").value = p.labor;
      $("productPrice").value = p.price;
      $("productStock").value = p.stock;
      $("productMinStock").value = p.minStock;
      $("productSubmit").textContent = "Guardar cambios";
      $("cancelProductEdit").classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (del) {
      const id = del.dataset.deleteProduct;
      if (data.sales.some(s => s.productId === id)) {
        toast("No se puede eliminar: tiene ventas relacionadas.");
        return;
      }
      if (confirm("¿Eliminar este producto?")) {
        data.products = data.products.filter(p => p.id !== id);
        save();
        toast("Producto eliminado.");
      }
    }
  });

  $("stockForm").addEventListener("submit", e => {
    e.preventDefault();

    const p = product($("stockProduct").value);
    const qty = num("stockQty");
    const type = $("stockType").value;
    const reason = $("stockReason").value.trim();

    if (!p || !Number.isInteger(qty) || qty < 1) {
      toast("Selecciona producto y cantidad válida.");
      return;
    }
    if (type === "out" && qty > p.stock) {
      toast("No hay suficientes existencias para esa salida.");
      return;
    }

    const old = p.stock;
    if (type === "in") p.stock += qty;
    else if (type === "out") p.stock -= qty;
    else p.stock = qty;

    data.stockMoves.push({
      id: uid(), date: today(), productId: p.id, name: p.name,
      typeLabel: type === "in" ? "Entrada" : type === "out" ? "Salida / pérdida" : "Ajuste",
      qty: Math.abs(p.stock - old), reason: reason || "Sin especificar"
    });

    $("stockForm").reset();
    save();
    toast("Inventario actualizado.");
  });

  $("saleProduct").addEventListener("change", () => {
    $("salePrice").value = product($("saleProduct").value)?.price ?? "";
    updateSalePreview();
  });
  $("saleQty").addEventListener("input", updateSalePreview);
  $("salePrice").addEventListener("input", updateSalePreview);

  $("saleForm").addEventListener("submit", e => {
    e.preventDefault();

    const p = product($("saleProduct").value);
    const qty = num("saleQty");
    const price = num("salePrice");
    const date = $("saleDate").value;

    if (!p || !Number.isInteger(qty) || qty < 1 || price < 0 || !date) {
      toast("Revisa los datos de la venta.");
      return;
    }
    if (qty > p.stock) {
      toast("Inventario insuficiente. Disponibles: " + p.stock);
      return;
    }

    p.stock -= qty;
    data.sales.push({
      id: uid(), productId: p.id, name: p.name,
      qty, price, cost: productCost(p), date
    });
    data.stockMoves.push({
      id: uid(), date, productId: p.id, name: p.name,
      typeLabel: "Venta", qty, reason: "Descuento automático"
    });

    $("saleQty").value = "1";
    save({ saleRegisteredToday: date === today() });
    toast(date === today() ? "Venta registrada. Las ventas de hoy cuentan para tu racha." : "Venta registrada e inventario actualizado.");
  });

  $("saleRows").addEventListener("click", e => {
    const b = e.target.closest("[data-delete-sale]");
    if (!b) return;
    if (!confirm("¿Eliminar esta venta? Se devolverán las unidades al inventario.")) return;

    const s = data.sales.find(x => x.id === b.dataset.deleteSale);
    if (!s) return;

    const p = product(s.productId);
    if (p) p.stock += s.qty;

    data.sales = data.sales.filter(x => x.id !== s.id);
    data.stockMoves.push({
      id: uid(), date: today(), productId: s.productId, name: s.name,
      typeLabel: "Reversión de venta", qty: s.qty, reason: "Venta eliminada"
    });

    save();
    toast("Venta eliminada y stock restaurado.");
  });

  function resetExpenseForm() {
    editingExpenseId = null;
    $("expenseForm").reset();
    $("expenseDate").value = today();
    $("expenseSubmitButton").textContent = "Agregar gasto";
    $("cancelExpenseEdit").classList.add("hidden");
  }

  $("cancelExpenseEdit").addEventListener("click", resetExpenseForm);

  $("expenseForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("expenseName").value.trim();
    const amount = num("expenseAmount");
    const date = $("expenseDate").value;
    if (!name || amount <= 0 || !date) {
      toast("Revisa los datos del gasto.");
      return;
    }
    if (editingExpenseId) {
      const item = data.expenses.find(x => x.id === editingExpenseId);
      if (!item) { resetExpenseForm(); return; }
      item.name = name;
      item.amount = amount;
      item.date = date;
      item.type = $("expenseType").value;
      resetExpenseForm();
      save();
      toast("Gasto actualizado.");
      return;
    }
    data.expenses.push({ id: uid(), name, amount, date, type: $("expenseType").value });
    resetExpenseForm();
    save();
    toast("Gasto agregado.");
  });

  $("expenseRows").addEventListener("click", e => {
    const edit = e.target.closest("[data-edit-expense]");
    const remove = e.target.closest("[data-delete-expense]");
    if (edit) {
      const item = data.expenses.find(x => x.id === edit.dataset.editExpense);
      if (!item) return;
      editingExpenseId = item.id;
      $("expenseName").value = item.name;
      $("expenseAmount").value = item.amount;
      $("expenseDate").value = item.date;
      $("expenseType").value = item.type || "variable";
      $("expenseSubmitButton").textContent = "Guardar cambios";
      $("cancelExpenseEdit").classList.remove("hidden");
      $("expenseName").focus();
      return;
    }
    if (remove && confirm("¿Eliminar este gasto?")) {
      data.expenses = data.expenses.filter(x => x.id !== remove.dataset.deleteExpense);
      if (editingExpenseId === remove.dataset.deleteExpense) resetExpenseForm();
      save();
      toast("Gasto eliminado.");
    }
  });

  $("productSearch").addEventListener("input", renderProducts);
  $("dashboardPeriod").addEventListener("change", renderDashboard);
  $("reportFrom").addEventListener("change", renderReport);
  $("reportTo").addEventListener("change", renderReport);

  function csvEscape(v) {
    return '"' + String(v ?? "").replace(/"/g, '""') + '"';
  }
  
function downloadCsv() {
  const rows = [
    ["Moneda ISO 4217", data.settings.currency],
    [],
    ["Tipo", "Fecha", "Producto o concepto", "Cantidad", "Precio o monto", "Costo unitario", "Total"]
  ];

  data.products.forEach(p =>
    rows.push(["Producto", p.createdAt, p.name, p.stock, p.price, productCost(p), ""])
  );

  data.sales.forEach(s =>
    rows.push(["Venta", s.date, s.name, s.qty, s.price, s.cost, s.qty * s.price])
  );

  data.expenses.forEach(e =>
    rows.push(["Gasto", e.date, e.name, "", e.amount, "", e.amount])
  );

  data.stockMoves.forEach(m =>
    rows.push(["Inventario: " + m.typeLabel, m.date, m.name, m.qty, "", "", m.reason])
  );

  const csv = "\uFEFF" + rows
    .map(row => row.map(csvEscape).join(","))
    .join("\r\n");

  if (window.AndroidFiles && typeof window.AndroidFiles.saveBase64 === "function") {
    const base64 = btoa(unescape(encodeURIComponent(csv)));
    window.AndroidFiles.saveBase64(
      "mi-primer-negocio-36.csv",
      "text/csv",
      base64
    );
  } else {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mi-primer-negocio-36.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

  
  $("exportCsv").addEventListener("click", downloadCsv);
  $("exportCsvTop").addEventListener("click", downloadCsv);

  function generatePdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      toast("No se pudo cargar el generador PDF. Revisa jspdf.umd.min.js.");
      return;
    }

    const { from, to } = reportRange();
    const t = totals(from, to);
    const doc = new window.jspdf.jsPDF();

    doc.setFontSize(18);
    doc.text(data.settings.businessName || "Mi Primer Negocio 36", 14, 18);
    doc.setFontSize(11);
    doc.text(`Reporte de actividad · Moneda: ${data.settings.currency}`, 14, 27);
    doc.text(`Periodo: ${from || "Inicio"} al ${to || "Hoy"}`, 14, 34);

    const lines = [
      ["Ventas totales", money(t.revenue)],
      ["Costo de productos vendidos", money(t.costs)],
      ["Utilidad bruta", money(t.gross)],
      ["Gastos registrados", money(t.expenseTotal)],
      ["Ganancia neta estimada", money(t.net)]
    ];

    let y = 47;
    lines.forEach(([label, value]) => {
      doc.text(label, 14, y);
      doc.text(value, 190, y, { align: "right" });
      y += 9;
    });

    y += 5;
    doc.setFontSize(13);
    doc.text("Resumen por producto", 14, y);
    y += 8;
    doc.setFontSize(9);

    const groups = {};
    t.ss.forEach(s => {
      const g = groups[s.productId] || (groups[s.productId] = {
        name: s.name, qty: 0, revenue: 0, cost: 0
      });
      g.qty += s.qty;
      g.revenue += s.qty * s.price;
      g.cost += s.qty * s.cost;
    });

    doc.text("Producto", 14, y);
    doc.text("Unidades", 105, y);
    doc.text("Ingresos", 135, y);
    doc.text("Utilidad", 190, y, { align: "right" });
    y += 7;

    Object.values(groups).forEach(g => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(g.name).slice(0, 42), 14, y);
      doc.text(String(g.qty), 105, y);
      doc.text(money(g.revenue), 135, y);
      doc.text(money(g.revenue - g.cost), 190, y, { align: "right" });
      y += 7;
    });

    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(8);
    doc.text(
      "Reporte estimado para control escolar. Verifica tus registros antes de tomar decisiones.",
      14, y + 5
    );
    
    const filename = "reporte-mi-primer-negocio-36.pdf";

    if (window.AndroidFiles &&
        typeof window.AndroidFiles.saveBase64 === "function") {
      const dataUri = doc.output("datauristring");
      const base64 = dataUri.substring(dataUri.indexOf(",") + 1);

      window.AndroidFiles.saveBase64(
        filename,
        "application/pdf",
        base64
      );
    } else {
      doc.save(filename);
    }
  }


  $("generatePdf").addEventListener("click", generatePdf);


  function renderBusinessNameDisplay(value) {
    const display = $("businessNameDisplay");
    if (!display) return;
    const name = String(value || "").trim().slice(0, 70);
    display.textContent = name;
    display.classList.toggle("hidden", !name);
  }

  if ($("businessName")) {
    $("businessName").value = data.settings.businessName || "";
    renderBusinessNameDisplay(data.settings.businessName || "");
    $("businessName").addEventListener("input", () => renderBusinessNameDisplay($("businessName").value));
    $("saveBusinessName").addEventListener("click", saveBusinessName);
  }
  if ($("themeMode")) {
    applySavedAppearance();
    $("themeMode").addEventListener("change", () => {
      data.settings.mode = $("themeMode").value === "dark" ? "dark" : "light";
      save();
      applySavedAppearance();
      toast("Apariencia actualizada.");
    });
  }
  if ($("exportBackupPdf")) $("exportBackupPdf").addEventListener("click", exportBackupPdf);
  if ($("importBackupPdf")) $("importBackupPdf").addEventListener("change", e => importBackupPdf(e.target.files && e.target.files[0]));

  function updateTax() {
    const amountInput = $("taxAmount");
    const rateInput = $("taxRate");
    const taxValue = $("taxValue");
    const taxTotal = $("taxTotal");
    if (!amountInput || !rateInput || !taxValue || !taxTotal) return;
    const amount = Math.max(0, Number.parseFloat(amountInput.value) || 0);
    const rate = Math.min(100, Math.max(0, Number.parseFloat(rateInput.value) || 0));
    const tax = Math.round((amount * rate / 100 + Number.EPSILON) * 100) / 100;
    taxValue.textContent = money(tax);
    taxTotal.textContent = money(Math.round((amount + tax + Number.EPSILON) * 100) / 100);
  }
  ["taxAmount", "taxRate"].forEach(id => {
    const field = $(id);
    if (field) {
      field.addEventListener("input", updateTax);
      field.addEventListener("change", updateTax);
    }
  });
  updateTax();

  function parseCsv(text) {
    const rows = []; let row = [], field = "", quoted = false;
    text = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' && quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) { row.push(field); field = ""; }
      else if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); if (row.some(v => v.trim())) rows.push(row);
        row = []; field = "";
      } else field += ch;
    }
    row.push(field); if (row.some(v => v.trim())) rows.push(row);
    return rows;
  }

  $("importCsvTop").addEventListener("click", () => $("importCsvFile").click());
  $("importCsvFile").addEventListener("change", async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("El CSV está vacío o no contiene filas de datos.");
      let headerRow = rows.findIndex(r => r.some(v =>
        ["producto", "producto o concepto", "nombre", "nombre del producto"].includes(String(v).trim().toLowerCase())
      ));
      if (headerRow < 0) headerRow = 0;
      const headers = rows[headerRow].map(x => x.trim().toLowerCase());
      const dataRows = rows.slice(headerRow + 1);
      const idx = (...names) => headers.findIndex(h => names.includes(h));
      const nameIdx = idx("producto", "producto o concepto", "nombre", "nombre del producto", "name");
      const stockIdx = idx("existencias", "stock", "cantidad", "unidades");
      const priceIdx = idx("precio", "precio de venta", "precio o monto", "price");
      const materialsIdx = idx("materiales", "costo de materiales", "costo unitario", "materials", "costo");
      const laborIdx = idx("mano de obra", "labor");
      const minIdx = idx("stock mínimo", "minstock", "mínimo", "min stock");
      const typeIdx = idx("tipo", "type");
      if (nameIdx < 0) throw new Error("No encuentro la columna Producto o Nombre. Usa Producto, Existencias, Precio, Materiales, Mano de obra y Stock mínimo.");
      let added = 0, updated = 0, skipped = 0;
      for (const r of dataRows) {
        const name = (r[nameIdx] || "").trim();
        if (!name) { skipped++; continue; }
        if (typeIdx >= 0 && (r[typeIdx] || "").trim().toLowerCase() !== "producto") { skipped++; continue; }
        const parse = (i, def = 0) => {
          if (i < 0) return def;
          const v = String(r[i] ?? "").trim().replace(/[$\s]/g, "").replace(/,(?=\d{3}(?:\D|$))/g, "");
          const n = Number(v); return Number.isFinite(n) ? n : NaN;
        };
        const stock = stockIdx < 0 ? 0 : parse(stockIdx, 0);
        const price = priceIdx < 0 ? 0 : parse(priceIdx, 0);
        const materials = parse(materialsIdx, 0), labor = parse(laborIdx, 0), minStock = parse(minIdx, 3);
        if ([stock, price, materials, labor, minStock].some(n => !Number.isFinite(n) || n < 0) ||
            !Number.isInteger(stock) || !Number.isInteger(minStock)) { skipped++; continue; }
        const existing = data.products.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.stock = stock; existing.price = price; existing.materials = materials;
          existing.labor = labor; existing.minStock = minStock; updated++;
        } else {
          data.products.push({ id: uid(), name, materials, labor, price, stock, minStock, createdAt: today() });
          added++;
        }
      }
      if (!added && !updated) throw new Error("No se encontraron productos válidos. Revisa los encabezados y los datos.");
      save();
      toast(`CSV importado: ${added} nuevos, ${updated} actualizados, ${skipped} omitidos.`);
    } catch (err) {
      toast(err.message || "No se pudo leer el CSV.");
    } finally { e.target.value = ""; }
  });

  function markNegativeValues() {
    document.querySelectorAll("td, strong, span").forEach(el => {
      const t = (el.textContent || "").trim();
      el.classList.toggle("negative", /(?:^|\s|\()-\s*(?:[$€£]|MXN|USD|EUR)?\s*\d/.test(t));
    });
  }
  const negativeObserver = new MutationObserver(markNegativeValues);
  negativeObserver.observe(document.querySelector("main"), { subtree: true, childList: true, characterData: true });

  const currencySelect = $("currencySelect");
  if (currencySelect) {
    currencySelect.value = data.settings.currency || "MXN";
    currencySelect.addEventListener("change", () => {
      const chosen = currencySelect.value;
      if (!CURRENCY_LOCALES[chosen]) {
        currencySelect.value = data.settings.currency || "MXN";
        toast("Moneda no válida.");
        return;
      }
      data.settings.currency = chosen;
      updateTax();
      save();
      toast("Moneda actualizada a " + chosen + ". No se realizó conversión de importes.");
    });
  }


  function applySavedAppearance() {
    const mode = data.settings.mode === "dark" ? "dark" : "light";
    document.documentElement.dataset.mode = mode;
    const select = $("themeMode");
    if (select) select.value = mode;
    const theme = THEMES.find(item => item.id === data.settings.theme) || THEMES[0];
    document.documentElement.dataset.appTheme = theme.id;
  }

  function saveBusinessName() {
    const name = ($("businessName").value || "").trim().slice(0, 70);
    data.settings.businessName = name;
    renderBusinessNameDisplay(name);
    save();
    toast(name ? "Nombre del negocio guardado." : "Nombre del negocio borrado.");
  }

  function exportBackupPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      toast("No se pudo cargar el generador PDF.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const business = data.settings.businessName || "Mi Primer Negocio 36";
    doc.setFontSize(18);
    doc.text("Respaldo de datos", 14, 18);
    doc.setFontSize(11);
    doc.text(business, 14, 27);
    doc.text("Generado: " + today(), 14, 34);
    doc.text("Productos: " + data.products.length, 14, 43);
    doc.text("Ventas: " + data.sales.length, 14, 50);
    doc.text("Gastos: " + data.expenses.length, 14, 57);
    doc.setFontSize(9);
    doc.text("Este archivo contiene un respaldo interno para Mi Primer Negocio 36.", 14, 68);
    doc.text("No edites ni vuelvas a guardar este PDF con otra aplicación.", 14, 75);

    // El bloque de respaldo se agrega después del PDF; los lectores PDF lo ignoran,
    // pero la app puede recuperarlo sin depender de servicios externos.
    const json = JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const pdfBytes = new Uint8Array(doc.output("arraybuffer"));
    const marker = new TextEncoder().encode("\\nMPN36_BACKUP_V1:" + encoded + "\\n");
    const combined = new Uint8Array(pdfBytes.length + marker.length);
    combined.set(pdfBytes, 0);
    combined.set(marker, pdfBytes.length);
    let binary = "";
    for (let i = 0; i < combined.length; i += 0x8000) {
      binary += String.fromCharCode(...combined.subarray(i, i + 0x8000));
    }
    const base64 = btoa(binary);
    const filename = "respaldo-mi-primer-negocio-36.pdf";
    if (window.AndroidFiles && typeof window.AndroidFiles.saveBase64 === "function") {
      window.AndroidFiles.saveBase64(filename, "application/pdf", base64);
    } else {
      const blob = new Blob([combined], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    toast("Respaldo PDF exportado.");
  }

  async function importBackupPdf(file) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast("El archivo supera el límite de 15 MB.");
      $("importBackupPdf").value = "";
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const match = binary.match(/MPN36_BACKUP_V1:([A-Za-z0-9+/=]+)/);
      if (!match) throw new Error("No contiene un respaldo compatible");
      const restored = JSON.parse(decodeURIComponent(escape(atob(match[1]))));
      if (!restored || !Array.isArray(restored.products) ||
          !Array.isArray(restored.sales) || !Array.isArray(restored.expenses) ||
          !Array.isArray(restored.stockMoves) || !restored.settings) {
        throw new Error("La estructura del respaldo no es válida");
      }
      if (!confirm("Importar este respaldo reemplazará los productos, ventas, gastos y configuración actuales. ¿Continuar?")) return;
      data = {
        ...restored,
        products: restored.products,
        sales: restored.sales,
        expenses: restored.expenses,
        stockMoves: restored.stockMoves,
        notes: Array.isArray(restored.notes) ? restored.notes : [],
        customers: Array.isArray(restored.customers) ? restored.customers : [],
        creditMovements: Array.isArray(restored.creditMovements) ? restored.creditMovements : [],
        cashCuts: Array.isArray(restored.cashCuts) ? restored.cashCuts : [],
        suppliers: Array.isArray(restored.suppliers) ? restored.suppliers : [],
        purchases: Array.isArray(restored.purchases) ? restored.purchases : [],
        settings: { currency: "MXN", mode: "light", ...(restored.settings || {}) },
        gamification: {
          coins: Math.max(0, Number(restored.gamification?.coins) || 0),
          rewardedMilestones: Array.isArray(restored.gamification?.rewardedMilestones) ? restored.gamification.rewardedMilestones : [],
          purchasedThemes: Array.isArray(restored.gamification?.purchasedThemes) ? restored.gamification.purchasedThemes : ["classic"]
        }
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      applySavedAppearance();
      if ($("businessName")) $("businessName").value = data.settings.businessName || "";
      renderAll();
      toast("Respaldo importado correctamente.");
    } catch (err) {
      console.error(err);
      toast("No se pudo importar. Usa un PDF de respaldo creado por esta app.");
    } finally {
      $("importBackupPdf").value = "";
    }
  }



  // ===== Funciones nuevas de la versión 3.6 =====
  let posCart = [];
  let scanStream = null;
  const customerBalance = id => (data.creditMovements || []).filter(m => m.customerId === id).reduce((sum,m) => sum + (m.type === "charge" ? Number(m.amount) : -Number(m.amount)), 0);
  function syncOperationSelects() {
    const customers = data.customers || [], suppliers = data.suppliers || [], products = data.products || [];
    const customerOptions = '<option value="">Selecciona un cliente</option>' + customers.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    ["posCustomer","creditCustomer","debtCustomer"].forEach(id=>{const el=$(id);if(!el)return;const old=el.value;const empty=id==="posCustomer"?'<option value="">Venta sin cliente</option>':'<option value="">Selecciona un cliente</option>';el.innerHTML=empty+customers.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} · saldo ${money(customerBalance(c.id))}</option>`).join("");if(customers.some(c=>c.id===old))el.value=old;});
    const supplierEl=$("purchaseSupplier");if(supplierEl){const old=supplierEl.value;supplierEl.innerHTML='<option value="">Selecciona proveedor</option>'+suppliers.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("");if(suppliers.some(s=>s.id===old))supplierEl.value=old;}
    const productEl=$("purchaseProduct");if(productEl){const old=productEl.value;productEl.innerHTML='<option value="">Selecciona producto</option>'+products.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} · stock ${p.stock}</option>`).join("");if(products.some(p=>p.id===old))productEl.value=old;}
  }
  function renderPosCart(){
    const el=$("posCartList");if(!el)return;
    el.innerHTML=posCart.length?posCart.map(line=>`<div class="pos-cart-row"><div><strong>${escapeHtml(line.name)}</strong><small>${money(line.price)} c/u · stock ${product(line.productId)?.stock ?? 0}</small></div><div class="qty-controls"><button type="button" data-pos-minus="${line.productId}" aria-label="Restar">−</button><strong>${line.qty}</strong><button type="button" data-pos-plus="${line.productId}" aria-label="Sumar">+</button><button type="button" data-pos-remove="${line.productId}" aria-label="Quitar">×</button></div><strong>${money(line.qty*line.price)}</strong></div>`).join(""):'<p class="muted">El carrito está vacío.</p>';
    $("posTotal").textContent=money(posCart.reduce((s,l)=>s+l.qty*l.price,0));
  }
  function findPosProduct(){const q=($("posSearch")?.value||"").trim().toLowerCase();if(!q)return null;return data.products.find(p=>String(p.barcode||"").toLowerCase()===q)||data.products.find(p=>p.name.toLowerCase()===q)||data.products.find(p=>p.name.toLowerCase().includes(q));}
  function addPosProduct(){const p=findPosProduct();if(!p){toast("No encontré el producto. Revisa el nombre o registra su código de barras en Productos.");return;}if(p.stock<=0){toast("Este producto no tiene existencias.");return;}const line=posCart.find(x=>x.productId===p.id);if(line){if(line.qty>=p.stock){toast("No hay más existencias disponibles.");return;}line.qty++;}else posCart.push({productId:p.id,name:p.name,price:Number(p.price)||0,cost:productCost(p),qty:1});$("posSearch").value="";renderPosCart();}
  $("posAddButton")?.addEventListener("click",addPosProduct);
  $("posSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addPosProduct();}});
  $("posCartList")?.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const id=b.dataset.posPlus||b.dataset.posMinus||b.dataset.posRemove;const line=posCart.find(x=>x.productId===id);if(!line)return;if(b.dataset.posRemove){posCart=posCart.filter(x=>x.productId!==id);}else if(b.dataset.posPlus){const p=product(id);if(p&&line.qty<p.stock)line.qty++;else toast("No hay existencias suficientes.");}else{line.qty--;if(line.qty<=0)posCart=posCart.filter(x=>x.productId!==id);}renderPosCart();});
  $("posCheckout")?.addEventListener("click",()=>{
    if(!posCart.length){toast("Añade productos antes de cobrar.");return;}for(const line of posCart){const p=product(line.productId);if(!p||p.stock<line.qty){toast("El stock cambió. Revisa el carrito.");return;}}
    const payment=$("posPayment").value, customerId=$("posCustomer").value, date=today();if(payment==="fiado"&&!customerId){toast("Para una venta fiada selecciona un cliente.");return;}
    const customer=data.customers.find(c=>c.id===customerId);const total=posCart.reduce((s,l)=>s+l.qty*l.price,0);
    posCart.forEach(line=>{const p=product(line.productId);p.stock-=line.qty;data.sales.push({id:uid(),productId:p.id,name:p.name,qty:line.qty,price:line.price,cost:line.cost,date,payment,customerId:customerId||"",source:"pos"});data.stockMoves.push({id:uid(),date,productId:p.id,name:p.name,typeLabel:"Venta punto de venta",qty:line.qty,reason:payment==="fiado"?`Fiado a ${customer?.name||"cliente"}`:"Punto de venta"});});
    if(payment==="fiado")data.creditMovements.push({id:uid(),customerId,type:"charge",amount:total,date,description:`Venta fiada · ${posCart.map(l=>l.name).join(", ")}`});
    posCart=[];renderPosCart();save({saleRegisteredToday:true});syncOperationSelects();renderOperations();toast(payment==="fiado"?"Venta registrada como fiado.":"Venta cobrada y registrada.");
  });
  function resetCustomerForm(){const form=$("customerForm");if(!form)return;form.reset();$("customerEditId").value="";$("customerInitialDebt").value="0";$("customerInitialDebtWrap").classList.remove("hidden");$("customerSaveButton").textContent="Guardar cliente";$("customerCancelEdit").classList.add("hidden");}
  $("customerForm")?.addEventListener("submit",e=>{e.preventDefault();const id=$("customerEditId").value;const name=$("customerName").value.trim();const phone=$("customerPhone").value.trim();if(!name)return;if(data.customers.some(c=>c.id!==id&&c.name.toLowerCase()===name.toLowerCase())){toast("Ya existe un cliente con ese nombre.");return;}if(id){const customer=data.customers.find(c=>c.id===id);if(!customer){toast("No se encontró el cliente para editar.");resetCustomerForm();return;}customer.name=name;customer.phone=phone;toast("Datos del cliente actualizados.");}else{const customerId=uid();data.customers.push({id:customerId,name,phone,createdAt:today()});const initialDebt=Math.max(0,Number($("customerInitialDebt").value)||0);if(initialDebt>0)data.creditMovements.push({id:uid(),customerId,type:"charge",amount:initialDebt,date:today(),description:"Saldo inicial del cliente"});toast(initialDebt>0?"Cliente guardado con su deuda inicial.":"Cliente guardado.");}resetCustomerForm();save();syncOperationSelects();renderOperations();});
  $("customerCancelEdit")?.addEventListener("click",resetCustomerForm);
  $("customerList")?.addEventListener("click",e=>{const button=e.target.closest("[data-edit-customer]");if(!button)return;const customer=data.customers.find(c=>c.id===button.dataset.editCustomer);if(!customer)return;$("customerEditId").value=customer.id;$("customerName").value=customer.name;$("customerPhone").value=customer.phone||"";$("customerInitialDebtWrap").classList.add("hidden");$("customerSaveButton").textContent="Guardar cambios";$("customerCancelEdit").classList.remove("hidden");$("customerName").focus();$("customerForm").scrollIntoView({behavior:"smooth",block:"center"});});
  $("customerDebtForm")?.addEventListener("submit",e=>{e.preventDefault();const customerId=$("debtCustomer").value;const amount=Number($("debtAmount").value);const description=$("debtDescription").value.trim()||"Deuda agregada manualmente";if(!customerId||!(amount>0)||!Number.isFinite(amount)){toast("Selecciona un cliente e introduce una deuda mayor que cero.");return;}data.creditMovements.push({id:uid(),customerId,type:"charge",amount,date:today(),description});$("debtAmount").value="";$("debtDescription").value="";save();syncOperationSelects();renderOperations();toast("Deuda agregada al saldo del cliente.");});
  $("creditPaymentForm")?.addEventListener("submit",e=>{e.preventDefault();const customerId=$("creditCustomer").value,amount=Number($("creditAmount").value);if(!customerId||!(amount>0)){toast("Selecciona cliente e importe válido.");return;}if(amount>customerBalance(customerId)){toast("El abono supera el saldo pendiente.");return;}data.creditMovements.push({id:uid(),customerId,type:"payment",amount,date:today(),description:"Abono recibido"});$("creditAmount").value="";save();syncOperationSelects();renderOperations();toast("Abono registrado.");});
  $("supplierForm")?.addEventListener("submit",e=>{e.preventDefault();const name=$("supplierName").value.trim();if(!name)return;data.suppliers.push({id:uid(),name,contact:$("supplierContact").value.trim(),createdAt:today()});$("supplierForm").reset();save();syncOperationSelects();renderOperations();toast("Proveedor guardado.");});
  $("purchaseForm")?.addEventListener("submit",e=>{e.preventDefault();const supplierId=$("purchaseSupplier").value,productId=$("purchaseProduct").value,qty=Number($("purchaseQty").value),cost=Number($("purchaseCost").value);const p=product(productId),s=data.suppliers.find(x=>x.id===supplierId);if(!s||!p||!Number.isInteger(qty)||qty<1||cost<0){toast("Revisa proveedor, producto, cantidad y costo.");return;}p.stock+=qty;data.purchases.push({id:uid(),date:today(),supplierId,productId,productName:p.name,qty,cost});data.stockMoves.push({id:uid(),date:today(),productId,name:p.name,typeLabel:"Compra a proveedor",qty,reason:s.name});if(cost>0)data.expenses.push({id:uid(),concept:`Compra de ${p.name} · ${s.name}`,amount:cost,date:today(),category:"Inventario"});$("purchaseForm").reset();$("purchaseQty").value="1";$("purchaseCost").value="0";save();syncOperationSelects();renderOperations();toast("Compra registrada y stock actualizado.");});
  function renderOperations(){
    syncOperationSelects();renderPosCart();
    const credit=$("creditSummary");if(credit){const due=data.customers.reduce((s,c)=>s+Math.max(0,customerBalance(c.id)),0);credit.innerHTML=`<div><span>Saldo total por cobrar</span><strong>${money(due)}</strong></div><div><span>Clientes</span><strong>${data.customers.length}</strong></div>`;}
    const customers=$("customerList");if(customers)customers.innerHTML=data.customers.length?data.customers.map(c=>`<div class="compact-row customer-row"><div class="customer-row-main"><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.phone||"Sin teléfono")}</small><small>Debe: ${money(Math.max(0,customerBalance(c.id)))}</small></div><strong>${money(Math.max(0,customerBalance(c.id)))}</strong><button type="button" class="button secondary customer-edit-button" data-edit-customer="${escapeHtml(c.id)}">Editar</button></div>`).join(""):'<p class="muted">Todavía no hay clientes.</p>';
    const suppliers=$("supplierList");if(suppliers)suppliers.innerHTML=data.suppliers.length?data.suppliers.map(s=>`<div class="compact-row"><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.contact||"Sin contacto")}</small></div><small>${data.purchases.filter(p=>p.supplierId===s.id).length} compras</small></div>`).join(""):'<p class="muted">Todavía no hay proveedores.</p>';
    const lastCut=data.cashCuts[data.cashCuts.length-1];const salesSinceCut=data.sales.slice(lastCut?.salesIndex||0);
    const cashSales=salesSinceCut.filter(s=>(s.payment||"efectivo")==="efectivo").reduce((sum,s)=>sum+s.qty*s.price,0);const cashExpense=data.expenses.slice(lastCut?.expenseIndex||0).reduce((sum,e)=>sum+Number(e.amount||0),0);
    const cs=$("cashSummary");if(cs)cs.innerHTML=`<div><span>Ventas registradas desde el último corte</span><strong>${money(salesSinceCut.reduce((s,x)=>s+x.qty*x.price,0))}</strong></div><div><span>Ventas no fiadas</span><strong>${money(cashSales)}</strong></div><div><span>Gastos registrados</span><strong>${money(cashExpense)}</strong></div><div><span>Movimientos de ventas</span><strong>${salesSinceCut.length}</strong></div>`;
    const cuts=$("cashCutsList");if(cuts)cuts.innerHTML=data.cashCuts.length?data.cashCuts.slice().reverse().slice(0,8).map(c=>`<div class="compact-row"><div><strong>Corte ${escapeHtml(c.date)}</strong><small>${c.salesCount} ventas · fondo ${money(c.opening)}</small></div><strong>${money(c.expectedCash)}</strong></div>`).join(""):'<p class="muted">Aún no hay cortes de caja.</p>';
    const health=$("dataHealthSummary");if(health)health.innerHTML=`<div><span>Productos</span><strong>${data.products.length}</strong></div><div><span>Ventas</span><strong>${data.sales.length}</strong></div><div><span>Clientes / proveedores</span><strong>${data.customers.length} / ${data.suppliers.length}</strong></div><div><span>Tema actual</span><strong>${escapeHtml((THEMES.find(t=>t.id===data.settings.theme)||THEMES[0]).name)}</strong></div>`;
  }
  $("cashCloseButton")?.addEventListener("click",()=>{const opening=Math.max(0,Number($("cashOpening").value)||0);const last=data.cashCuts[data.cashCuts.length-1];const sales=data.sales.slice(last?.salesIndex||0);const expenses=data.expenses.slice(last?.expenseIndex||0);const cashSales=sales.filter(s=>(s.payment||"efectivo")==="efectivo").reduce((sum,s)=>sum+s.qty*s.price,0);const expenseTotal=expenses.reduce((sum,e)=>sum+Number(e.amount||0),0);const cut={id:uid(),date:today(),opening,salesCount:sales.length,salesTotal:sales.reduce((s,x)=>s+x.qty*x.price,0),cashSales,expenseTotal,expectedCash:opening+cashSales-expenseTotal,lastSaleId:data.sales.length?data.sales[data.sales.length-1].id:"",salesIndex:data.sales.length,expenseIndex:data.expenses.length};data.cashCuts.push(cut);save();renderOperations();toast("Corte de caja guardado. Revisa el efectivo esperado.");});
  $("exportJsonBackup")?.addEventListener("click",()=>{try{const payload={format:"MPN36_BACKUP_JSON",version:3.6,exportedAt:new Date().toISOString(),data};const json=JSON.stringify(payload,null,2);const filename="respaldo-mi-primer-negocio-36-v3.6.json";if(window.AndroidFiles&&typeof window.AndroidFiles.saveBase64==="function"){const bytes=new TextEncoder().encode(json);let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));window.AndroidFiles.saveBase64(filename,"application/json",btoa(binary));}else{const blob=new Blob([json],{type:"application/json;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}toast("Respaldo JSON exportado.");}catch(e){console.error(e);toast("No se pudo exportar el respaldo JSON.");}});
  $("importJsonBackup")?.addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>20*1024*1024)throw new Error("El archivo supera 20 MB.");const parsed=JSON.parse(await file.text());const restored=parsed.data||parsed;if(!Array.isArray(restored.products)||!Array.isArray(restored.sales)||!restored.settings)throw new Error("Formato incompatible.");if(!confirm("Importar el respaldo reemplazará los datos actuales. ¿Continuar?"))return;data={...restored,products:restored.products,sales:restored.sales,expenses:Array.isArray(restored.expenses)?restored.expenses:[],stockMoves:Array.isArray(restored.stockMoves)?restored.stockMoves:[],notes:Array.isArray(restored.notes)?restored.notes:[],customers:Array.isArray(restored.customers)?restored.customers:[],creditMovements:Array.isArray(restored.creditMovements)?restored.creditMovements:[],cashCuts:Array.isArray(restored.cashCuts)?restored.cashCuts:[],suppliers:Array.isArray(restored.suppliers)?restored.suppliers:[],purchases:Array.isArray(restored.purchases)?restored.purchases:[],settings:{currency:"MXN",mode:"light",...(restored.settings||{})},gamification:{coins:Math.max(0,Number(restored.gamification?.coins)||0),rewardedMilestones:Array.isArray(restored.gamification?.rewardedMilestones)?restored.gamification.rewardedMilestones:[],purchasedThemes:Array.isArray(restored.gamification?.purchasedThemes)?restored.gamification.purchasedThemes:["classic"]}};localStorage.setItem(KEY,JSON.stringify(data));applySavedAppearance();if($("businessName"))$("businessName").value=data.settings.businessName||"";renderAll();renderOperations();toast("Respaldo importado correctamente.");}catch(err){console.error(err);toast("No se pudo importar: revisa que sea un respaldo JSON válido.");}finally{e.target.value="";}});
  $("runDataCheck")?.addEventListener("click",()=>{const issues=[];if(data.products.some(p=>!p.id||!p.name||Number(p.stock)<0))issues.push("productos con datos incompletos o stock negativo");if(data.sales.some(s=>!s.id||!s.productId||Number(s.qty)<=0))issues.push("ventas incompletas");if(data.creditMovements.some(m=>!data.customers.some(c=>c.id===m.customerId)))issues.push("movimientos de fiado sin cliente");if(data.products.some(p=>p.barcode&&data.products.some(q=>q.id!==p.id&&q.barcode===p.barcode)))issues.push("códigos de barras duplicados");const result=$("dataCheckResult");if(result)result.textContent=issues.length?"Revisar: "+issues.join("; "):"Revisión básica completada: no se detectaron inconsistencias comunes.";});
  async function startBarcodeScanner(){
    if(window.AndroidFiles&&typeof window.AndroidFiles.startBarcodeScan==="function"){
      try { window.AndroidFiles.startBarcodeScan(); }
      catch(err) { console.error("No se pudo iniciar el escáner nativo:",err); toast("No se pudo abrir la cámara. Puedes escribir el código manualmente."); }
      return;
    }
    const wrap=$("posScannerWrap"),video=$("posVideo"),status=$("posScanStatus");
    if(!navigator.mediaDevices?.getUserMedia){toast("La cámara no está disponible. Escribe el código de barras en el buscador.");return;}
    if(!("BarcodeDetector" in window)){toast("Este navegador no admite lectura de códigos por cámara. Escribe el código o usa un lector externo.");return;}
    try{
      const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","qr_code"]});
      scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
      video.srcObject=scanStream;wrap.classList.remove("hidden");await video.play();status.textContent="Buscando código…";
      const scan=async()=>{if(!scanStream)return;try{const codes=await detector.detect(video);if(codes.length){$("posSearch").value=codes[0].rawValue;stopBarcodeScanner();addPosProduct();return;}}catch(e){console.warn("No se pudo leer el código:",e);}if(scanStream)requestAnimationFrame(scan);};requestAnimationFrame(scan);
    }catch(err){console.error(err);toast("No se pudo abrir la cámara. Revisa los permisos o escribe el código manualmente.");stopBarcodeScanner();}
  }
  window.onNativeBarcodeScanned = function(code){if(code){$("posSearch").value=String(code);addPosProduct();}else{toast("No se detectó ningún código. Inténtalo de nuevo o escríbelo manualmente.");}};
  window.onNativeBarcodeError = function(message){toast(String(message||"No se pudo iniciar el escáner."));};
  function stopBarcodeScanner(){if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null;}const video=$("posVideo");if(video)video.srcObject=null;$("posScannerWrap")?.classList.add("hidden");}
  $("posScanButton")?.addEventListener("click",startBarcodeScanner);$("posStopScan")?.addEventListener("click",stopBarcodeScanner);
  // Funciones ligeras v3.7: imágenes, favoritos, reabastecimiento, calculadora y Manolito.
  let pendingProductImage = "";
  $("productImageFile")?.addEventListener("change", async e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Selecciona un archivo de imagen."); e.target.value=""; return; }
    if (file.size > 2 * 1024 * 1024) { toast("La imagen debe pesar menos de 2 MB."); e.target.value=""; return; }
    try { pendingProductImage = await new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=reject; reader.readAsDataURL(file); }); toast("Imagen lista para guardar con el producto."); }
    catch { toast("No se pudo leer la imagen."); }
  });
  function updatePriceCalculator() {
    const cost = Math.max(0, Number($("priceCalcCost")?.value) || 0);
    const margin = Math.min(99.99, Math.max(0, Number($("priceCalcMargin")?.value) || 0));
    const price = margin >= 100 ? 0 : cost / (1 - margin / 100);
    if ($("priceCalcResult")) $("priceCalcResult").textContent = money(price);
    if ($("priceCalcProfit")) $("priceCalcProfit").textContent = money(price - cost);
  }
  $("priceCalcCost")?.addEventListener("input", updatePriceCalculator);
  $("priceCalcMargin")?.addEventListener("input", updatePriceCalculator);
  $("productGridToggle")?.addEventListener("click", () => { data.settings.productView="grid"; save(); });
  $("productListToggle")?.addEventListener("click", () => { data.settings.productView="list"; save(); });
  function renderRestockList() {
    const panel=$("restockPanel"), list=$("restockList"); if (!panel || !list) return;
    const low=data.products.filter(p=>Number(p.stock)<=Number(p.minStock));
    list.innerHTML=low.length?low.map(p=>`<div class="restock-row"><div><strong>${escapeHtml(p.name)}</strong><small>Stock ${p.stock} · mínimo ${p.minStock}</small></div><label>Cantidad a comprar<input type="number" min="1" step="1" value="${Math.max(1,Number(p.minStock)-Number(p.stock))}" data-restock-qty="${escapeHtml(p.id)}"></label><strong>${money(productCost(p)*Math.max(1,Number(p.minStock)-Number(p.stock)))}</strong></div>`).join(""):'<p class="muted">No hay productos por reabastecer.</p>';
    panel.classList.remove("hidden");
  }
  $("showRestockList")?.addEventListener("click",renderRestockList);
  $("closeRestockList")?.addEventListener("click",()=>$ ("restockPanel").classList.add("hidden"));
  function applyV37Preferences() {
    const root=document.documentElement;
    root.style.setProperty("--mpn-accent-custom", data.settings.accentColor || "#315f82");
    root.dataset.fontScale=data.settings.fontScale || "normal";
    const mascotOn=data.settings.mascotEnabled !== false;
    if ($("mascotEnabled")) $("mascotEnabled").checked=mascotOn;
    if ($("mascotPanel")) $("mascotPanel").classList.toggle("hidden",!mascotOn);
    if ($("mascotPanel") && mascotOn) { const messages=["Estoy aquí para ayudarte a organizar tu negocio.","Revisa los productos con poco inventario.","Puedes fijar tus productos favoritos para encontrarlos rápido."]; $("mascotMessage").textContent=messages[new Date().getDate()%messages.length]; }
    if ($("accentColor")) $("accentColor").value=data.settings.accentColor || "#315f82";
    if ($("fontScale")) $("fontScale").value=data.settings.fontScale || "normal";
    if ($("dashboardCards")) $("dashboardCards").value=data.settings.dashboardCards || "all";
    if ($("quickActionsPanel")) $("quickActionsPanel").classList.toggle("compact-dashboard",data.settings.dashboardCards==="compact");
  }
  $("mascotEnabled")?.addEventListener("change",e=>{data.settings.mascotEnabled=e.target.checked;save();toast(e.target.checked?"Manolito está activado.":"Manolito está oculto.");});
  $("accentColor")?.addEventListener("input",e=>{data.settings.accentColor=e.target.value;applyV37Preferences();localStorage.setItem(KEY,JSON.stringify(data));});
  $("fontScale")?.addEventListener("change",e=>{data.settings.fontScale=e.target.value;applyV37Preferences();localStorage.setItem(KEY,JSON.stringify(data));});
  $("dashboardCards")?.addEventListener("change",e=>{data.settings.dashboardCards=e.target.value;applyV37Preferences();localStorage.setItem(KEY,JSON.stringify(data));});
  const originalSaveV37 = save;
  // Las preferencias se reaplican cada vez que se renderizan los datos.
  const originalRenderAllV37 = renderAll;
  renderAll = function(){ originalRenderAllV37(); applyV37Preferences(); updatePriceCalculator(); };
  applyV37Preferences(); updatePriceCalculator();

  const originalGo = go;
  // El render de operaciones se activa al entrar a la sección y al terminar las operaciones.
  document.querySelectorAll('[data-view="operations"]').forEach(b=>b.addEventListener("click",renderOperations));
  renderOperations();

  $("saleDate").value = today();
  $("expenseDate").value = today();
  $("reportFrom").value = addDays(today(), -29);
  $("reportTo").value = today();

  renderAll();
  renderOperations();
})();
