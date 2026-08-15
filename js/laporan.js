// ==================== LAPORAN (LAYAR PENUH) ====================
let lpPeriod = "harian";
let lpValue = today();
let lpMode = "all";
let lpQuery = "";

const LP_MODE_LABEL = p =>
    p.sample ? "Timbangan" : p.split ? "Split" : "Single";

function lpColsHtml(p) {
    const keys = LaporanCore.colKeys(p);
    const labels = LaporanCore.colLabels(p);
    return keys
        .map(k => {
            const total = LaporanCore.colTotal(p, k);
            if (p.sample) {
                const c = p.containers[k] || {};
                return `<span class="lp-cols-item">${labels[k]} ${fmtBerat(total)} kg${c.porsi ? ` · ${fmtPorsi(c.porsi)} porsi` : ""}</span>`;
            }
            const target = LaporanCore.colTarget(p, k);
            const tgt = !target ? "" : ` / ${formatNumberForDisplay(target)}`;
            return `<span class="lp-cols-item">${labels[k]} ${formatNumberForDisplay(total)}${tgt}</span>`;
        })
        .join("");
}

function lpStatsHtml(stats, rows) {
    let h = "";
    for (const p of stats.products) {
        const pct = p.pencapaian === null
            ? ""
            : ` · ${p.pencapaian >= 100 ? "✓" : p.pencapaian + "%"}`;
        const subtitle = p.unit + pct;
        const nStat = 1 + (p.target > 0 ? 1 : 0);
        h += `
            <div class="lp-section"><div class="lp-section-title">${esc(p.name)} <span style="font-weight:400;text-transform:none;letter-spacing:0">(${subtitle})</span></div></div>
            <div class="lp-stats-grid" style="grid-template-columns:repeat(${nStat},1fr)">
                <div class="lp-stat"><div class="lp-stat-label">Total Produksi</div><div class="lp-stat-val">${formatNumberForDisplay(p.total)} ${p.unit}</div></div>
                ${p.target > 0 ? `<div class="lp-stat"><div class="lp-stat-label">Target</div><div class="lp-stat-val">${formatNumberForDisplay(p.target)} ${p.unit}</div></div>` : ""}
            </div>`;
        if (p.sample) {
            const productRows = rows.filter(r => r.name === p.name);
            const tt = LaporanCore.timTotals(productRows);
            h += `<div class="lp-tim-grid">` + tt.map(t => `
                <div class="lp-tim-row">
                    <span class="lp-tim-label">${t.label}</span>
                    <span class="lp-tim-val">${fmtBerat(t.berat)} kg</span>
                    <span class="lp-tim-val">${t.porsi > 0 ? fmtPorsi(t.porsi) + " porsi" : "–"}</span>
                </div>`).join("") + `</div>`;
        }
    }
    return h;
}

function lpGroupsHtml(groups) {
    if (!groups.length) return '<div class="lp-empty">Tidak ada data pada periode ini.</div>';
    return groups
        .map(g => {
            const totals = [];
            if (g.dayPcs > 0) totals.push(formatNumberForDisplay(g.dayPcs) + " pcs");
            if (g.dayKg > 0) totals.push(formatNumberForDisplay(g.dayKg) + " kg");
            const totalStr = totals.join(" · ") || "—";
            return `
            <div class="lp-day">
                <div class="lp-day-head">
                    <span class="lp-day-label">${g.label}</span>
                    <span class="lp-day-total">${totalStr}</span>
                </div>
                ${g.items
                    .map(p => `
                        <div class="lp-item">
                            <div class="lp-item-head">
                                <span class="lp-item-name">${esc(p.name)}</span>
                                <span class="lp-item-mode">${LP_MODE_LABEL(p)}</span>
                                <span class="lp-item-total">${formatNumberForDisplay(LaporanCore.productTotal(p))} ${p.unit}</span>
                            </div>
                            <div class="lp-cols">${lpColsHtml(p)}</div>
                            ${p.note ? `<div class="lp-note">${esc(p.note)}</div>` : ""}
                        </div>`)
                    .join("")}
            </div>`;
        })
        .join("");
}

function lpRange() {
    return LaporanCore.rangeForPeriod(lpPeriod, lpValue);
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

function lpReportData() {
    const range = lpRange();
    const rows = LaporanCore.filterProducts(DB.get(), {
        from: range.from,
        to: range.to,
        names: null,
        mode: lpMode
    }).filter(p => !lpQuery || p.name.toLowerCase().includes(lpQuery.toLowerCase()));
    const stats = LaporanCore.aggregateStats(rows);
    const groups = LaporanCore.groupByDate(rows);
    return { range, stats, groups };
}

function renderLaporanBody() {
    const { range, stats, groups } = lpReportData();
    const rows = groups.flatMap(g => g.items);
    const body = $("#lpBody");
    if (!body) return;
    body.innerHTML = `
        <div class="lp-period-label">${range.label}</div>
        ${lpStatsHtml(stats, rows)}
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
                    <button class="lp-chip ${lpMode === "sample" ? "on" : ""}" data-mode="sample">Timbangan</button>
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

// ==================== EKSPOR GAMBAR ====================
const LP_IMG = { bg: "#f8fafc", text: "#0f172a", muted: "#64748b", accent: "#388bfd", barBg: "#e2e8f0", cardBg: "#ffffff", border: "#e2e8f0" };
const lpClip = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);

function lpExportHeight(stats, groups) {
    let h = 232; // title + label + jarak awal
    for (const p of stats.products) {
        h += 28 + 136 + 72; // section header + stat grid + gap
        if (p.sample) h += 5 * 52 + 72; // timbangan rows
    }
    h += 48; // header DAFTAR HARIAN
    for (const g of groups) {
        h += 80 + g.items.reduce((s, p) => s + (p.note ? 176 : 128), 0) + 16;
    }
    return Math.max(h + 72, 720);
}

function exportLaporanImage() {
    const { range, stats, groups } = lpReportData();
    const allRows = groups.flatMap(g => g.items);
    const W = 1080;
    const H = lpExportHeight(stats, groups);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const pad = 48;

    const text = (s, x, y, size, weight, color, align) => {
        ctx.font = `${weight || 400} ${size}px sans-serif`;
        ctx.fillStyle = color || LP_IMG.text;
        ctx.textAlign = align || "left";
        ctx.fillText(s, x, y);
    };

    ctx.fillStyle = LP_IMG.bg;
    ctx.fillRect(0, 0, W, H);

    text("Laporan Produksi", pad, 124, 72, 700);
    text(range.label, pad, 184, 40, 400, LP_IMG.muted);

    // --- statistik per produk ---
    const boxH = 136;
    let y = 232;

    const drawStatBox = (label, val, x, yy, w) => {
        ctx.fillStyle = LP_IMG.cardBg;
        ctx.beginPath();
        ctx.roundRect(x, yy, w, boxH, 16);
        ctx.fill();
        ctx.strokeStyle = LP_IMG.border;
        ctx.lineWidth = 2;
        ctx.stroke();
        text(label, x + w / 2, yy + 48, 32, 400, LP_IMG.muted, "center");
        text(val, x + w / 2, yy + 108, 44, 700, LP_IMG.text, "center");
    };

    for (const p of stats.products) {
        const pct = p.pencapaian === null ? "" : ` · ${p.pencapaian}%`;
        text(lpClip(`${p.name.toUpperCase()} (${p.unit}${pct})`, 36), pad, y, 32, 700, LP_IMG.muted);
        y += 28;
        const items = [
            ["Total Produksi", `${formatNumberForDisplay(p.total)} ${p.unit}`],
        ];
        if (p.target > 0) items.push(["Target", `${formatNumberForDisplay(p.target)} ${p.unit}`]);
        const boxW = (W - pad * 2 - (items.length - 1) * 16) / items.length;
        items.forEach(([label, val], i) => {
            drawStatBox(label, val, pad + i * (boxW + 16), y, boxW);
        });
        y += boxH + 72;
        if (p.sample) {
            const tt = LaporanCore.timTotals(allRows.filter(r => r.name === p.name));
            for (const t of tt) {
                ctx.font = "600 32px sans-serif";
                const desc = ctx.measureText(t.label).actualBoundingBoxDescent || 12;
                text(t.label, pad, y + 8, 32, 600);
                text(fmtBerat(t.berat) + " kg", W - pad - 176, y + 8, 32, 700, LP_IMG.text, "right");
                text(t.porsi > 0 ? fmtPorsi(t.porsi) + " porsi" : "–", W - pad, y + 8, 32, 700, LP_IMG.accent, "right");
                ctx.fillStyle = LP_IMG.border;
                ctx.fillRect(pad, y + 8 + desc + 10, W - pad * 2, 1);
                y += 52;
            }
            y += 72;
        }
    }

    // --- daftar harian ---
    text("DAFTAR HARIAN", pad, y, 32, 700, LP_IMG.muted);
    y += 48;
    for (const g of groups) {
        ctx.fillStyle = LP_IMG.cardBg;
        ctx.beginPath();
        ctx.roundRect(pad, y, W - pad * 2, 80, 16);
        ctx.fill();
        text(g.label, pad + 28, y + 52, 32, 700);
        const dayTotals = [];
        if (g.dayPcs > 0) dayTotals.push(formatNumberForDisplay(g.dayPcs) + " pcs");
        if (g.dayKg > 0) dayTotals.push(formatNumberForDisplay(g.dayKg) + " kg");
        text(dayTotals.join(" · ") || "—", W - pad - 28, y + 52, 32, 700, LP_IMG.accent, "right");
        y += 80;
        for (const p of g.items) {
            const ih = p.note ? 176 : 128;
            text("• " + lpClip(p.name, 26), pad + 28, y + 44, 32, 600);
            text(`${formatNumberForDisplay(LaporanCore.productTotal(p))} ${p.unit}`, W - pad - 28, y + 44, 32, 700, LP_IMG.text, "right");
            const cols = LaporanCore.colKeys(p)
                .map(k => `${LaporanCore.colLabels(p)[k]} ${formatNumberForDisplay(LaporanCore.colTotal(p, k))}`)
                .join(" · ");
            text(lpClip(cols, 60), pad + 56, y + 88, 28, 400, LP_IMG.muted);
            if (p.note) text(lpClip(p.note, 55), pad + 56, y + 124, 24, 400, LP_IMG.muted);
            y += ih;
        }
        y += 16;
    }

    canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], "laporan-produksi.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: "Laporan Produksi" }).catch(() => {});
        } else {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = file.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        }
    }, "image/png");
}
