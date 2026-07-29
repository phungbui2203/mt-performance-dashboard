const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_VI = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

const I18N = {
  vi: {
    pageTitle: "Báo cáo MT Performance — CEO",
    dashboardTitle: "Báo cáo MT Performance",
    loading: "Đang tải dữ liệu…",
    loadingFetch: "Đang tải dữ liệu báo cáo…",
    loadingRender: "Đang hiển thị báo cáo…",
    loadingWait: "Dữ liệu lớn, có thể mất 10–30 giây",
    loadError: "Không tải được dữ liệu. Chạy: python build_mt_dashboard_data.py",
    filterGroup: "Bộ lọc dashboard",
    langGroup: "Ngôn ngữ",
    year: "Năm",
    month: "Tháng",
    staff: "Nhân viên",
    customer: "Khách hàng",
    region: "Vùng",
    province: "Tỉnh / TP",
    allRegions: "Tất cả vùng",
    allProvinces: "Tất cả tỉnh",
    allMonths: "Tất cả tháng",
    allStaff: "Tất cả nhân viên",
    allCustomer: "Tất cả khách hàng",
    executiveSummary: "Tổng quan điều hành",
    performance: "Thực hiện",
    target: "Chỉ tiêu",
    pctAchievement: "% Đạt chỉ tiêu",
    pctVsLy: "% So với tháng trước",
    unitVnd: "VND (K / M / B)",
    unitMil: "M",
    unitBil: "B",
    unitThou: "K",
    perfOverTarget: "Thực hiện / Chỉ tiêu",
    yoyDefault: "Tăng trưởng so với tháng trước",
    lyNote: "Chưa có dữ liệu tháng trước",
    na: "Không có",
    noData: "Chưa có dữ liệu",
    updatedAt: "Cập nhật: {date}",
    allMonthsYear: "Tất cả tháng {year}",
    monthYear: "{month} {year}",
    allMonthsPrior: "Tất cả tháng {year}",
    monthPrior: "{month} {year}",
    monthFallback: "Tháng {n}",
    categorySection: "Theo dõi thực hiện theo ngành hàng",
    accountSection: "Theo dõi thực hiện theo khách hàng",
    rankingPerformance: "Top 10 — Xếp hạng thực hiện",
    performanceShare: "Tỷ trọng thực hiện (%)",
    detailTable: "Bảng chi tiết",
    colCustomer: "Khách hàng",
    colTarget: "Chỉ tiêu",
    colPerformance: "Thực hiện",
    colPctAch: "% Đạt",
    colShare: "Tỷ trọng",
    colLy: "So với T-1",
    chartPctAch: "% Đạt chỉ tiêu",
    axisVnd: "K / M / B VND",
    axisPerfVnd: "Thực hiện (K / M / B VND)",
    tooltipShare: "Tỷ trọng",
    tooltipPctAch: "% Đạt",
    tooltipLy: "So với tháng trước",
  },
  en: {
    pageTitle: "MT Performance — CEO Dashboard",
    dashboardTitle: "MT Performance Dashboard",
    loading: "Loading data…",
    loadingFetch: "Loading report data…",
    loadingRender: "Rendering dashboard…",
    loadingWait: "Large dataset — may take 10–30 seconds",
    loadError: "Could not load data. Run: python build_mt_dashboard_data.py",
    filterGroup: "Dashboard filters",
    langGroup: "Language",
    year: "Year",
    month: "Month",
    staff: "Staff",
    customer: "Customer",
    region: "Region",
    province: "Province",
    allRegions: "All regions",
    allProvinces: "All provinces",
    allMonths: "All months",
    allStaff: "All Staff",
    allCustomer: "All Customers",
    executiveSummary: "Executive Summary",
    performance: "Performance",
    target: "Target",
    pctAchievement: "% Target Achievement",
    pctVsLy: "% vs Prior Month",
    unitVnd: "VND (K / M / B)",
    unitMil: "M",
    unitBil: "B",
    unitThou: "K",
    perfOverTarget: "Performance/Target",
    yoyDefault: "Growth vs prior month",
    lyNote: "No prior-month data",
    na: "N/A",
    noData: "No data available",
    updatedAt: "Updated: {date}",
    allMonthsYear: "All months {year}",
    monthYear: "{month} {year}",
    allMonthsPrior: "All months {year}",
    monthPrior: "{month} {year}",
    monthFallback: "Month {n}",
    categorySection: "Tracking Performance by Category",
    accountSection: "Tracking Performance by Account",
    rankingPerformance: "Top 10 Performance Ranking",
    performanceShare: "Performance (%)",
    detailTable: "Detail Table",
    colCustomer: "Customer",
    colTarget: "Target",
    colPerformance: "Performance",
    colPctAch: "% Ach.",
    colShare: "Share",
    colLy: "vs T-1",
    chartPctAch: "% Target Achievement",
    axisVnd: "K / M / B VND",
    axisPerfVnd: "Performance (K / M / B VND)",
    tooltipShare: "Share",
    tooltipPctAch: "% Ach.",
    tooltipLy: "vs prior month",
  },
};

let currentLang = localStorage.getItem("mt-dashboard-lang") || "vi";
let langChangeHandler = null;

function getLang() {
  return currentLang;
}

function getMonthNames() {
  return currentLang === "vi" ? MONTH_NAMES_VI : MONTH_NAMES_EN;
}

function t(key, vars = {}) {
  const dict = I18N[currentLang] || I18N.vi;
  let str = dict[key] ?? I18N.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.split(`{${k}}`).join(String(v));
  }
  return str;
}

function applyStaticI18n() {
  document.documentElement.lang = currentLang === "vi" ? "vi" : "en";
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el.id === "meta-subtitle" || el.id === "kpi-yoy-sub") return;
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.lang === currentLang);
    btn.setAttribute("aria-pressed", btn.dataset.lang === currentLang ? "true" : "false");
  });
}

function setLang(lang) {
  if (!I18N[lang] || lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem("mt-dashboard-lang", lang);
  applyStaticI18n();
  if (langChangeHandler) langChangeHandler();
}

function onLangChange(handler) {
  langChangeHandler = handler;
}

function initI18n(handler) {
  onLangChange(handler);
  applyStaticI18n();
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });
}
