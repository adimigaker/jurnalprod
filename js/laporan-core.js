// ==================== LAPORAN CORE (logika murni, UMD) ====================
(function (global) {
    "use strict";

    const pad = n => String(n).padStart(2, "0");
    const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    function addDays(dateStr, n) {
        const d = new Date(dateStr + "T00:00:00");
        d.setDate(d.getDate() + n);
        return toYMD(d);
    }

    function daysInRange(from, to) {
        const ms = new Date(to + "T00:00:00") - new Date(from + "T00:00:00");
        return Math.round(ms / 86400000) + 1;
    }

    function fmtLong(d) {
        return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
            weekday: "long", day: "numeric", month: "long", year: "numeric"
        });
    }
    function fmtShort(d) {
        return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric"
        });
    }

    function rangeForPeriod(period, value) {
        if (period === "harian") {
            return { from: value, to: value, label: fmtLong(value) };
        }
        if (period === "mingguan") {
            const m = String(value).match(/^(\d{4})-W(\d{1,2})$/);
            if (!m) throw new Error("Format minggu salah: " + value);
            const year = +m[1], week = +m[2];
            const jan4 = new Date(year, 0, 4);
            const jan4Day = jan4.getDay() || 7; // Senin=1 .. Minggu=7
            const mondayOfWeek1 = new Date(year, 0, 4 - (jan4Day - 1));
            const monday = new Date(mondayOfWeek1);
            monday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
            const from = toYMD(monday);
            const to = addDays(from, 6);
            return { from, to, label: `Minggu ${fmtShort(from)} – ${fmtShort(to)}` };
        }
        if (period === "bulanan") {
            const m = String(value).match(/^(\d{4})-(\d{2})$/);
            if (!m) throw new Error("Format bulan salah: " + value);
            const from = `${m[1]}-${m[2]}-01`;
            const last = new Date(+m[1], +m[2], 0).getDate();
            const to = `${m[1]}-${m[2]}-${pad(last)}`;
            const label = new Date(+m[1], +m[2] - 1, 1)
                .toLocaleDateString("id-ID", { month: "long", year: "numeric" });
            return { from, to, label };
        }
        return { from: value.from, to: value.to, label: `${fmtShort(value.from)} – ${fmtShort(value.to)}` };
    }

    const TIM_KEYS = ["kecil", "besar", "smp", "balita", "busui"];
    const TIM_LABELS = { kecil: "Kecil", besar: "Besar", smp: "SMP", balita: "Balita", busui: "Busui" };

    function colKeys(p) {
        if (p.sample) return TIM_KEYS;
        if (p.split) return ["kecil", "besar"];
        return ["single"];
    }
    function colLabels(p) {
        if (p.sample) return TIM_LABELS;
        if (p.split) return { kecil: "Kecil", besar: "Besar" };
        return { single: "Produksi" };
    }
    function colTarget(p, col) {
        if (p.sample) return 0;
        if (col === "kecil") return p.targetKecil || 0;
        if (col === "besar") return p.targetBesar || 0;
        return p.targetSingle || 0;
    }
    function colTotal(p, col) {
        if (p.sample) return p.containers[col] && p.containers[col].berat || 0;
        return (p.containers[col] || []).reduce((s, c) => s + (c.val || 0) * (c.mult || 1), 0);
    }
    function productTotal(p) {
        return colKeys(p).reduce((s, c) => s + colTotal(p, c), 0);
    }
    function productTarget(p) {
        if (p.sample) return 0;
        if (p.split) return (p.targetKecil || 0) + (p.targetBesar || 0);
        return p.targetSingle || 0;
    }

    function timTotals(rows) {
        return TIM_KEYS.map(k => ({
            key: k,
            label: TIM_LABELS[k],
            berat: Math.round(
                rows.reduce((s, p) => s + ((p.containers && p.containers[k] && p.containers[k].berat) || 0), 0) * 100
            ) / 100,
            porsi: rows.reduce((s, p) => s + ((p.containers && p.containers[k] && p.containers[k].porsi) || 0), 0)
        }));
    }

    function filterProducts(products, { from, to, names, mode }) {
        return products
            .filter(p => p.date >= from && p.date <= to)
            .filter(p => !names || names.size === 0 || names.has(p.name))
            .filter(p =>
                mode === "all" ||
                (mode === "single" && !p.split && !p.sample) ||
                (mode === "split" && p.split) ||
                (mode === "sample" && p.sample)
            )
            .sort((a, b) => {
                if (a.date !== b.date) return a.date < b.date ? -1 : 1;
                return (a.order || 0) - (b.order || 0);
            });
    }

    function aggregateStats(rows, days) {
        const byName = {};
        rows.forEach(p => {
            if (!byName[p.name]) byName[p.name] = { name: p.name, sample: p.sample, rows: [] };
            byName[p.name].rows.push(p);
        });

        const products = Object.values(byName).map(entry => {
            const total = Math.round(entry.rows.reduce((s, p) => s + productTotal(p), 0) * 100) / 100;
            const target = Math.round(entry.rows.reduce((s, p) => s + productTarget(p), 0) * 100) / 100;
            return {
                name: entry.name,
                sample: entry.sample,
                unit: entry.sample ? "kg" : "pcs",
                total,
                target,
                pencapaian: target > 0 ? Math.round((total / target) * 100) : null,
                perHari: days > 0 ? Math.round((total / days) * 100) / 100 : total
            };
        });

        return { days, uniqueProducts: products.length, products };
    }

    function groupByDate(rows) {
        const map = {};
        rows.forEach(p => {
            if (!map[p.date]) map[p.date] = [];
            map[p.date].push(p);
        });
        return Object.keys(map)
            .sort()
            .reverse()
            .map(date => {
                const items = map[date];
                return {
                    date,
                    label: fmtLong(date),
                    items,
                    dayPcs: Math.round(
                        items.filter(p => !p.sample).reduce((s, p) => s + productTotal(p), 0) * 100
                    ) / 100,
                    dayKg: Math.round(
                        items.filter(p => p.sample).reduce((s, p) => s + productTotal(p), 0) * 100
                    ) / 100
                };
            });
    }

    const core = {
        addDays,
        daysInRange,
        fmtLong,
        fmtShort,
        rangeForPeriod,
        TIM_KEYS,
        TIM_LABELS,
        colKeys,
        colLabels,
        colTarget,
        colTotal,
        productTotal,
        productTarget,
        timTotals,
        filterProducts,
        aggregateStats,
        groupByDate
    };

    if (typeof module !== "undefined" && module.exports) module.exports = core;
    else global.LaporanCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this);
