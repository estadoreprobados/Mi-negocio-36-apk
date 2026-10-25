
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
      settings: { currency: "MXN", theme: "classic" },
      gamification: { coins: 0, rewardedMilestones: [], purchasedThemes: ["classic"] }
    };
  }

  let data = loadData();
  data.settings = { currency: "MXN", theme: "classic", businessName: "", mode: "light", ...(data.settings || {}) };
  data.gamification = {
    coins: Math.max(0, Number(data.gamification?.coins) || 0),
    rewardedMilestones: Array.isArray(data.gamification?.rewardedMilestones) ? data.gamification.rewardedMilestones : [],
    purchasedThemes: Array.isArray(data.gamification?.purchasedThemes) ? data.gamification.purchasedThemes : ["classic"]
  };
  if (!data.gamification.purchasedThemes.includes("classic")) data.gamification.purchasedThemes.unshift("classic");
  // Los tres temas nuevos son gratuitos y quedan disponibles incluso en datos de versiones anteriores.
  ["hacker", "nature", "cbtis36"].forEach(id => {
    if (!data.gamification.purchasedThemes.includes(id)) data.gamification.purchasedThemes.push(id);
  });
  let salesChart = null;
  let editingExpenseId = null;
  let comparisonChart = null;
  let statsMoneyChart = null;
  let statsExpenseChart = null;

  function save() {
    try {
      updateStreakRewards();
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

    $("productRows").innerHTML = list.map(p => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
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
    { id: "hacker", name: "Hacker", cost: 0, description: "Negro profundo y verde neón. Gratis para siempre.", colors: ["#001b0b", "#39ff88"], preview: "linear-gradient(135deg,#001b0b 50%,#39ff88 50%)" },
    { id: "nature", name: "Naturaleza", cost: 0, description: "Verdes de bosque y tonos tierra. Gratis para siempre.", colors: ["#234d35", "#d5e6c9"], preview: "linear-gradient(135deg,#234d35 50%,#d5e6c9 50%)" },
    { id: "cbtis36", name: "Escolar", cost: 0, description: "Azul escolar y blanco. Gratis para siempre.", colors: ["#123b70", "#e6eef9"], preview: "linear-gradient(135deg,#123b70 50%,#e6eef9 50%)" }
  ];

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

  function updateStreakRewards() {
    if (!data.gamification) data.gamification = { coins: 0, rewardedMilestones: [], purchasedThemes: ["classic"] };
    const info = streakInfo();
    if (!info.count || !info.startDate) return;
    const completedWeeks = Math.floor(info.count / 7);
    for (let week = 1; week <= completedWeeks; week++) {
      const milestone = `${info.startDate}:${week}`;
      if (!data.gamification.rewardedMilestones.includes(milestone)) {
        data.gamification.rewardedMilestones.push(milestone);
        data.gamification.coins += 1;
      }
    }
  }

  function renderStreak() {
    const el = $("streakCount");
    if (!el) return;
    const info = streakInfo();
    $("streakCount").textContent = String(info.count);
    $("streakFlame").textContent = info.fullMonth ? "🔥🔥" : info.count >= 7 ? "🔥" : "♨️";
    $("streakMessage").textContent = info.fullMonth
      ? "¡Mes perfecto! Tu llama ha crecido. 🎉"
      : info.count
        ? `¡Bien hecho! ${info.monthCount} de ${info.daysInMonth} días con ventas este mes.`
        : "Registra al menos una venta cada día para mantener la racha.";
    const progress = info.count % 7;
    const percent = info.fullMonth ? 100 : (progress / 7) * 100;
    $("streakProgress").style.width = `${percent}%`;
    $("streakProgressText").textContent = info.fullMonth
      ? "Mes completado: llama especial desbloqueada"
      : `${progress} de 7 días para tu próxima moneda`;
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
    const theme = THEMES.find(t => t.id === data.settings.theme) || THEMES[0];
    document.documentElement.dataset.appTheme = theme.id;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme.colors[0];
  }

  function renderShop() {
    if (!$("themeShop")) return;
    $("fireCoins").textContent = String(data.gamification.coins);
    $("themeShop").innerHTML = THEMES.map(theme => {
      const owned = data.gamification.purchasedThemes.includes(theme.id);
      const active = data.settings.theme === theme.id;
      const action = active ? "Tema activo" : owned ? "Aplicar tema" : `Comprar · ${theme.cost} 🔥`;
      return `<article class="theme-card ${active ? "theme-active" : ""}">
        <div class="theme-preview" style="background:${theme.preview}"></div>
        <div class="theme-card-body"><h3>${escapeHtml(theme.name)}</h3><p>${escapeHtml(theme.description)}</p>
        <div class="theme-card-footer"><strong>${theme.cost === 0 ? "Gratis" : `${theme.cost} 🔥`}</strong>
        <button class="button ${active ? "secondary" : ""}" data-theme-action="${theme.id}" ${active ? "disabled" : ""}>${action}</button></div></div>
      </article>`;
    }).join("");
  }

  function handleThemeAction(id) {
    const theme = THEMES.find(t => t.id === id);
    if (!theme) return;
    const owned = data.gamification.purchasedThemes.includes(id);
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
    data.settings.theme = id;
    applyTheme();
    save();
    toast(owned || theme.cost === 0 ? `Tema "${theme.name}" aplicado.` : `¡Compraste "${theme.name}"!`);
  }

  $("themeShop")?.addEventListener("click", e => {
    const button = e.target.closest("[data-theme-action]");
    if (button) handleThemeAction(button.dataset.themeAction);
  });
  $("statsPeriod")?.addEventListener("change", renderStatistics);

  function renderAll() {
    renderProducts();
    renderSales();
    renderExpenses();
    renderDashboard();
    renderReport();
    renderStreak();
    renderStatistics();
    renderShop();
    applyTheme();
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
    if (view === "dashboard") { renderDashboard(); renderStreak(); }
    if (view === "reports") renderReport();
    if (view === "statistics") renderStatistics();
    if (view === "shop") renderShop();
    if (view === "taxes") updateTax();
  }

  document.querySelectorAll(".tab").forEach(b =>
    b.addEventListener("click", () => go(b.dataset.view))
  );

  document.querySelectorAll("[data-goto]").forEach(b =>
    b.addEventListener("click", () => go(b.dataset.goto))
  );

  $("productForm").addEventListener("submit", e => {
    e.preventDefault();

    const id = $("productId").value;
    const name = $("productName").value.trim();
    const materials = num("productMaterials");
    const labor = num("productLabor");
    const price = num("productPrice");
    const stock = num("productStock");
    const minStock = num("productMinStock");

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
        id: uid(), name, materials, labor, price, stock, minStock,
        createdAt: today()
      });
      toast("Producto agregado.");
    }

    $("productForm").reset();
    $("productId").value = "";
    $("productLabor").value = "0";
    $("productStock").value = "0";
    $("productMinStock").value = "3";
    $("productSubmit").textContent = "Agregar producto";
    $("cancelProductEdit").classList.add("hidden");
    save();
  });

  $("cancelProductEdit").addEventListener("click", () => {
    $("productForm").reset();
    $("productId").value = "";
    $("productLabor").value = "0";
    $("productStock").value = "0";
    $("productMinStock").value = "3";
    $("productSubmit").textContent = "Agregar producto";
    $("cancelProductEdit").classList.add("hidden");
  });

  $("productRows").addEventListener("click", e => {
    const edit = e.target.closest("[data-edit-product]");
    const del = e.target.closest("[data-delete-product]");

    if (edit) {
      const p = product(edit.dataset.editProduct);
      if (!p) return;

      $("productId").value = p.id;
      $("productName").value = p.name;
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
    save();
    toast("Venta registrada e inventario actualizado.");
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


  $("saleDate").value = today();
  $("expenseDate").value = today();
  $("reportFrom").value = addDays(today(), -29);
  $("reportTo").value = today();

  renderAll();
})();
