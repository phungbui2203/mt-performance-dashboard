const THEME = {
  navy: "#0F2743",
  royal: "#1A4474",
  primary: "#1965B3",
  blue: "#5B90C4",
  sky: "#41BCE6",
  cyan: "#6DE7F7",
  muted: "#75A2B9",
  peach: "#E3B79A",
  target: "#75A2B9",
  actual: "#1965B3",
  line: "#1A4474",
};

const PIE_COLORS = [
  "#1965B3", "#1A4474", "#5B90C4", "#41BCE6", "#6DE7F7",
  "#75A2B9", "#0F2743", "#E3B79A", "#E7DEA7", "#E8BDB7",
];

let data = null;
const charts = {};

function setLoading(active, messageKey) {
  const overlay = document.getElementById("loading-overlay");
  const msg = document.getElementById("loading-message");
  if (!overlay || !msg) return;
  if (active) {
    overlay.hidden = false;
    msg.textContent = messageKey ? t(messageKey) : t("loading");
  } else {
    overlay.hidden = true;
  }
}

function loadMetricsScript() {
  return new Promise((resolve, reject) => {
    if (window.DASHBOARD_DATA) {
      resolve(window.DASHBOARD_DATA);
      return;
    }
    const script = document.createElement("script");
    script.src = "data/metrics.js";
    script.async = true;
    script.onload = () => {
      if (window.DASHBOARD_DATA) resolve(window.DASHBOARD_DATA);
      else reject(new Error("metrics.js loaded but DASHBOARD_DATA is missing"));
    };
    script.onerror = () => reject(new Error("Could not load data/metrics.js"));
    document.head.appendChild(script);
  });
}

function registerChartPlugins() {
  if (typeof Chart !== "undefined" && typeof ChartDataLabels !== "undefined") {
    Chart.register(ChartDataLabels);
    Chart.defaults.set("plugins.datalabels", { display: false });
  }
}

registerChartPlugins();

function unitDiv() {
  return data?.meta?.unit_divisor || 1_000_000;
}

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)}${t("unitBil")}`;
  }
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}${t("unitMil")}`;
  }
  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(2)}${t("unitThou")}`;
  }
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n);
}

/** @deprecated use fmtMoney */
function fmtMil(n) {
  return fmtMoney(n);
}

function fmtKpiValue(n) {
  return fmtMoney(n);
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtYoy(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function yoyClass(n) {
  if (n == null || Number.isNaN(n)) return "";
  if (n >= 0) return "pct-good";
  return "pct-bad";
}

function achievementClass(n) {
  if (n == null || Number.isNaN(n)) return "";
  return n >= 0.5 ? "pct-good" : "pct-bad";
}

function parseMonthId(id) {
  const [year, month] = id.split("-");
  return { year, monthNum: parseInt(month, 10) };
}

function monthNameFromNum(monthNum) {
  const names = typeof getMonthNames === "function" ? getMonthNames() : [];
  return names[monthNum - 1] || t("monthFallback", { n: monthNum });
}

function monthNameFromId(id) {
  return monthNameFromNum(parseMonthId(id).monthNum);
}

function getAvailableYears() {
  if (data.meta.years?.length) return data.meta.years.map(String);
  return [...new Set(data.meta.months.map((m) => parseMonthId(m.id).year))].sort();
}

function monthHasData(year, monthNum) {
  const id = `${year}-${String(monthNum).padStart(2, "0")}`;
  return data.meta.months.some((m) => m.id === id);
}

function getMonthsForYear(year) {
  return data.meta.months
    .filter((m) => parseMonthId(m.id).year === year)
    .sort((a, b) => parseMonthId(a.id).monthNum - parseMonthId(b.id).monthNum);
}

function isAllMonthsSelected() {
  return document.getElementById("filter-month").value === "all";
}

function getMonthIdsForYear(year) {
  return getMonthsForYear(year).map((m) => m.id);
}

function yoyGrowth(actual, ly) {
  if (!ly) return null;
  return (actual - ly) / ly;
}

function aggregateSlices(monthIds, staff, customer) {
  const slices = monthIds
    .map((mid) => data.slices[sliceKey(mid, staff, customer)] || data.slices[sliceKey(mid, "all", "all")])
    .filter(Boolean);
  if (!slices.length) return null;

  const kpis = { target: 0, actual: 0, ly_actual: 0 };
  const catMap = {};
  const acctMap = {};

  for (const slice of slices) {
    kpis.target += slice.kpis.target;
    kpis.actual += slice.kpis.actual;
    kpis.ly_actual += slice.kpis.ly_actual || 0;

    for (const c of slice.categories) {
      if (!catMap[c.category]) {
        catMap[c.category] = { category: c.category, target: 0, actual: 0, ly_actual: 0 };
      }
      catMap[c.category].target += c.target;
      catMap[c.category].actual += c.actual;
      catMap[c.category].ly_actual += c.ly_actual || 0;
    }

    for (const a of slice.accounts) {
      if (!acctMap[a.account]) {
        acctMap[a.account] = { account: a.account, target: 0, actual: 0, ly_actual: 0 };
      }
      acctMap[a.account].target += a.target;
      acctMap[a.account].actual += a.actual;
      acctMap[a.account].ly_actual += a.ly_actual || 0;
    }
  }

  kpis.achievement = kpis.target ? kpis.actual / kpis.target : 0;
  kpis.yoy = yoyGrowth(kpis.actual, kpis.ly_actual);

  const categories = Object.values(catMap)
    .map((c) => ({
      ...c,
      achievement: c.target ? c.actual / c.target : 0,
      yoy: yoyGrowth(c.actual, c.ly_actual),
    }))
    .filter((c) => c.target > 0 || c.actual > 0)
    .sort((a, b) => b.actual - a.actual);

  const accounts = Object.values(acctMap)
    .map((a) => ({
      ...a,
      achievement: a.target ? a.actual / a.target : 0,
      yoy: yoyGrowth(a.actual, a.ly_actual),
    }))
    .filter((a) => a.target > 0 || a.actual > 0)
    .sort((a, b) => b.actual - a.actual);

  const total = accounts.reduce((sum, a) => sum + a.actual, 0);
  accounts.forEach((a, i) => {
    a.rank = i + 1;
    a.share = total ? a.actual / total : 0;
  });

  return { kpis, categories, accounts };
}

function mergeBundles(monthIds) {
  const merged = {
    step1_total: 0,
    provinces: new Set(),
    province_region: {},
    staff_rows: [],
    account_rows: [],
    province_actuals: [],
    category_rows: [],
  };
  for (const mid of monthIds) {
    const b = data.bundles?.[mid];
    if (!b) continue;
    merged.step1_total += b.step1_total || 0;
    (b.provinces || []).forEach((p) => merged.provinces.add(p));
    Object.assign(merged.province_region, b.province_region || {});
    merged.staff_rows.push(...(b.staff_rows || []));
    merged.account_rows.push(...(b.account_rows || []));
    merged.province_actuals.push(...(b.province_actuals || []));
    merged.category_rows.push(...(b.category_rows || []));
  }
  merged.provinces = [...merged.provinces].sort((a, b) => a.localeCompare(b, "vi"));
  return merged;
}

function aggregateBundles(monthIds, staff, customer, region, province) {
  const bundle = mergeBundles(monthIds);
  if (!bundle.staff_rows.length && !bundle.account_rows.length) return null;

  let staffRows = bundle.staff_rows;
  let accountRows = bundle.account_rows;
  if (staff !== "all") staffRows = staffRows.filter((r) => r.staff === staff);
  if (customer !== "all") {
    staffRows = staffRows.filter((r) => r.account === customer);
    accountRows = accountRows.filter((r) => r.account === customer);
  }
  if (region !== "all") {
    staffRows = staffRows.filter((r) => r.region === region);
    accountRows = accountRows.filter((r) => r.region === region);
  }

  const accountActualMap = {};
  const useProvinceActual = province !== "all";

  if (useProvinceActual) {
    let pa = bundle.province_actuals.filter((r) => r.province === province);
    if (region !== "all") pa = pa.filter((r) => r.region === region);
    if (customer !== "all") pa = pa.filter((r) => r.account === customer);
    for (const r of pa) {
      accountActualMap[r.account] = (accountActualMap[r.account] || 0) + r.actual;
    }
  } else if (staff !== "all") {
    const groups = {};
    for (const row of staffRows) {
      const k = `${row.customer}|${row.region}`;
      if (!groups[k]) groups[k] = [];
      groups[k].push(row);
    }
    for (const rows of Object.values(groups)) {
      const base = accountRows.find(
        (a) => a.customer === rows[0].customer && a.region === rows[0].region,
      );
      const baseActual = base?.actual || 0;
      const totalTarget = rows.reduce((s, r) => s + r.target, 0);
      for (const row of rows) {
        const weight = totalTarget ? row.target / totalTarget : 1 / rows.length;
        accountActualMap[row.account] = (accountActualMap[row.account] || 0) + baseActual * weight;
      }
    }
  } else {
    for (const r of accountRows) {
      accountActualMap[r.account] = (accountActualMap[r.account] || 0) + (r.actual || 0);
    }
  }

  const accountMap = {};
  for (const row of staffRows.length ? staffRows : accountRows) {
    const name = row.account;
    if (!accountMap[name]) {
      accountMap[name] = {
        account: name,
        target: 0,
        actual: accountActualMap[name] || 0,
      };
    }
    accountMap[name].target += row.target || 0;
  }
  for (const [name, actual] of Object.entries(accountActualMap)) {
    if (!accountMap[name]) {
      accountMap[name] = { account: name, target: 0, actual };
    } else {
      accountMap[name].actual = actual;
    }
  }

  const accounts = Object.values(accountMap)
    .filter((a) => a.target > 0 || a.actual > 0)
    .map((a) => ({
      ...a,
      achievement: a.target ? a.actual / a.target : 0,
    }))
    .sort((a, b) => b.actual - a.actual);

  const total = accounts.reduce((s, a) => s + a.actual, 0);
  accounts.forEach((a, i) => {
    a.rank = i + 1;
    a.share = total ? a.actual / total : 0;
  });

  let catRows = bundle.category_rows;
  if (region !== "all") catRows = catRows.filter((r) => r.region === region);
  if (province !== "all") {
    catRows = catRows.filter((r) => r.province === province || r.province === "__all__");
  }
  const catMap = {};
  for (const row of catRows) {
    if (!catMap[row.category]) {
      catMap[row.category] = { category: row.category, target: 0, actual: 0 };
    }
    catMap[row.category].target += row.target || 0;
    if (row.province !== "__all__") {
      catMap[row.category].actual += row.actual || 0;
    }
  }
  const categories = Object.values(catMap)
    .map((c) => ({
      ...c,
      achievement: c.target ? c.actual / c.target : 0,
    }))
    .filter((c) => c.target > 0 || c.actual > 0)
    .sort((a, b) => b.actual - a.actual);

  const totalTarget = accounts.reduce((s, a) => s + a.target, 0);
  const totalActual =
    staff === "all" && customer === "all" && region === "all" && province === "all"
      ? bundle.step1_total
      : accounts.reduce((s, a) => s + a.actual, 0);

  return {
    kpis: {
      target: totalTarget,
      actual: totalActual,
      achievement: totalTarget ? totalActual / totalTarget : 0,
    },
    categories,
    accounts,
  };
}

function getSelectedMonthId() {
  const year = document.getElementById("filter-year").value;
  const month = document.getElementById("filter-month").value;
  if (month === "all") return null;
  return `${year}-${month}`;
}

function getPeriodLabel() {
  const year = document.getElementById("filter-year").value;
  if (isAllMonthsSelected()) return t("allMonthsYear", { year });
  const month = monthNameFromNum(parseInt(document.getElementById("filter-month").value, 10));
  return t("monthYear", { month, year });
}

function populateYearFilter() {
  const yearSel = document.getElementById("filter-year");
  const years = getAvailableYears();
  const defaultYear = parseMonthId(data.meta.default_month || data.meta.months[0]?.id).year;
  yearSel.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  yearSel.value = years.includes(defaultYear) ? defaultYear : years[years.length - 1];
}

function populateMonthFilter(preferredMonthNum) {
  const year = document.getElementById("filter-year").value;
  const monthSel = document.getElementById("filter-month");
  const monthNames = getMonthNames();
  const monthOptions = monthNames.map((name, index) => {
    const monthNum = index + 1;
    const num = String(monthNum).padStart(2, "0");
    const disabled = monthHasData(year, monthNum) ? "" : " disabled";
    return `<option value="${num}"${disabled}>${name}</option>`;
  }).join("");
  monthSel.innerHTML = `<option value="all">${t("allMonths")}</option>${monthOptions}`;

  if (preferredMonthNum === "all") {
    monthSel.value = "all";
    return;
  }

  const availableMonths = monthNames.map((_, i) => i + 1).filter((m) => monthHasData(year, m));
  const pickNum = preferredMonthNum && monthHasData(year, preferredMonthNum)
    ? preferredMonthNum
    : availableMonths[availableMonths.length - 1];
  if (pickNum) {
    monthSel.value = String(pickNum).padStart(2, "0");
  }
}

function sliceKey(month, staff, customer) {
  return `${month}|${staff}|${customer}`;
}

function getSliceRaw(year, monthValue, staff, customer, region, province) {
  const monthIds = monthValue === "all" ? getMonthIdsForYear(year) : [`${year}-${monthValue}`];
  if (data.bundles && monthIds.some((id) => data.bundles[id])) {
    return aggregateBundles(monthIds, staff, customer, region, province);
  }
  if (monthValue === "all") {
    return aggregateSlices(monthIds, staff, customer);
  }
  const monthId = `${year}-${monthValue}`;
  return data.slices[sliceKey(monthId, staff, customer)] || data.slices[sliceKey(monthId, "all", "all")];
}

function getPriorMonthIds(year, monthValue) {
  const y = parseInt(year, 10);
  if (monthValue === "all") {
    return [];
  }
  const m = parseInt(monthValue, 10);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const priorId = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  return data.meta.months.some((mo) => mo.id === priorId) ? [priorId] : [];
}

function getPriorPeriodLabel(year, monthValue) {
  const y = parseInt(year, 10);
  if (monthValue === "all") return "";
  const m = parseInt(monthValue, 10);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const month = monthNameFromNum(prevMonth);
  return t("monthPrior", { month, year: prevYear });
}

/** @deprecated use getPriorMonthIds */
function getPriorPeriodIds(year, monthValue) {
  return getPriorMonthIds(year, monthValue);
}

function enrichSliceWithYoy(slice, year, monthValue, staff, customer, region, province) {
  if (!slice) return null;

  const priorIds = getPriorMonthIds(year, monthValue);
  const priorSlice = priorIds.length
    ? aggregateBundles(priorIds, staff, customer, region, province)
      || aggregateSlices(priorIds, staff, customer)
    : null;
  const priorActual = priorSlice?.kpis?.actual ?? 0;
  const priorByAccount = Object.fromEntries(
    (priorSlice?.accounts || []).map((a) => [a.account, a.actual]),
  );
  const priorByCategory = Object.fromEntries(
    (priorSlice?.categories || []).map((c) => [c.category, c.actual]),
  );

  return {
    ...slice,
    ly_label: getPriorPeriodLabel(year, monthValue),
    ly_available: priorActual > 0,
    kpis: {
      ...slice.kpis,
      ly_actual: priorActual,
      yoy: yoyGrowth(slice.kpis.actual, priorActual),
    },
    categories: slice.categories.map((c) => {
      const pa = priorByCategory[c.category] ?? 0;
      return { ...c, ly_actual: pa, yoy: yoyGrowth(c.actual, pa) };
    }),
    accounts: slice.accounts.map((a) => {
      const pa = priorByAccount[a.account] ?? 0;
      return { ...a, ly_actual: pa, yoy: yoyGrowth(a.actual, pa) };
    }),
  };
}

function getSlice(monthId) {
  const staff = document.getElementById("filter-staff").value;
  const customer = document.getElementById("filter-customer").value;
  const region = document.getElementById("filter-region").value;
  const province = document.getElementById("filter-province").value;
  const year = document.getElementById("filter-year").value;
  const monthValue = document.getElementById("filter-month").value;
  const slice = getSliceRaw(year, monthValue, staff, customer, region, province);
  return enrichSliceWithYoy(slice, year, monthValue, staff, customer, region, province);
}

function formatUpdatedSubtitle() {
  const raw = data?.meta?.generated_at;
  if (!raw) return "";

  const iso = raw.replace(" UTC", "Z").replace(" ", "T");
  const parsed = new Date(iso);
  let dateStr = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0] || raw;

  if (!Number.isNaN(parsed.getTime())) {
    const locale = getLang() === "vi" ? "vi-VN" : "en-GB";
    dateStr = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsed);
  } else {
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) dateStr = getLang() === "vi" ? `${m[3]}/${m[2]}/${m[1]}` : `${m[1]}/${m[2]}/${m[3]}`;
  }

  return t("updatedAt", { date: dateStr });
}

function renderEmptyState(periodLabel) {
  document.getElementById("meta-subtitle").textContent = formatUpdatedSubtitle();
  document.getElementById("kpi-target").textContent = "—";
  document.getElementById("kpi-actual").textContent = "—";
  const achEl = document.getElementById("kpi-achievement");
  achEl.textContent = "—";
  achEl.className = "kpi-value";
  const yoyEl = document.getElementById("kpi-yoy");
  yoyEl.textContent = "—";
  yoyEl.className = "kpi-value";
  document.getElementById("kpi-yoy-sub").textContent = t("yoyDefault");
  destroyChart("category");
  destroyChart("account-bar");
  destroyChart("account-pie");
  document.querySelector("#account-table tbody").innerHTML = "";
  setLoading(false);
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function shortLabel(name, max = 18) {
  if (!name) return "";
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Product line chart: keep text after the last " - " (e.g. MM brand). */
function categoryChartLabel(name) {
  if (!name) return "";
  const parts = String(name).split(" - ");
  const shortName = parts.length > 1 ? parts[parts.length - 1].trim() : String(name).trim();
  return shortLabel(shortName, 22);
}

function milTooltip(context) {
  const raw = context.raw;
  if (raw == null || Number.isNaN(raw)) return `${context.dataset.label}: —`;
  return `${context.dataset.label}: ${fmtMoney(raw * unitDiv())}`;
}

function monthLyAvailable(_monthId, slice) {
  return !!slice?.ly_available;
}

function chartValueLabel(value) {
  if (value == null || Number.isNaN(value)) return "";
  return fmtMoney(value * unitDiv());
}

function categoryDataLabel(value, ctx) {
  if (value == null || Number.isNaN(value)) return "";
  if (ctx.dataset.type === "line") return `${value.toFixed(0)}%`;
  return chartValueLabel(value);
}

function categoryLinePercent(row) {
  if (row.target > 0 && row.achievement != null) return row.achievement * 100;
  return null;
}

function renderKpis(slice, monthMeta) {
  const k = slice.kpis;
  document.getElementById("kpi-target").textContent = fmtKpiValue(k.target);
  document.getElementById("kpi-actual").textContent = fmtKpiValue(k.actual);

  const achEl = document.getElementById("kpi-achievement");
  achEl.textContent = fmtPct(k.achievement);
  achEl.className = `kpi-value ${achievementClass(k.achievement)}`;

  const yoyEl = document.getElementById("kpi-yoy");
  if (slice.ly_available) {
    yoyEl.textContent = fmtYoy(k.yoy);
    yoyEl.className = `kpi-value ${yoyClass(k.yoy)}`;
    document.getElementById("kpi-yoy-sub").textContent =
      `${slice.ly_label} (${fmtKpiValue(k.ly_actual)})`;
  } else {
    yoyEl.textContent = t("na");
    yoyEl.className = "kpi-value";
    document.getElementById("kpi-yoy-sub").textContent =
      t("lyNote");
  }
}

function renderCategoryChart(slice) {
  if (typeof Chart === "undefined") return;
  const rows = slice.categories.filter((r) => r.actual > 0 || r.target > 0);
  const labels = rows.map((r) => categoryChartLabel(r.category));

  const datasets = [
    {
      type: "bar",
      label: t("performance"),
      data: rows.map((r) => r.actual / unitDiv()),
      backgroundColor: THEME.actual,
      borderRadius: 4,
      yAxisID: "y",
      order: 2,
      datalabels: {
        display: true,
        anchor: "end",
        align: "top",
        offset: 2,
        color: THEME.navy,
        font: { weight: "700", size: 9 },
        formatter: (v) => chartValueLabel(v),
      },
    },
    {
      type: "bar",
      label: t("target"),
      data: rows.map((r) => r.target / unitDiv()),
      backgroundColor: THEME.target,
      borderRadius: 4,
      yAxisID: "y",
      order: 3,
      datalabels: {
        display: true,
        anchor: "end",
        align: "end",
        offset: -2,
        color: THEME.navy,
        font: { weight: "600", size: 9 },
        formatter: (v) => chartValueLabel(v),
      },
    },
    {
      type: "line",
      label: t("chartPctAch"),
      data: rows.map((r) => categoryLinePercent(r)),
      spanGaps: true,
      borderColor: THEME.line,
      backgroundColor: THEME.line,
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.25,
      yAxisID: "y1",
      order: 1,
      datalabels: {
        display: (ctx) => ctx.dataset.data[ctx.dataIndex] != null,
        anchor: "end",
        align: "top",
        offset: 4,
        color: THEME.line,
        font: { weight: "700", size: 10 },
        formatter: (v) => (v == null ? "" : `${Number(v).toFixed(0)}%`),
      },
    },
  ];

  destroyChart("category");
  charts.category = new Chart(document.getElementById("chart-category"), {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom" },
        datalabels: {
          display: (ctx) => {
            const label = ctx.dataset.label;
            return label === t("performance") || label === t("target") || label === t("chartPctAch");
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => slice.categories[items[0]?.dataIndex]?.category ?? "",
            label: (ctx) => {
              if (ctx.dataset.type === "line") {
                return `${ctx.dataset.label}: ${ctx.raw?.toFixed(1) ?? "—"}%`;
              }
              return `${ctx.dataset.label}: ${chartValueLabel(ctx.raw)}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { maxRotation: 45, minRotation: 28, font: { size: 10 } } },
        y: {
          position: "left",
          title: { display: true, text: t("axisVnd") },
          ticks: { callback: (v) => fmtMoney(v * unitDiv()) },
        },
        y1: {
          position: "right",
          title: { display: true, text: t("chartPctAch") },
          min: 0,
          grid: { drawOnChartArea: false },
          ticks: { callback: (v) => `${v}%` },
        },
      },
    },
  });
}

function renderAccountRankingBar(slice) {
  if (typeof Chart === "undefined") return;
  const rows = slice.accounts.slice(0, 10);
  const labels = rows.map((r) => shortLabel(r.account, 18));
  const values = rows.map((r) => r.actual / unitDiv());
  const colors = rows.map((r) => (r.achievement >= 0.5 ? "#1A7A4A" : "#C42E2E"));

  destroyChart("account-bar");
  charts["account-bar"] = new Chart(document.getElementById("chart-account-bar"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: t("performance"),
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: "end",
          align: "right",
          color: THEME.navy,
          font: { weight: "600", size: 10 },
          formatter: (v) => chartValueLabel(v),
        },
        tooltip: {
          callbacks: {
            title: (items) => rows[items[0]?.dataIndex]?.account ?? "",
            label: (ctx) => {
              const row = rows[ctx.dataIndex];
              return [
                `${t("performance")}: ${fmtMil(row.actual)}`,
                `${t("target")}: ${fmtMil(row.target)}`,
                `${t("tooltipShare")}: ${fmtPct(row.share)}`,
                `${t("tooltipPctAch")}: ${fmtPct(row.achievement)}`,
                row.yoy != null ? `${t("tooltipLy")}: ${fmtYoy(row.yoy)}` : `${t("tooltipLy")}: —`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: t("axisPerfVnd") },
          ticks: { callback: (v) => fmtMoney(v * unitDiv()) },
        },
        y: { reverse: true, ticks: { font: { size: 11 } } },
      },
    },
  });
}

function renderSharePie(slice) {
  if (typeof Chart === "undefined") return;
  const top = slice.accounts.slice(0, 10);
  const labels = top.map((r) => shortLabel(r.account, 20));

  destroyChart("account-pie");
  charts["account-pie"] = new Chart(document.getElementById("chart-account-pie"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: top.map((r) => r.share * 100),
          backgroundColor: PIE_COLORS.slice(0, top.length),
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
        datalabels: {
          display: (ctx) => ctx.dataset.data[ctx.dataIndex] >= 5,
          formatter: (v) => `${v.toFixed(1)}%`,
          color: "#fff",
          font: { weight: "600", size: 10 },
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const row = top[c.dataIndex];
              return `${c.label}: ${c.raw.toFixed(1)}% · ${fmtMil(row.actual)}`;
            },
          },
        },
      },
    },
  });
}

function renderAccountTable(slice) {
  const showLy = slice.ly_available;
  const tbody = document.querySelector("#account-table tbody");
  tbody.innerHTML = slice.accounts
    .map(
      (r) => `
      <tr>
        <td>${r.rank}</td>
        <td>${r.account}</td>
        <td>${fmtMil(r.target)}</td>
        <td>${fmtMil(r.actual)}</td>
        <td class="${achievementClass(r.achievement)}">${fmtPct(r.achievement)}</td>
        <td>${fmtPct(r.share)}</td>
        <td class="${yoyClass(r.yoy)}">${showLy && r.yoy != null ? fmtYoy(r.yoy) : "—"}</td>
      </tr>`,
    )
    .join("");
}

function mergeFilterOptions(monthIds) {
  const staff = new Set(["all"]);
  const customers = new Set(["all"]);
  for (const mid of monthIds) {
    const opts = data.meta.filters[mid];
    if (!opts) continue;
    opts.staff.forEach((s) => staff.add(s));
    opts.customers.forEach((c) => customers.add(c));
  }
  return {
    staff: ["all", ...[...staff].filter((s) => s !== "all").sort()],
    customers: ["all", ...[...customers].filter((c) => c !== "all").sort()],
  };
}

function populateProvinceFilter(monthIds) {
  const provSel = document.getElementById("filter-province");
  const prev = provSel.value;
  const provinces = new Set();
  for (const mid of monthIds) {
    const b = data.bundles?.[mid];
    if (!b) continue;
    (b.provinces || []).forEach((p) => provinces.add(p));
  }
  const sorted = [...provinces].sort((a, b) => a.localeCompare(b, "vi"));
  provSel.innerHTML = `<option value="all">${t("allProvinces")}</option>${sorted
    .map((p) => `<option value="${p.replace(/"/g, "&quot;")}">${p}</option>`)
    .join("")}`;
  if (prev !== "all" && sorted.includes(prev)) provSel.value = prev;
  else provSel.value = "all";
}

function populateFilters(monthId) {
  const year = document.getElementById("filter-year").value;
  const monthValue = document.getElementById("filter-month").value;
  const monthIds = monthValue === "all" ? getMonthIdsForYear(year) : [monthId || `${year}-${monthValue}`];
  populateProvinceFilter(monthIds);
  const opts = isAllMonthsSelected()
    ? mergeFilterOptions(getMonthIdsForYear(year))
    : data.meta.filters[monthId];
  if (!opts) return;
  const staffSel = document.getElementById("filter-staff");
  const custSel = document.getElementById("filter-customer");
  const prevStaff = staffSel.value;
  const prevCust = custSel.value;

  staffSel.innerHTML = opts.staff
    .map((s) => `<option value="${s}">${s === "all" ? t("allStaff") : s}</option>`)
    .join("");
  custSel.innerHTML = opts.customers
    .map((c) => `<option value="${c}">${c === "all" ? t("allCustomer") : c}</option>`)
    .join("");

  if (opts.staff.includes(prevStaff)) staffSel.value = prevStaff;
  if (opts.customers.includes(prevCust)) custSel.value = prevCust;
}

function render() {
  if (!data) return;
  try {
    renderDashboard();
  } catch (err) {
    console.error(err);
    setLoading(false);
    document.getElementById("meta-subtitle").textContent = t("loadError");
  }
}

function renderDashboard() {
  const year = document.getElementById("filter-year").value;
  const periodLabel = getPeriodLabel();
  const month = getSelectedMonthId();

  if (!isAllMonthsSelected() && !monthHasData(year, parseInt(month.split("-")[1], 10))) {
    renderEmptyState(periodLabel);
    return;
  }

  if (isAllMonthsSelected() && getMonthIdsForYear(year).length === 0) {
    renderEmptyState(periodLabel);
    return;
  }

  populateFilters(month);
  const slice = getSlice(month);
  if (!slice) {
    renderEmptyState(periodLabel);
    return;
  }

  const monthMeta = month ? data.meta.months.find((m) => m.id === month) : null;
  document.getElementById("meta-subtitle").textContent = formatUpdatedSubtitle();

  renderKpis(slice, monthMeta);
  renderCategoryChart(slice);
  renderAccountRankingBar(slice);
  renderSharePie(slice);
  renderAccountTable(slice);
  setLoading(false);
}

function onYearChange() {
  const monthSel = document.getElementById("filter-month");
  const prev = monthSel.value === "all" ? "all" : parseInt(monthSel.value, 10);
  populateMonthFilter(prev);
  document.getElementById("filter-staff").value = "all";
  document.getElementById("filter-customer").value = "all";
  document.getElementById("filter-region").value = "all";
  document.getElementById("filter-province").value = "all";
  render();
}

function onMonthChange() {
  document.getElementById("filter-staff").value = "all";
  document.getElementById("filter-customer").value = "all";
  document.getElementById("filter-region").value = "all";
  document.getElementById("filter-province").value = "all";
  render();
}

async function loadData() {
  if (window.DASHBOARD_DATA) return window.DASHBOARD_DATA;

  if (location.protocol === "file:") {
    return loadMetricsScript();
  }

  setLoading(true, "loadingFetch");
  try {
    const res = await fetch("data/metrics.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("metrics.json fetch failed, fallback to metrics.js", err);
    return loadMetricsScript();
  }
}

function showFatalError(err) {
  console.error(err);
  setLoading(false);
  const sub = document.getElementById("meta-subtitle");
  if (sub) sub.textContent = typeof t === "function" ? t("loadError") : "Load error";
}

function onLangChangeRefresh() {
  const monthSel = document.getElementById("filter-month");
  const prev = monthSel.value === "all" ? "all" : parseInt(monthSel.value, 10);
  populateMonthFilter(prev);
  render();
}

async function init() {
  setLoading(true, "loadingFetch");
  try {
    if (location.protocol === "file:") {
      const waitEl = document.getElementById("loading-message");
      if (waitEl) waitEl.textContent = `${t("loadingFetch")} · ${t("loadingWait")}`;
    }

    data = await loadData();
    setLoading(true, "loadingRender");

    populateYearFilter();

    const defaultMonth = data.meta.default_month || data.meta.months[0]?.id;
    if (defaultMonth) {
      const { year, monthNum } = parseMonthId(defaultMonth);
      document.getElementById("filter-year").value = year;
      populateMonthFilter(monthNum);
    } else {
      populateMonthFilter();
    }

    initI18n(onLangChangeRefresh);

    document.getElementById("filter-year").addEventListener("change", onYearChange);
    document.getElementById("filter-month").addEventListener("change", onMonthChange);
    document.getElementById("filter-staff").addEventListener("change", render);
    document.getElementById("filter-customer").addEventListener("change", render);
    document.getElementById("filter-region").addEventListener("change", render);
    document.getElementById("filter-province").addEventListener("change", render);
    render();
  } catch (err) {
    setLoading(false);
    throw err;
  }
}

init().catch(showFatalError);

window.addEventListener("error", (event) => {
  showFatalError(event.error || event.message);
});
