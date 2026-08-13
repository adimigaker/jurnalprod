// ==================== BERANDA (RINGKASAN) ====================
const esc = s =>
    String(s).replace(/[&<>"']/g, m =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
    );

function berandaCard(date, badge) {
    const items = DB.get()
        .filter(p => p.date === date)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const totalProduksi = items.reduce((s, p) => s + LaporanCore.productTotal(p), 0);
    const totalTarget = items.reduce((s, p) => s + LaporanCore.productTarget(p), 0);
    const targetMet =
        totalTarget > 0 ? (totalProduksi >= totalTarget ? "ok" : "kurang") : "none";

    const rows = items.map(p => {
        const cols = LaporanCore.colKeys(p);
        const labels = LaporanCore.colLabels(p);
        const colHtml = cols
            .map(c => {
                if (p.sample) {
                    const cobj = p.containers[c] || {};
                    return `
                <div class="bd-col">
                    <div class="bd-col-label">${labels[c]}</div>
                    <div class="bd-tim-line">
                        <input class="bd-input bd-tim-berat" inputmode="decimal" data-pid="${p.id}" data-col="${c}"
                            value="${fmtBerat(cobj.berat)}" />
                        <input class="bd-input bd-tim-porsi" inputmode="numeric" data-pid="${p.id}" data-col="${c}"
                            value="${fmtPorsi(cobj.porsi)}" />
                    </div>
                </div>`;
                }
                const total = LaporanCore.colTotal(p, c);
                const target = LaporanCore.colTarget(p, c);
                const tgtLine = `<div class="bd-col-target">target ${formatNumberForDisplay(target)}</div>`;
                return `
                <div class="bd-col">
                    <div class="bd-col-label">${labels[c]}</div>
                    <input class="bd-input" inputmode="decimal" data-pid="${p.id}" data-col="${c}"
                        value="${formatNumberForDisplay(total)}" />
                    ${tgtLine}
                </div>`;
            })
            .join("");
        return `
            <div class="bd-row">
                <div class="bd-row-head">
                    <span class="bd-name" data-bd-edit="${p.id}">${esc(p.name)}</span>
                    <span class="bd-unit">${esc(p.unit || "pcs")}</span>
                    <button class="bd-del" data-bd-del="${p.id}" title="Hapus">×</button>
                </div>
                <div class="bd-cols">${colHtml}</div>
            </div>`;
    }).join("");

    const statsLine = items.length
        ? `<div class="bd-stats">
            <span class="bd-stat">${items.length} produk</span>
            <span class="bd-stat">total ${formatNumberForDisplay(totalProduksi)}</span>
            ${totalTarget > 0
                ? `<span class="bd-stat bd-stat-${targetMet}">
                    target ${formatNumberForDisplay(totalTarget)}
                    ${targetMet === "ok" ? "✓" : "⚠"}</span>`
                : ""}
          </div>`
        : `<div class="bd-empty">Belum ada produk untuk tanggal ini.</div>`;

    return `
        <div class="bd-card">
            <div class="bd-card-head">
                <span class="bd-date">${LaporanCore.fmtLong(date)}</span>
                <span class="bd-badge">${badge}</span>
            </div>
            ${statsLine}
            ${rows}
            <button class="bd-add" data-bd-add="${date}">+ Tambah Produk</button>
        </div>`;
}

function renderBeranda() {
    const pg = $("#page-beranda");
    if (!pg) return;
    const t = today();
    const all = DB.get();
    const besok = LaporanCore.addDays(t, 1);
    const emptyState = `
        <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            <p>Belum ada data mulai hari ini ke depan.<br/>Ketuk tombol di bawah untuk menambahkan produk.</p>
        </div>
        <button class="fab" data-bd-add="${t}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah Produk
        </button>`;

    if (!all.some(p => p.date >= t)) {
        pg.innerHTML = emptyState;
    } else {
        let html = "";
        if (all.some(p => p.date === t)) html += berandaCard(t, "Hari Ini");
        if (all.some(p => p.date === besok)) html += berandaCard(besok, "Besok");
        pg.innerHTML = html || emptyState;
    }

    if (pg._bdAttached) return;
    pg._bdAttached = true;

    pg.addEventListener("click", e => {
        const addBtn = e.target.closest("[data-bd-add]");
        if (addBtn) {
            openAddModal(addBtn.dataset.bdAdd);
            return;
        }
        const del = e.target.closest("[data-bd-del]");
        if (del) {
            e.stopPropagation();
            const pid = del.dataset.bdDel;
            Confirm.show(del, () => {
                DB.deleteProduct(pid);
                renderBeranda();
                if (currentTab === "hitungan") renderHitungan();
            });
            return;
        }
        const edit = e.target.closest("[data-bd-edit]");
        if (edit) openEditModal(edit.dataset.bdEdit);
    });

    pg.addEventListener("change", e => {
        const inp = e.target.closest(".bd-input");
        if (!inp) return;
        const pid = inp.dataset.pid;
        const col = inp.dataset.col;
        const data = DB.get();
        const p = data.find(x => x.id === pid);
        if (!p) return;
        if (!p.containers[col]) p.containers[col] = {};
        if (inp.classList.contains("bd-tim-berat")) {
            p.containers[col].berat = parseNumberFromInput(inp.value);
        } else if (inp.classList.contains("bd-tim-porsi")) {
            p.containers[col].porsi = parsePorsi(inp.value);
        } else {
            p.containers = { ...p.containers, [col]: [{ val: parseNumberFromInput(inp.value), mult: 1 }] };
        }
        saveAndSync(pid, data);
        renderBeranda();
        if (currentTab === "hitungan") renderHitungan();
    });
}
