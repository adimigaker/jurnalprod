// ==================== LAPORAN (LAYAR PENUH) ====================
let lpPeriod = "harian";
let lpValue = today();
let lpMode = "all";
let lpQuery = "";

const LP_MODE_LABEL = p =>
    p.sample ? "Sample" : p.split ? "Split" : "Single";

function lpColsHtml(p) {
    const keys = LaporanCore.colKeys(p);
    const labels = LaporanCore.colLabels(p);
    return keys
        .map(k => {
            const total = LaporanCore.colTotal(p, k);
            const target = LaporanCore.colTarget(p, k);
            const tgt = p.sample || !target ? "" : ` / ${formatNumberForDisplay(target)}`;
            return `<span class="lp-cols-item">${labels[k]} ${formatNumberForDisplay(total)}${tgt}</span>`;
        })
        .join("");
}

function lpStatsHtml(stats) {
    const pct =
        stats.pencapaian === null
            ? '<span class="lp-stat-val">—</span>'
            : `<span class="lp-stat-val ${stats.pencapaian >= 100 ? "lp-ok" : "lp-kurang"}">${stats.pencapaian}%</span>`;
    return `
        <div class="lp-stats-grid">
            <div class="lp-stat"><div class="lp-stat-label">Total Produksi</div><div class="lp-stat-val">${formatNumberForDisplay(stats.totalProduksi)}</div></div>
            <div class="lp-stat"><div class="lp-stat-label">Target</div><div class="lp-stat-val">${formatNumberForDisplay(stats.totalTarget)}</div></div>
            <div class="lp-stat"><div class="lp-stat-label">Pencapaian</div>${pct}</div>
            <div class="lp-stat"><div class="lp-stat-label">Produk</div><div class="lp-stat-val">${stats.uniqueProducts}</div></div>
            ${stats.days > 1 ? `<div class="lp-stat"><div class="lp-stat-label">Rata-rata/hari</div><div class="lp-stat-val">${formatNumberForDisplay(stats.perHari)}</div></div>` : ""}
            <div class="lp-stat"><div class="lp-stat-label">Hari</div><div class="lp-stat-val">${stats.days}</div></div>
        </div>`;
}

function lpTopHtml(top) {
    if (!top.length) return "";
    const max = top[0].total || 1;
    const bars = top
        .map(t => `
            <div class="lp-top-row">
                <div class="lp-top-name">${esc(t.name)} <span class="lp-top-days">(${t.days} hari)</span></div>
                <div class="lp-top-bar-wrap">
                    <div class="lp-top-bar" style="width:${Math.round((t.total / max) * 100)}%"></div>
                </div>
                <div class="lp-top-val">${formatNumberForDisplay(t.total)}</div>
            </div>`)
        .join("");
    return `<div class="lp-section"><div class="lp-section-title">Produk Teratas</div>${bars}</div>`;
}

function lpGroupsHtml(groups) {
    if (!groups.length) return '<div class="lp-empty">Tidak ada data pada periode ini.</div>';
    return groups
        .map(g => `
            <div class="lp-day">
                <div class="lp-day-head">
                    <span class="lp-day-label">${g.label}</span>
                    <span class="lp-day-total">${formatNumberForDisplay(g.dayTotal)}</span>
                </div>
                ${g.items
                    .map(p => `
                        <div class="lp-item">
                            <div class="lp-item-head">
                                <span class="lp-item-name">${esc(p.name)}</span>
                                <span class="lp-item-mode">${LP_MODE_LABEL(p)}</span>
                                <span class="lp-item-total">${formatNumberForDisplay(LaporanCore.productTotal(p))}</span>
                            </div>
                            <div class="lp-cols">${lpColsHtml(p)}</div>
                            ${p.note ? `<div class="lp-note">${esc(p.note)}</div>` : ""}
                        </div>`)
                    .join("")}
            </div>`)
        .join("");
}

function lpRange() {
    return LaporanCore.rangeForPeriod(lpPeriod, lpValue);
}

function lpDays(range) {
    return lpPeriod === "harian" ? 1 : LaporanCore.daysInRange(range.from, range.to);
}

function lpPickerHtml() {
    const v = lpValue || today();
    if (lpPeriod === "harian")
        return `<input type="date" class="lp-picker" id="lpPickerInput" value="${v}" />`;
    if (lpPeriod === "mingguan")
        return `<input type="week" class="lp-picker" id="lpPickerInput" value="${v}" />`;
    if (lpPeriod === "bulanan")
        return `<input type="month" class="lp-picker" id="lpPickerInput" value="${v}" />`;
    const r = lpRange();
    return `
        <input type="date" class="lp-picker" id="lpFromInput" value="${r.from}" />
        <span class="lp-picker-sep">–</span>
        <input type="date" class="lp-picker" id="lpToInput" value="${r.to}" />`;
}

function renderLaporanBody() {
    const range = lpRange();
    const rows = LaporanCore.filterProducts(DB.get(), {
        from: range.from,
        to: range.to,
        names: null,
        mode: lpMode
    }).filter(p => !lpQuery || p.name.toLowerCase().includes(lpQuery.toLowerCase()));
    const stats = LaporanCore.aggregateStats(rows, lpDays(range));
    const groups = LaporanCore.groupByDate(rows);
    const body = $("#lpBody");
    if (!body) return;
    body.innerHTML = `
        <div class="lp-period-label">${range.label}</div>
        ${lpStatsHtml(stats)}
        ${lpTopHtml(stats.topProducts)}
        <div class="lp-section"><div class="lp-section-title">Daftar Harian</div></div>
        ${lpGroupsHtml(groups)}`;
}

function renderLaporan() {
    const pg = $("#page-laporan");
    if (!pg) return;
    pg.innerHTML = `
        <div class="lp-toolbar">
            <div class="lp-top">
                <div class="lp-title">Laporan Produksi</div>
                <button class="lp-close" id="lpClose" title="Tutup">×</button>
            </div>
            <div class="lp-chips" id="lpPeriodChips">
                <button class="lp-chip ${lpPeriod === "harian" ? "on" : ""}" data-period="harian">Harian</button>
                <button class="lp-chip ${lpPeriod === "mingguan" ? "on" : ""}" data-period="mingguan">Mingguan</button>
                <button class="lp-chip ${lpPeriod === "bulanan" ? "on" : ""}" data-period="bulanan">Bulanan</button>
                <button class="lp-chip ${lpPeriod === "kustom" ? "on" : ""}" data-period="kustom">Rentang</button>
            </div>
            <div class="lp-shortcuts">
                <button class="lp-chip lp-chip-sm" data-shortcut="today">Hari Ini</button>
                <button class="lp-chip lp-chip-sm" data-shortcut="7d">7 Hari</button>
                <button class="lp-chip lp-chip-sm" data-shortcut="month">Bulan Ini</button>
            </div>
            <div class="lp-picker-row">${lpPickerHtml()}</div>
            <div class="lp-filters">
                <input class="lp-search" id="lpSearch" type="search" placeholder="Cari produk..." value="${esc(lpQuery)}" />
                <div class="lp-chips" id="lpModeChips">
                    <button class="lp-chip ${lpMode === "all" ? "on" : ""}" data-mode="all">Semua</button>
                    <button class="lp-chip ${lpMode === "single" ? "on" : ""}" data-mode="single">Single</button>
                    <button class="lp-chip ${lpMode === "split" ? "on" : ""}" data-mode="split">Split</button>
                    <button class="lp-chip ${lpMode === "sample" ? "on" : ""}" data-mode="sample">Sample</button>
                </div>
            </div>
        </div>
        <div class="lp-body" id="lpBody"></div>
        <div class="lp-actions">
            <button class="lp-share" id="lpShare">Share Gambar</button>
        </div>`;

    pg.removeEventListener("click", lpOnClick);
    pg.addEventListener("click", lpOnClick);
    pg.removeEventListener("change", lpOnChange);
    pg.addEventListener("change", lpOnChange);

    const search = $("#lpSearch");
    if (search) {
        search.removeEventListener("input", lpOnSearch);
        search.addEventListener("input", lpOnSearch);
    }

    renderLaporanBody();
    const picker = $("#lpPickerInput");
    if (picker) picker.focus();
}

function lpOnClick(e) {
    const close = e.target.closest("#lpClose");
    if (close) {
        setTab(prevTab);
        return;
    }
    const periodBtn = e.target.closest("[data-period]");
    if (periodBtn) {
        lpPeriod = periodBtn.dataset.period;
        if (lpPeriod === "harian") lpValue = today();
        if (lpPeriod === "mingguan") lpValue = lpValue || today();
        if (lpPeriod === "bulanan") lpValue = (lpValue || today()).slice(0, 7);
        if (lpPeriod === "kustom") lpValue = { from: lpRange().from, to: lpRange().to };
        renderLaporan();
        return;
    }
    const shortcutBtn = e.target.closest("[data-shortcut]");
    if (shortcutBtn) {
        const t = today();
        const k = shortcutBtn.dataset.shortcut;
        if (k === "today") { lpPeriod = "harian"; lpValue = t; }
        if (k === "7d") { lpPeriod = "kustom"; lpValue = { from: LaporanCore.addDays(t, -6), to: t }; }
        if (k === "month") { lpPeriod = "bulanan"; lpValue = t.slice(0, 7); }
        renderLaporan();
        return;
    }
    const modeBtn = e.target.closest("[data-mode]");
    if (modeBtn) {
        lpMode = modeBtn.dataset.mode;
        renderLaporan();
        return;
    }
    const share = e.target.closest("#lpShare");
    if (share) exportLaporanImage();
}

function lpOnChange(e) {
    const picker = e.target.closest("#lpPickerInput");
    if (picker) {
        lpValue = picker.value;
        renderLaporan();
        return;
    }
    const from = e.target.closest("#lpFromInput");
    const to = e.target.closest("#lpToInput");
    if (from || to) {
        lpValue = { from: $("#lpFromInput").value, to: $("#lpToInput").value };
        renderLaporan();
        return;
    }
}

function lpOnSearch() {
    lpQuery = this.value.trim();
    renderLaporanBody();
}

// Tombol header buka laporan
$("#laporanBtn").addEventListener("click", () => {
    if (currentTab === "laporan") {
        setTab(prevTab);
        return;
    }
    prevTab = currentTab;
    setTab("laporan");
});
