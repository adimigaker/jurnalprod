// Tes logika murni laporan — jalan: node dev/test-laporan-core.cjs
const assert = require("assert");
const C = require("../js/laporan-core.js");

// --- addDays & daysInRange ---
assert.strictEqual(C.addDays("2026-08-13", 1), "2026-08-14");
assert.strictEqual(C.addDays("2026-12-31", 1), "2027-01-01");
assert.strictEqual(C.daysInRange("2026-08-10", "2026-08-16"), 7);
assert.strictEqual(C.daysInRange("2026-08-13", "2026-08-13"), 1);

// --- rangeForPeriod ---
assert.deepStrictEqual(C.rangeForPeriod("harian", "2026-08-13"),
    { from: "2026-08-13", to: "2026-08-13", label: "Kamis, 13 Agustus 2026" });
assert.deepStrictEqual(C.rangeForPeriod("mingguan", "2026-W33"),
    { from: "2026-08-10", to: "2026-08-16", label: "Minggu 10 Agu 2026 – 16 Agu 2026" });
assert.deepStrictEqual(C.rangeForPeriod("bulanan", "2026-08"),
    { from: "2026-08-01", to: "2026-08-31", label: "Agustus 2026" });
assert.deepStrictEqual(C.rangeForPeriod("bulanan", "2026-02"),
    { from: "2026-02-01", to: "2026-02-28", label: "Februari 2026" });
assert.strictEqual(C.rangeForPeriod("kustom", { from: "2026-08-01", to: "2026-08-10" }).from, "2026-08-01");
assert.throws(() => C.rangeForPeriod("mingguan", "2026-13"), /Format minggu/);

// --- totals ---
const ayam = {
    id: "1", name: "Ayam Geprek", date: "2026-08-13", split: true,
    containers: { kecil: [{ val: 5, mult: 2 }, { val: 3, mult: 1 }], besar: [{ val: 1, mult: 10 }] },
    targetKecil: 10, targetBesar: 5, order: 0
};
assert.strictEqual(C.productTotal(ayam), 23);
assert.strictEqual(C.productTarget(ayam), 15);
assert.strictEqual(C.colTotal(ayam, "kecil"), 13);
assert.strictEqual(C.colTarget(ayam, "besar"), 5);

const dimsum = {
    id: "2", name: "Dimsum", date: "2026-08-13", split: false, sample: false,
    containers: { single: [{ val: 20, mult: 1 }] }, targetSingle: 15, order: 1
};
assert.strictEqual(C.productTotal(dimsum), 20);
assert.strictEqual(C.productTarget(dimsum), 15);

const sample = {
    id: "3", name: "Nasi Goreng", date: "2026-08-14", sample: true,
    containers: { raw: [{ val: 5, mult: 1 }], soaked: [{ val: 4, mult: 1 }], stirfried: [{ val: 3, mult: 1 }] }
};
assert.strictEqual(C.productTotal(sample), 12);
assert.strictEqual(C.productTarget(sample), 0);

// --- filterProducts ---
const rows = [ayam, dimsum, sample];
assert.deepStrictEqual(C.filterProducts(rows, { from: "2026-08-01", to: "2026-08-31", names: null, mode: "all" }), rows);
assert.deepStrictEqual(C.filterProducts(rows, { from: "2026-08-01", to: "2026-08-31", names: null, mode: "split" }).map(p => p.name), ["Ayam Geprek"]);
assert.deepStrictEqual(C.filterProducts(rows, { from: "2026-08-01", to: "2026-08-31", names: new Set(["Dimsum"]), mode: "all" }).map(p => p.name), ["Dimsum"]);
assert.deepStrictEqual(C.filterProducts(rows, { from: "2026-08-13", to: "2026-08-13", names: null, mode: "all" }).map(p => p.name), ["Ayam Geprek", "Dimsum"]);

// --- aggregateStats ---
const st = C.aggregateStats(rows, 2);
assert.strictEqual(st.days, 2);
assert.strictEqual(st.uniqueProducts, 3);
assert.strictEqual(st.totalProduksi, 55);
assert.strictEqual(st.totalTarget, 30);
assert.strictEqual(st.pencapaian, 183);
assert.strictEqual(st.perHari, 27.5);
assert.deepStrictEqual(st.topProducts.map(t => t.name), ["Ayam Geprek", "Dimsum", "Nasi Goreng"]);
assert.strictEqual(st.topProducts[0].total, 23);

const stNoTarget = C.aggregateStats([sample], 1);
assert.strictEqual(stNoTarget.pencapaian, null);

// --- groupByDate ---
const g = C.groupByDate([dimsum, ayam, sample]);
assert.deepStrictEqual(g.map(x => x.date), ["2026-08-14", "2026-08-13"]);
assert.strictEqual(g[1].dayTotal, 43);
assert.strictEqual(g[1].items.length, 2);

console.log("OK — semua tes lulus");
