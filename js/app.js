// ==================== UTILS ====================
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmt = d =>
    new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
const fmtShort = d =>
    new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
const fmtDay = d =>
    new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short"
    });
function formatYMD(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Format angka dengan koma sebagai pemisah desimal
function formatNumberForDisplay(num) {
    if (num === undefined || num === null || isNaN(num)) return "0";
    // Batasi maksimal 2 angka desimal untuk tampilan rapi (opsional)
    let rounded = Math.round(num * 100) / 100;
    return rounded.toString().replace(/\./g, ",");
}

function parseNumberFromInput(value) {
    if (!value || value === "") return 0;
    // Ganti koma dengan titik, lalu parse float
    let parsed = parseFloat(value.replace(/,/g, "."));
    return isNaN(parsed) ? 0 : parsed;
}

function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== "object" || typeof b !== "object") return false;
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length) return false;
    for (let key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
}

// ==================== SYNC LAYER ====================
const SB_URL_KEY = "jp_sb_url";
const SB_KEY_KEY = "jp_sb_key";
const DEFAULT_SB_URL = "https://mcipjbhtyjcswlquvfsr.supabase.co";
const DEFAULT_SB_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jaXBqYmh0eWpjc3dscXV2ZnNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjcwMzYsImV4cCI6MjA5MDUwMzAzNn0.OKFXKiURm9gelliUCNHcarGyZcXx-byqzXIwu0Bo5SM";

const Sync = {
    sbUrl: () => localStorage.getItem(SB_URL_KEY) || DEFAULT_SB_URL,
    sbKey: () => localStorage.getItem(SB_KEY_KEY) || DEFAULT_SB_KEY,

    setDot(state) {
        const dot = document.getElementById("syncDot");
        if (!dot) return;
        dot.className = "sync-dot" + (state !== "idle" ? " " + state : "");
        dot.title =
            {
                idle: "Belum terhubung",
                ok: "Tersinkronisasi",
                err: "Gagal sinkronisasi",
                loading: "Menyinkronkan..."
            }[state] || "";
    },
    setStatus(msg, type = "") {
        const el = document.getElementById("syncStatus");
        if (!el) return;
        el.style.display = msg ? "block" : "none";
        el.textContent = msg;
        el.className = "sync-status-box" + (type ? " " + type : "");
    },

    headers() {
        return {
            "Content-Type": "application/json",
            apikey: Sync.sbKey(),
            Authorization: "Bearer " + Sync.sbKey(),
            Prefer: "return=minimal"
        };
    },

    toRow(p) {
        return {
            id: p.id,
            name: p.name,
            date: p.date,
            split: p.split,
            order_idx: p.order || 0,
            target_single: p.targetSingle || 0,
            target_besar: p.targetBesar || 0,
            target_kecil: p.targetKecil || 0,
            containers: p.containers,
            unit: p.unit || "pcs",
            note: p.note || ""
        };
    },

    fromRow(r) {
        return {
            id: r.id,
            name: r.name,
            date: r.date,
            split: r.split,
            order: r.order_idx || 0,
            targetSingle: r.target_single || 0,
            targetBesar: r.target_besar || 0,
            targetKecil: r.target_kecil || 0,
            containers: r.containers,
            unit: r.unit || "pcs",
            note: r.note || ""
        };
    },

    async pull() {
        Sync.setDot("loading");
        try {
            const r = await fetch(
                `${Sync.sbUrl()}/rest/v1/produksi?select=*&order=order_idx.asc`,
                { headers: Sync.headers() }
            );
            if (!r.ok) throw new Error(await r.text());
            const rows = await r.json();
            const newData = rows.map(Sync.fromRow);
            const currentData = DB.get();
            if (!deepEqual(currentData, newData)) {
                DB.save(newData);
                Sync.setDot("ok");
                return true;
            } else {
                Sync.setDot("ok");
                return false;
            }
        } catch (e) {
            Sync.setDot("err");
            throw e;
        }
    },

    async add(p) {
        Sync.setDot("loading");
        try {
            const r = await fetch(`${Sync.sbUrl()}/rest/v1/produksi`, {
                method: "POST",
                headers: { ...Sync.headers(), Prefer: "return=minimal" },
                body: JSON.stringify(Sync.toRow(p))
            });
            if (!r.ok) throw new Error(await r.text());
            Sync.setDot("ok");
        } catch (e) {
            Sync.setDot("err");
        }
    },

    async update(p) {
        Sync.setDot("loading");
        try {
            const r = await fetch(
                `${Sync.sbUrl()}/rest/v1/produksi?id=eq.${p.id}`,
                {
                    method: "PATCH",
                    headers: { ...Sync.headers(), Prefer: "return=minimal" },
                    body: JSON.stringify(Sync.toRow(p))
                }
            );
            if (!r.ok) throw new Error(await r.text());
            Sync.setDot("ok");
        } catch (e) {
            Sync.setDot("err");
        }
    },

    async delete(id) {
        Sync.setDot("loading");
        try {
            const r = await fetch(
                `${Sync.sbUrl()}/rest/v1/produksi?id=eq.${id}`,
                {
                    method: "DELETE",
                    headers: Sync.headers()
                }
            );
            if (!r.ok) throw new Error(await r.text());
            Sync.setDot("ok");
        } catch (e) {
            Sync.setDot("err");
        }
    }
};

// ==================== TOAST ====================
let _toastTimer;
function showToast(msg, type = "") {
    const t = document.getElementById("toast");
    if (!t) return;
    clearTimeout(_toastTimer);
    t.textContent = msg;
    t.className = "show" + (type ? " " + type : "");
    _toastTimer = setTimeout(() => {
        t.className = "";
    }, 2500);
}

function saveAndSync(pid, data) {
    DB.save(data);
    const p = data.find(x => x.id === pid);
    if (p)
        Sync.update(p)
            .then(() => showToast("✓ Tersimpan", "ok"))
            .catch(() => showToast("✗ Gagal sinkronisasi", "err"));
}
function playSound() {
    const audio = new Audio("assets/ding.mp3");
    audio.play().catch(e => console.warn("Gagal main suara:", e));
}

// ==================== STORAGE ====================
const DB = {
    get: () => {
        const data = JSON.parse(localStorage.getItem("cp_data") || "[]");
        return data.map(p => ({
            ...p,
            unit: p.unit || "pcs",
            note: p.note || ""
        }));
    },
    save: data => localStorage.setItem("cp_data", JSON.stringify(data)),
    addProduct: p => {
        const d = DB.get();
        d.push(p);
        DB.save(d);
        Sync.add(p);
    },
    updateProduct: (id, updated) => {
        const d = DB.get();
        const i = d.findIndex(x => x.id === id);
        if (i >= 0) {
            d[i] = { ...d[i], ...updated };
            DB.save(d);
            Sync.update(d[i]);
        }
    },
    deleteProduct: id => {
        DB.save(DB.get().filter(x => x.id !== id));
        Sync.delete(id);
    },
    getByDate: date =>
        DB.get()
            .filter(x => x.date === date)
            .sort((a, b) => (a.order || 0) - (b.order || 0)),
    getByRange: (from, to) =>
        DB.get()
            .filter(x => x.date >= from && x.date <= to)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
};

// ==================== STATE ====================
let currentTab = "beranda";
let splitMode = false;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let riwayatFilter = "7d";
let riwayatFrom = "",
    riwayatTo = "";
const openCards = new Set();
let expandedRiwayatIds = new Set();

// Scroll positions untuk setiap tab
const scrollPositions = {
    beranda: 0,
    riwayat: 0,
    kalender: 0,
    kalkulator: 0
};

function saveScrollPosition(tab) {
    const page = document.querySelector(`#page-${tab}`);
    if (page) scrollPositions[tab] = page.scrollTop;
}

function restoreScrollPosition(tab) {
    const page = document.querySelector(`#page-${tab}`);
    if (page && scrollPositions[tab] !== undefined) {
        page.scrollTop = scrollPositions[tab];
    }
}

// ==================== THEME ====================
(function () {
    const saved = localStorage.getItem("jp_theme");
    const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
    ).matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
})();

$("#headerDate").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long"
});

$("#themeToggle").addEventListener("click", () => {
    const isLight = document.documentElement.classList.contains("light");
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(isLight ? "dark" : "light");
    localStorage.setItem("jp_theme", isLight ? "dark" : "light");
});

// ==================== REFRESH ====================
let _lastDate = today();

async function refreshApp() {
    _lastDate = today();
    $("#headerDate").textContent = new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long"
    });
    const btn = $("#reloadBtn");
    btn.classList.add("reloading");
    saveScrollPosition(currentTab);
    try {
        await Sync.pull(); // paksa sinkron
        if (currentTab === "beranda") renderBeranda();
        if (currentTab === "riwayat") renderRiwayat();
        if (currentTab === "kalender") renderKalender();
        if (currentTab === "kalkulator") renderKalkulator();
        restoreScrollPosition(currentTab);
        showToast("✓ Data diperbarui", "ok");
    } catch (e) {
        showToast("✗ Gagal sinkronisasi", "err");
    }
    setTimeout(() => btn.classList.remove("reloading"), 650);
}

$("#reloadBtn").addEventListener("click", refreshApp);

document.addEventListener("visibilitychange", () => {
    if (!document.hidden && today() !== _lastDate) refreshApp();
});

function scheduleMidnight() {
    const now = new Date();
    const msUntilMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    setTimeout(() => {
        refreshApp();
        scheduleMidnight();
    }, msUntilMidnight + 500);
}
scheduleMidnight();

// ==================== PULL TO REFRESH ====================
(function () {
    const THRESHOLD = 72;
    const MAX_PULL = 96;
    let startY = 0,
        pulling = false,
        triggered = false;
    const ind = document.getElementById("pullIndicator");
    const lbl = document.getElementById("pullLabel");

    function getActivePage() {
        return document.querySelector(".page.active");
    }

    document.addEventListener(
        "touchstart",
        e => {
            const pg = getActivePage();
            if (!pg) return;
            const scrollTarget = e.target.closest('[id="calcScrollArea"]');
            if (scrollTarget && scrollTarget.scrollTop > 0) return;
            if (
                scrollTarget &&
                scrollTarget.scrollHeight > scrollTarget.clientHeight
            ) {
                if (scrollTarget.scrollTop > 0) return;
            }
            if (pg.scrollTop === 0) {
                startY = e.touches[0].clientY;
                pulling = true;
                triggered = false;
            }
        },
        { passive: true }
    );

    document.addEventListener(
        "touchmove",
        e => {
            if (!pulling) return;
            const scrollTarget = e.target.closest('[id="calcScrollArea"]');
            if (scrollTarget) {
                pulling = false;
                ind.style.height = "0";
                return;
            }
            const dy = e.touches[0].clientY - startY;
            if (dy <= 0) {
                pulling = false;
                ind.style.height = "0";
                return;
            }
            const h = Math.min(dy * 0.45, MAX_PULL);
            ind.style.height = h + "px";
            ind.classList.remove("loading");
            if (dy > THRESHOLD) {
                ind.classList.add("releasing");
                lbl.textContent = "Lepas untuk refresh";
                triggered = true;
            } else {
                ind.classList.remove("releasing");
                lbl.textContent = "Tarik untuk refresh";
                triggered = false;
            }
        },
        { passive: true }
    );

    document.addEventListener("touchend", () => {
        if (!pulling) return;
        pulling = false;
        if (triggered) {
            ind.classList.remove("releasing");
            ind.classList.add("loading");
            lbl.textContent = "Memperbarui...";
            ind.style.height = "48px";
            setTimeout(() => {
                refreshApp();
                ind.style.height = "0";
                ind.classList.remove("loading");
                lbl.textContent = "Tarik untuk refresh";
            }, 700);
        } else {
            ind.style.height = "0";
            ind.classList.remove("releasing");
        }
        triggered = false;
    });
})();

// ==================== NAVIGATION ====================
function setTab(tab) {
    saveScrollPosition(currentTab);
    currentTab = tab;
    $$(".nav-item").forEach(el =>
        el.classList.toggle("active", el.dataset.tab === tab)
    );
    $$(".page").forEach(el => el.classList.remove("active"));
    $(`#page-${tab}`).classList.add("active");
    const tabs = ["beranda", "riwayat", "kalkulator"];
    const idx = tabs.indexOf(tab);
    if (idx >= 0) $("#navIndicator").style.left = idx * 33.333 + "%";
    if (tab === "beranda") renderBeranda();
    if (tab === "riwayat") renderRiwayat();
    if (tab === "kalender") renderKalender();
    if (tab === "kalkulator") renderKalkulator();
    restoreScrollPosition(tab);
}

$$(".nav-item").forEach(el => {
    el.addEventListener("click", () => setTab(el.dataset.tab));
});

let prevTab = "beranda";
$("#calBtn").addEventListener("click", () => {
    if (currentTab === "kalender") setTab(prevTab);
    else {
        prevTab = currentTab;
        setTab("kalender");
    }
});

// ==================== BERANDA (menampilkan beberapa hari ke depan) ====================
function renderBeranda() {
    const pg = $("#page-beranda");
    const allProducts = DB.get();
    const todayStr = today();
    // Filter produk dengan tanggal >= hari ini
    const futureProducts = allProducts.filter(p => p.date >= todayStr);
    // Kelompokkan berdasarkan tanggal
    const grouped = {};
    futureProducts.forEach(p => {
        if (!grouped[p.date]) grouped[p.date] = [];
        grouped[p.date].push(p);
    });
    // Urutkan tanggal ascending
    const dates = Object.keys(grouped).sort();

    if (dates.length === 0) {
        pg.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        <p>Belum ada data mulai hari ini ke depan.<br/>Ketuk tombol di bawah untuk menambahkan produk.</p>
      </div>
      <button class="fab" id="fabBtn">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Tambah Produk
      </button>`;
        attachFabEvent();
        return;
    }

    // Buat HTML untuk setiap hari
    let html = "";
    for (const date of dates) {
        const products = grouped[date];
        // Urutkan produk dalam hari berdasarkan order
        products.sort((a, b) => (a.order || 0) - (b.order || 0));
        const dateLabel = date === todayStr ? "Hari Ini" : fmtShort(date);
        html += `<div class="day-group">
      <div class="day-header">${dateLabel}</div>
      <div class="cards-grid" data-date="${date}">`;
        html += products.map(p => renderProductCard(p)).join("");
        html += `</div></div>`;
    }

    pg.innerHTML =
        html +
        `<button class="fab" id="fabBtn">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Tambah Produk
    </button>`;

    // Attach event ke semua grid di setiap hari
    $$(".cards-grid", pg).forEach(grid => {
        attachCardEvents(grid);
        makeSortable(grid);
    });
    attachFabEvent();

    // Inisialisasi openCards state untuk setiap card
    $$(".product-card", pg).forEach(card => {
        if (openCards.has(card.dataset.pid)) card.classList.add("card-open");
    });

    // Event delegation untuk toggle card di mobile
    if (!pg._cardToggleAttached) {
        pg._cardToggleAttached = true;
        pg.addEventListener("click", e => {
            if (window.innerWidth >= 768) return;
            if (
                e.target.closest(".delete-product-btn") ||
                e.target.closest(".card-body")
            )
                return;
            const header = e.target.closest(".product-header");
            if (!header) return;
            const card = header.closest(".product-card");
            if (!card) return;
            const pid = card.dataset.pid;
            const isOpen = card.classList.contains("card-open");
            card.classList.toggle("card-open", !isOpen);
            if (!isOpen) openCards.add(pid);
            else openCards.delete(pid);
        });
    }
}

function attachFabEvent() {
    const btn = document.getElementById("fabBtn");
    if (!btn) return;
    btn.addEventListener("click", openAddModal);
}

function renderProductCard(p) {
    const isSplit = p.split;
    const colClass = isSplit ? "double" : "single";

    const renderCol = (label, target, containers, colKey) => {
        const colorKecil = localStorage.getItem("jp_col_kecil") || "#e5534b";
        const colorBesar = localStorage.getItem("jp_col_besar") || "#388bfd";
        const hex2rgba = (hex, a) => {
            const r = parseInt(hex.slice(1, 3), 16),
                g = parseInt(hex.slice(3, 5), 16),
                b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r},${g},${b},${a})`;
        };
        const accentStyle =
            colKey === "kecil"
                ? `border-color:${colorKecil};background:${hex2rgba(colorKecil, 0.08)};`
                : colKey === "besar"
                  ? `border-color:${colorBesar};background:${hex2rgba(colorBesar, 0.08)};`
                  : "";
        const rows = containers
            .map((c, i) => {
                const result = (c.val || 0) * (c.mult || 1);
                return `
      <div class="container-row" style="${accentStyle}">
      <div class="container-index">${i+1}</div>
       <div class="container-row-top">
        <input class="container-input" type="text" value="${formatNumberForDisplay(c.val)}" min="0"
         data-pid="${p.id}" data-col="${colKey}" data-cidx="${i}" placeholder="0" />
       </div>
       <div class="container-row-bottom">
        <div class="mult-stepper">
         <button class="mult-step-btn mult-minus" data-pid="${p.id}" data-col="${colKey}" data-cidx="${i}">−</button>
         <input class="mult-step-input" type="text" value="${c.mult}" min="1" max="999"
          data-pid="${p.id}" data-col="${colKey}" data-cidx="${i}" />
         <button class="mult-step-btn mult-plus" data-pid="${p.id}" data-col="${colKey}" data-cidx="${i}">+</button>
        </div>
      </div>
      <div class="container-row-result">
       <button class="remove-btn" data-pid="${p.id}" data-col="${colKey}" data-cidx="${i}">
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
       </button>
       <div class="result-group">
         <span style="font-size:12px;color:var(--text-muted);margin-right:6px">=</span>
         <span class="mult-result" data-res="${p.id}-${colKey}-${i}">${formatNumberForDisplay(result)}</span>
         <span style="font-size:12px;color:var(--text-muted);margin-left:4px">${p.unit || "pcs"}</span>
       </div>
      </div>
     </div>`;
            })
            .join("");

        const editId = `${p.id}-${colKey}`;
        return `
      <div class="col-section">
        <div class="col-label">
          <div class="col-label-left">
            <span>${label}</span>
            <span class="target-badge" id="badge-${editId}">Target: ${formatNumberForDisplay(target)}</span>
            <button class="edit-target-btn" data-pid="${p.id}" data-col="${colKey}" title="Edit target">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
        </div>
        <div class="target-edit-wrap" id="tedit-${editId}">
          <input class="target-edit-input" type="text" placeholder="${formatNumberForDisplay(target)}"
            data-pid="${p.id}" data-col="${colKey}" id="tinput-${editId}" />
          <button class="target-save-btn" data-pid="${p.id}" data-col="${colKey}">Simpan</button>
        </div>
        <div class="container-list" data-pid="${p.id}" data-col="${colKey}">${rows}</div>
        <button class="add-container-btn" data-pid="${p.id}" data-col="${colKey}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah
        </button>
      </div>`;
    };

    const summaryHTML = renderSummary(p);

    const calcTotal = () => {
        if (!p.split)
            return (p.containers.single || []).reduce(
                (s, c) => s + (c.val || 0) * (c.mult || 1),
                0
            );
        const k = (p.containers.kecil || []).reduce(
            (s, c) => s + (c.val || 0) * (c.mult || 1),
            0
        );
        const b = (p.containers.besar || []).reduce(
            (s, c) => s + (c.val || 0) * (c.mult || 1),
            0
        );
        return k + b;
    };
    const headerTotal = calcTotal();
    const target = p.split
        ? (p.targetKecil || 0) + (p.targetBesar || 0)
        : p.targetSingle || 0;
    const diff = headerTotal - target;
    const dClass =
        diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "diff-zero";
    const dStr =
        diff >= 0
            ? `+${formatNumberForDisplay(diff)}`
            : `${formatNumberForDisplay(diff)}`;
    const meta = p.split ? "Porsi Kecil + Besar" : "Single";

    return `
    <div class="product-card" data-pid="${p.id}">
      <div class="drag-handle" title="Seret untuk mengurutkan"><span></span><span></span><span></span></div>
      <div class="product-header">
        <div style="flex:1;min-width:0">
          <div class="riwayat-name">${p.name}</div>
          <div class="riwayat-meta">${meta} · Target ${formatNumberForDisplay(target)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="text-align:right">
            <div class="riwayat-total card-header-total">${formatNumberForDisplay(headerTotal)}</div>
            <div style="font-size:11px;font-family:var(--mono)" class="${dClass} card-header-diff">${dStr}</div>
          </div>
          <button class="delete-product-btn" data-pid="${p.id}" title="Hapus Produk">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
          <svg class="card-chevron-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="card-body">
        <div class="product-cols ${colClass}">
          ${
              isSplit
                  ? renderCol(
                        "Porsi Kecil",
                        p.targetKecil,
                        p.containers.kecil,
                        "kecil"
                    ) +
                    renderCol(
                        "Porsi Besar",
                        p.targetBesar,
                        p.containers.besar,
                        "besar"
                    )
                  : renderCol(
                        "Produksi",
                        p.targetSingle,
                        p.containers.single,
                        "single"
                    )
          }
        </div>
        ${summaryHTML}
        <button class="card-delete-inline" data-pid="${p.id}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Hapus
        </button>
      </div>
    </div>`;
}

function renderSummary(p) {
    const isSplit = p.split;
    const unit = p.unit || "pcs";

    const diffLabel = (diff, target) => {
        if (diff === 0) return { text: "Sesuai Target", cls: "diff-zero" };
        if (diff < 0)
            return {
                text: `Kurang dari target (${formatNumberForDisplay(target)})`,
                cls: "diff-negative"
            };
        return {
            text: `Melebihi target (${formatNumberForDisplay(target)})`,
            cls: "diff-positive"
        };
    };

    const calcCol = (containers, target) => {
        let total = 0;
        const lines = containers
            .map((c, i) => {
                const sub = (c.val || 0) * (c.mult || 1);
                total += sub;
                return `<div class="summary-row">
        <span class="summary-label">${i+1}. ${formatNumberForDisplay(c.val)} × ${c.mult}</span>
        <span class="summary-val">${formatNumberForDisplay(sub)} ${unit}</span>
      </div>`;
            })
            .join("");
        const diff = total - (target || 0);
        return { lines, total, diff };
    };

    if (!isSplit) {
        const { lines, total, diff } = calcCol(
            p.containers.single,
            p.targetSingle
        );
        const { text, cls } = diffLabel(diff, p.targetSingle || 0);
        const diffStr =
            diff > 0
                ? `+${formatNumberForDisplay(diff)}`
                : `${formatNumberForDisplay(diff)}`;
        let noteHtml = "";
        if (p.note) {
            noteHtml = `<div class="summary-note">
                <div class="summary-note-label">📝 Catatan:</div>
                <div class="summary-note-text">${p.note.replace(/\n/g, '<br>')}</div>
            </div>`;
        }
        return `<div class="summary-box">
      <div class="summary-title">Ringkasan</div>
      <div class="summary-grid">
        ${lines}
        <div class="summary-divider"></div>
        <div class="summary-row summary-total">
          <span>Total</span><span class="summary-val">${formatNumberForDisplay(total)} ${unit}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label ${cls}">${text}</span>
          <span class="summary-val ${cls}">${diff === 0 ? "" : diffStr}</span>
        </div>
        ${noteHtml}
      </div>
    </div>`;
    } else {
        const besar = calcCol(p.containers.besar, p.targetBesar);
        const kecil = calcCol(p.containers.kecil, p.targetKecil);
        const grandTotal = besar.total + kecil.total;
        const totalTarget = (p.targetBesar || 0) + (p.targetKecil || 0);
        const grandDiff = grandTotal - totalTarget;
        const kecilInfo = diffLabel(kecil.diff, p.targetKecil || 0);
        const besarInfo = diffLabel(besar.diff, p.targetBesar || 0);
        const grandInfo = diffLabel(grandDiff, totalTarget);
        const kecilStr =
            kecil.diff > 0
                ? `+${formatNumberForDisplay(kecil.diff)}`
                : `${formatNumberForDisplay(kecil.diff)}`;
        const besarStr =
            besar.diff > 0
                ? `+${formatNumberForDisplay(besar.diff)}`
                : `${formatNumberForDisplay(besar.diff)}`;
        const grandStr =
            grandDiff > 0
                ? `+${formatNumberForDisplay(grandDiff)}`
                : `${formatNumberForDisplay(grandDiff)}`;
        let noteHtml = '';
        if (p.note) {
            noteHtml = `<div class="summary-note">
                <div class="summary-note-label">📝 Catatan:</div>
                <div class="summary-note-text">${p.note.replace(/\n/g, '<br>')}</div>
            </div>`;
        }
        return `<div class="summary-box">
      <div class="summary-title">Ringkasan</div>
      <div class="summary-grid">
        <div class="summary-row"><span class="summary-label" style="font-weight:600">Porsi Kecil</span><span></span></div>
        ${kecil.lines}
        <div class="summary-row">
          <span class="summary-label ${kecilInfo.cls}">${kecilInfo.text}</span>
          <span class="summary-val ${kecilInfo.cls}">${kecil.diff === 0 ? formatNumberForDisplay(kecil.total) + " " + unit : formatNumberForDisplay(kecil.total) + " " + unit + " (" + kecilStr + ")"}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-row"><span class="summary-label" style="font-weight:600">Porsi Besar</span><span></span></div>
        ${besar.lines}
        <div class="summary-row">
          <span class="summary-label ${besarInfo.cls}">${besarInfo.text}</span>
          <span class="summary-val ${besarInfo.cls}">${besar.diff === 0 ? formatNumberForDisplay(besar.total) + " " + unit : formatNumberForDisplay(besar.total) + " " + unit + " (" + besarStr + ")"}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-row summary-total">
          <span>Total</span><span class="summary-val">${formatNumberForDisplay(grandTotal)} ${unit}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label ${grandInfo.cls}">${grandInfo.text}</span>
          <span class="summary-val ${grandInfo.cls}">${grandDiff === 0 ? "" : grandStr}</span>
        </div>
        ${noteHtml}
      </div>
    </div>`;
    }
}

function attachCardEvents(ctx) {
    $$(`.container-input`, ctx).forEach(input => {
        input.addEventListener("change", () => {
            const pid = input.dataset.pid,
                col = input.dataset.col,
                idx = parseInt(input.dataset.cidx);
            const data = DB.get();
            const p = data.find(x => x.id === pid);
            if (!p) return;
            let newVal = parseNumberFromInput(input.value);
            p.containers[col][idx].val = newVal;
            saveAndSync(pid, data);
            updateResult(pid, col, idx, p.containers[col][idx]);
            refreshSummary(pid);
            input.value = formatNumberForDisplay(newVal);
        });
        input.addEventListener("input", () => {
            const pid = input.dataset.pid,
                col = input.dataset.col,
                idx = parseInt(input.dataset.cidx);
            const data = DB.get();
            const p = data.find(x => x.id === pid);
            if (!p) return;
            let newVal = parseNumberFromInput(input.value);
            p.containers[col][idx].val = newVal;
            DB.save(data);
            updateResult(pid, col, idx, p.containers[col][idx]);
            refreshSummary(pid);
            input.value = formatNumberForDisplay(newVal);
        });
    });

    $$(".mult-step-input", ctx).forEach(input => {
        input.addEventListener("input", () => {
            const pid = input.dataset.pid,
                col = input.dataset.col,
                idx = parseInt(input.dataset.cidx);
            let val = parseNumberFromInput(input.value);
            val = Math.max(1, val);
            input.value = val;
            saveMult(pid, col, idx, val);
        });
    });

    $$(".mult-minus", ctx).forEach(btn => {
        btn.addEventListener("click", () => {
            const pid = btn.dataset.pid,
                col = btn.dataset.col,
                idx = parseInt(btn.dataset.cidx);
            const inp = btn.nextElementSibling;
            let val = parseNumberFromInput(inp.value) - 1;
            val = Math.max(1, val);
            inp.value = val;
            saveMult(pid, col, idx, val);
        });
    });

    $$(".mult-plus", ctx).forEach(btn => {
        btn.addEventListener("click", () => {
            playSound();
            const pid = btn.dataset.pid,
                col = btn.dataset.col,
                idx = parseInt(btn.dataset.cidx);
            const inp = btn.previousElementSibling;
            let val = parseNumberFromInput(inp.value) + 1;
            inp.value = val;
            saveMult(pid, col, idx, val);
        });
    });

    $$(".remove-btn", ctx).forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const pid = btn.dataset.pid,
                col = btn.dataset.col,
                idx = parseInt(btn.dataset.cidx);
            const data = DB.get();
            const p = data.find(x => x.id === pid);
            if (!p || p.containers[col].length <= 1) return;
            Confirm.show(btn, () => {
                p.containers[col].splice(idx, 1);
                saveAndSync(pid, data);
                rerenderCard(pid, data);
            });
        });
    });

    $$(".add-container-btn", ctx).forEach(btn => {
        btn.addEventListener("click", () => {
            const pid = btn.dataset.pid,
                col = btn.dataset.col;
            const data = DB.get();
            const p = data.find(x => x.id === pid);
            if (!p) return;
            p.containers[col].push({ val: 0, mult: 1 });
            saveAndSync(pid, data);
            rerenderCard(pid, data);
        });
    });

    $$(".edit-target-btn", ctx).forEach(btn => {
        btn.addEventListener("click", () => {
            const pid = btn.dataset.pid,
                col = btn.dataset.col;
            const editId = `${pid}-${col}`;
            const wrap = document.getElementById(`tedit-${editId}`);
            const inp = document.getElementById(`tinput-${editId}`);
            if (!wrap) return;
            const isVisible = wrap.classList.contains("visible");
            wrap.classList.toggle("visible", !isVisible);
            if (!isVisible && inp) {
                const data = DB.get();
                const p = data.find(x => x.id === pid);
                if (p) {
                    const cur =
                        col === "single"
                            ? p.targetSingle
                            : col === "besar"
                              ? p.targetBesar
                              : p.targetKecil;
                    inp.value = formatNumberForDisplay(cur);
                    inp.focus();
                }
            }
        });
    });

    $$(".target-save-btn", ctx).forEach(btn => {
        btn.addEventListener("click", () => {
            const pid = btn.dataset.pid,
                col = btn.dataset.col;
            const editId = `${pid}-${col}`;
            const inp = document.getElementById(`tinput-${editId}`);
            const wrap = document.getElementById(`tedit-${editId}`);
            const badge = document.getElementById(`badge-${editId}`);
            if (!inp) return;
            const newVal = parseNumberFromInput(inp.value);
            const data = DB.get();
            const p = data.find(x => x.id === pid);
            if (p) {
                if (col === "single") p.targetSingle = newVal;
                else if (col === "besar") p.targetBesar = newVal;
                else if (col === "kecil") p.targetKecil = newVal;
                saveAndSync(pid, data);
                if (badge)
                    badge.textContent = `Target: ${formatNumberForDisplay(newVal)}`;
                if (wrap) wrap.classList.remove("visible");
                refreshSummary(pid);
            }
        });
    });

    $$(".delete-product-btn", ctx).forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const pid = btn.dataset.pid;
            Confirm.show(btn, () => {
                openCards.delete(pid);
                DB.deleteProduct(pid);
                renderBeranda();
            });
        });
    });

    $$(".card-delete-inline", ctx).forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const pid = btn.dataset.pid;
            Confirm.show(btn, () => {
                openCards.delete(pid);
                DB.deleteProduct(pid);
                renderBeranda();
            });
        });
    });

    attachNumpad(ctx);
}

function rerenderCard(pid, data) {
    const card = document.querySelector(`.product-card[data-pid="${pid}"]`);
    if (!card) {
        renderBeranda();
        return;
    }
    const p = (data || DB.get()).find(x => x.id === pid);
    if (!p) {
        renderBeranda();
        return;
    }
    const tmp = document.createElement("div");
    tmp.innerHTML = renderProductCard(p);
    const newEl = tmp.firstElementChild;
    if (openCards.has(pid)) newEl.classList.add("card-open");
    card.replaceWith(newEl);
    attachCardEvents(newEl);
    attachNumpad(newEl);
}

function saveMult(pid, col, idx, val) {
    const data = DB.get();
    const p = data.find(x => x.id === pid);
    if (!p) return;
    p.containers[col][idx].mult = val;
    saveAndSync(pid, data);
    updateResult(pid, col, idx, p.containers[col][idx]);
    refreshSummary(pid);
}

function updateResult(pid, col, idx, c) {
    const res = document.querySelector(`[data-res="${pid}-${col}-${idx}"]`);
    if (res) {
        const result = (c.val || 0) * (c.mult || 1);
        res.textContent = `= ${formatNumberForDisplay(result)}`;
    }
}

function refreshSummary(pid) {
    const data = DB.get();
    const p = data.find(x => x.id === pid);
    if (!p) return;
    const card = document.querySelector(`.product-card[data-pid="${pid}"]`);
    if (!card) return;

    const existing = card.querySelector(".summary-box");
    const body = card.querySelector(".card-body") || card;
    if (existing) existing.remove();
    const deleteBtn = card.querySelector(".card-delete-inline");
    if (deleteBtn)
        deleteBtn.insertAdjacentHTML("beforebegin", renderSummary(p));
    else body.insertAdjacentHTML("beforeend", renderSummary(p));

    const totalEl = card.querySelector(".card-header-total");
    const diffEl = card.querySelector(".card-header-diff");
    if (totalEl) {
        const tot = p.split
            ? (p.containers.kecil || []).reduce(
                  (s, c) => s + (c.val || 0) * (c.mult || 1),
                  0
              ) +
              (p.containers.besar || []).reduce(
                  (s, c) => s + (c.val || 0) * (c.mult || 1),
                  0
              )
            : (p.containers.single || []).reduce(
                  (s, c) => s + (c.val || 0) * (c.mult || 1),
                  0
              );
        const tgt = p.split
            ? (p.targetKecil || 0) + (p.targetBesar || 0)
            : p.targetSingle || 0;
        const d = tot - tgt;
        totalEl.textContent = `${formatNumberForDisplay(tot)}`;
        if (diffEl) {
            diffEl.textContent =
                d >= 0
                    ? `+${formatNumberForDisplay(d)}`
                    : `${formatNumberForDisplay(d)}`;
            diffEl.className = `card-header-diff ${d > 0 ? "diff-positive" : d < 0 ? "diff-negative" : "diff-zero"}`;
        }
    }
}

// ==================== MODAL TAMBAH PRODUK ====================
function openAddModal() {
    $("#inputTanggal").value = today();
    $("#inputNama").value = "";
    $("#targetSingle").value = "";
    $("#targetBesar").value = "";
    $("#targetKecil").value = "";
    $("#inputUnit").value = "pcs";
    $("#inputNote").value = "";
    splitMode = false;
    $("#checkboxRow").classList.remove("checked");
    $("#subTargets").classList.remove("visible");
    $("#singleTargetWrap").style.display = "block";
    $("#modalOverlay").classList.add("open");
}

$("#btnBatal").addEventListener("click", closeModal);
$("#modalOverlay").addEventListener("click", e => {
    if (e.target === $("#modalOverlay")) closeModal();
});

function closeModal() {
    $("#modalOverlay").classList.remove("open");
}

$("#checkboxRow").addEventListener("click", () => {
    splitMode = !splitMode;
    $("#checkboxRow").classList.toggle("checked", splitMode);
    $("#subTargets").classList.toggle("visible", splitMode);
    $("#singleTargetWrap").style.display = splitMode ? "none" : "block";
});

$("#btnOk").addEventListener("click", () => {
    const name = $("#inputNama").value.trim();
    const date = $("#inputTanggal").value;
    if (!name || !date) {
        alert("Nama produk dan tanggal wajib diisi.");
        return;
    }

    const existingToday = DB.getByDate(date);
    const unit = $("#inputUnit").value.trim() || "pcs";
    const note = $("#inputNote").value.trim();

    const product = {
        id: Date.now().toString(),
        name,
        date,
        split: splitMode,
        order: existingToday.length,
        targetSingle: parseNumberFromInput($("#targetSingle").value),
        targetBesar: parseNumberFromInput($("#targetBesar").value),
        targetKecil: parseNumberFromInput($("#targetKecil").value),
        containers: splitMode
            ? { besar: [{ val: 0, mult: 1 }], kecil: [{ val: 0, mult: 1 }] }
            : { single: [{ val: 0, mult: 1 }] },
        unit: unit,
        note: note
    };

    DB.addProduct(product);
    closeModal();
    renderBeranda();
});

// ==================== EDIT MODAL (RIWAYAT & KALENDER) ====================
let editState = null;

function renderEditCol(label, colKey, target, containers) {
    const colorKecil = localStorage.getItem("jp_col_kecil") || "#e5534b";
    const colorBesar = localStorage.getItem("jp_col_besar") || "#388bfd";
    const hex2rgba = (hex, a) => {
        const r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${a})`;
    };
    const accentStyle =
        colKey === "kecil"
            ? `border-color:${colorKecil};background:${hex2rgba(colorKecil, 0.08)};`
            : colKey === "besar"
              ? `border-color:${colorBesar};background:${hex2rgba(colorBesar, 0.08)};`
              : "";

    const rows = containers
        .map((c, i) => {
            const result = (c.val || 0) * (c.mult || 1);
            return `
    <div class="container-row" style="${accentStyle}">
    <div class="container-index">${i+1}</div>
      <div class="container-row-top">
        <input class="container-input edit-val-input" type="text" value="${formatNumberForDisplay(c.val)}"
          data-col="${colKey}" data-cidx="${i}" placeholder="0" />
      </div>
      <div class="container-row-bottom">
        <div class="mult-stepper">
          <button class="mult-step-btn edit-mult-minus" data-col="${colKey}" data-cidx="${i}">−</button>
          <input class="mult-step-input edit-mult-input" type="text" value="${c.mult}"
            min="1" max="999" data-col="${colKey}" data-cidx="${i}" />
          <button class="mult-step-btn edit-mult-plus" data-col="${colKey}" data-cidx="${i}">+</button>
        </div>
      </div>
      <div class="container-row-result">
        <button class="remove-btn edit-remove-btn" data-col="${colKey}" data-cidx="${i}">
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
        <div class="result-group">
          <span style="font-size:12px;color:var(--text-muted);margin-right:6px">=</span>
          <span class="mult-result" id="editres-${colKey}-${i}">${formatNumberForDisplay(result)}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:4px">${editState.unit || "pcs"}</span>
        </div>
      </div>
    </div>`;
        })
        .join("");

    return `
    <div style="margin-bottom:14px">
      <div class="col-label" style="margin-bottom:8px">
        <div class="col-label-left">
          <span>${label}</span>
          <span class="target-badge" id="editbadge-${colKey}">Target: ${formatNumberForDisplay(target)}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <input class="field-input edit-target-field" type="text" value="${formatNumberForDisplay(target)}"
          data-col="${colKey}" placeholder="Target"
          style="padding:7px 10px;font-size:13px;" />
        <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">= target</span>
      </div>
      <div class="container-list" id="editlist-${colKey}" style="display:flex;flex-direction:column;gap:8px">${rows}</div>
      <button class="add-container-btn edit-add-btn" data-col="${colKey}" style="margin-top:12px">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Tambah
      </button>
    </div>`;
}

function renderEditContainerArea() {
    const p = editState;
    const area = $("#editContainerArea");
    if (!p) return;

    if (p.split) {
        area.innerHTML =
            `<div class="product-cols double">` +
            renderEditCol(
                "Porsi Kecil",
                "kecil",
                p.targetKecil,
                p.containers.kecil
            ) +
            renderEditCol(
                "Porsi Besar",
                "besar",
                p.targetBesar,
                p.containers.besar
            ) +
            `</div>`;
    } else {
        area.innerHTML =
            `<div class="product-cols single">` +
            renderEditCol(
                "Produksi",
                "single",
                p.targetSingle,
                p.containers.single
            ) +
            `</div>`;
    }

    attachEditContainerEvents(area);
}

function attachEditContainerEvents(ctx) {
    $$(".edit-val-input", ctx).forEach(inp => {
        inp.addEventListener("input", () => {
            const col = inp.dataset.col,
                idx = parseInt(inp.dataset.cidx);
            let newVal = parseNumberFromInput(inp.value);
            editState.containers[col][idx].val = newVal;
            refreshEditResult(col, idx);
            inp.value = formatNumberForDisplay(newVal);
        });
    });

    $$(".edit-mult-input", ctx).forEach(inp => {
        inp.addEventListener("input", () => {
            const col = inp.dataset.col,
                idx = parseInt(inp.dataset.cidx);
            let val = parseNumberFromInput(inp.value);
            val = Math.max(1, val);
            inp.value = val;
            editState.containers[col][idx].mult = val;
            refreshEditResult(col, idx);
        });
    });

    $$(".edit-mult-minus", ctx).forEach(btn => {
        btn.addEventListener("click", () => {
            const col = btn.dataset.col,
                idx = parseInt(btn.dataset.cidx);
            const inp = btn.nextElementSibling;
            let val = parseNumberFromInput(inp.value) - 1;
            val = Math.max(1, val);
            inp.value = val;
            editState.containers[col][idx].mult = val;
            refreshEditResult(col, idx);
        });
    });

    $$(".edit-mult-plus", ctx).forEach(btn => {
        btn.addEventListener("click", () => {
            const col = btn.dataset.col,
                idx = parseInt(btn.dataset.cidx);
            const inp = btn.previousElementSibling;
            let val = parseNumberFromInput(inp.value) + 1;
            inp.value = val;
            editState.containers[col][idx].mult = val;
            refreshEditResult(col, idx);
        });
    });

    $$(".edit-remove-btn", ctx).forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const col = btn.dataset.col,
                idx = parseInt(btn.dataset.cidx);
            if (editState.containers[col].length <= 1) return;
            Confirm.show(btn, () => {
                editState.containers[col].splice(idx, 1);
                renderEditContainerArea();
            });
        });
    });

    $$(".edit-add-btn", ctx).forEach(btn => {
        btn.addEventListener("click", () => {
            const col = btn.dataset.col;
            editState.containers[col].push({ val: 0, mult: 1 });
            renderEditContainerArea();
        });
    });

    $$(".edit-target-field", ctx).forEach(inp => {
        inp.addEventListener("input", () => {
            const col = inp.dataset.col;
            const val = parseNumberFromInput(inp.value);
            if (col === "single") editState.targetSingle = val;
            else if (col === "besar") editState.targetBesar = val;
            else if (col === "kecil") editState.targetKecil = val;
            const badge = document.getElementById(`editbadge-${col}`);
            if (badge)
                badge.textContent = `Target: ${formatNumberForDisplay(val)}`;
        });
    });

    if (window.innerWidth < 768) {
        $$(".edit-val-input", ctx).forEach(inp => {
            inp.setAttribute("inputmode", "none");
            inp.setAttribute("readonly", "readonly");
            let sx, sy;
            inp.addEventListener("pointerdown", e => {
                sx = e.clientX;
                sy = e.clientY;
            });
            inp.addEventListener("pointerup", e => {
                if (
                    Math.abs(e.clientX - sx) > 8 ||
                    Math.abs(e.clientY - sy) > 8
                )
                    return;
                e.preventDefault();
                const col = inp.dataset.col,
                    idx = parseInt(inp.dataset.cidx);
                Numpad.show(inp, val => {
                    inp.removeAttribute("readonly");
                    inp.value = formatNumberForDisplay(val);
                    inp.setAttribute("readonly", "readonly");
                    editState.containers[col][idx].val = val;
                    refreshEditResult(col, idx);
                });
            });
        });

        $$(".edit-mult-input", ctx).forEach(inp => {
            inp.setAttribute("inputmode", "none");
            inp.setAttribute("readonly", "readonly");
            let sx, sy;
            inp.addEventListener("pointerdown", e => {
                sx = e.clientX;
                sy = e.clientY;
            });
            inp.addEventListener("pointerup", e => {
                if (
                    Math.abs(e.clientX - sx) > 8 ||
                    Math.abs(e.clientY - sy) > 8
                )
                    return;
                e.preventDefault();
                const col = inp.dataset.col,
                    idx = parseInt(inp.dataset.cidx);
                Numpad.show(inp, val => {
                    const v = Math.max(1, val);
                    inp.removeAttribute("readonly");
                    inp.value = v;
                    inp.setAttribute("readonly", "readonly");
                    editState.containers[col][idx].mult = v;
                    refreshEditResult(col, idx);
                });
            });
        });
    }
}

function refreshEditResult(col, idx) {
    const c = editState.containers[col][idx];
    const el = document.getElementById(`editres-${col}-${idx}`);
    if (el)
        el.textContent = `= ${formatNumberForDisplay((c.val || 0) * (c.mult || 1))}`;
}

function openEditModal(pid) {
    const data = DB.get();
    const p = data.find(x => x.id === pid);
    if (!p) return;

    editState = JSON.parse(JSON.stringify(p));

    $("#editProductId").value = pid;
    $("#editTanggal").value = p.date;
    $("#editNama").value = p.name;
    $("#editUnit").value = p.unit || "pcs";
    $("#editNote").value = p.note || "";

    renderEditContainerArea();
    $("#editModalOverlay").classList.add("open");
}

$("#btnEditBatal").addEventListener("click", () => {
    editState = null;
    $("#editModalOverlay").classList.remove("open");
});
$("#editModalOverlay").addEventListener("click", e => {
    if (e.target === $("#editModalOverlay")) {
        editState = null;
        $("#editModalOverlay").classList.remove("open");
    }
});

$("#btnEditSimpan").addEventListener("click", () => {
    if (!editState) return;
    const name = $("#editNama").value.trim();
    const date = $("#editTanggal").value;
    if (!name || !date) {
        alert("Nama dan tanggal wajib diisi.");
        return;
    }

    editState.name = name;
    editState.date = date;
    editState.unit = $("#editUnit").value.trim() || "pcs";
    editState.note = $("#editNote").value.trim();

    const data = DB.get();
    const idx = data.findIndex(x => x.id === editState.id);
    if (idx >= 0) data[idx] = editState;
    DB.save(data);
    Sync.update(editState)
        .then(() => showToast("✓ Tersimpan", "ok"))
        .catch(() => showToast("✗ Gagal sinkronisasi", "err"));

    editState = null;
    $("#editModalOverlay").classList.remove("open");
    if (currentTab === "riwayat") renderRiwayat();
    if (currentTab === "kalender") renderKalender();
    if (currentTab === "beranda") renderBeranda();
});

function deleteFromHistory(pid) {
    DB.deleteProduct(pid);
    if (currentTab === "riwayat") renderRiwayat();
    if (currentTab === "kalender") renderKalender();
}

function buildRiwayatItem(p) {
    const total = p.split
        ? p.containers.besar.reduce(
              (s, c) => s + (c.val || 0) * (c.mult || 1),
              0
          ) +
          p.containers.kecil.reduce(
              (s, c) => s + (c.val || 0) * (c.mult || 1),
              0
          )
        : p.containers.single.reduce(
              (s, c) => s + (c.val || 0) * (c.mult || 1),
              0
          );
    const target = p.split
        ? (p.targetBesar || 0) + (p.targetKecil || 0)
        : p.targetSingle || 0;
    const diff = total - target;
    const dClass =
        diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "diff-zero";

    return `<div class="riwayat-item" data-rid="${p.id}">
    <div class="drag-handle" title="Seret untuk mengurutkan"><span></span><span></span><span></span></div>
    <div class="riwayat-item-header" style="padding-left:26px">
      <div>
        <div class="riwayat-name">${p.name}</div>
        <div class="riwayat-meta">${p.split ? "Porsi Kecil + Besar" : "Single"} · Target ${formatNumberForDisplay(target)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="text-align:right">
          <div class="riwayat-total">${formatNumberForDisplay(total)}</div>
          <div style="font-size:11px;font-family:var(--mono)" class="${dClass}">${diff >= 0 ? "+" + formatNumberForDisplay(diff) : formatNumberForDisplay(diff)}</div>
        </div>
        <div class="riwayat-chevron">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
    </div>
    <div class="riwayat-detail">
      <div class="riwayat-detail-inner">
        ${renderSummary(p)}
        <div class="riwayat-actions">
          <button class="riwayat-action-btn edit" data-pid="${p.id}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="riwayat-action-btn delete" data-pid="${p.id}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Hapus
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

function attachRiwayatItemEvents(ctx) {
    $$(".riwayat-item", ctx).forEach(item => {
        item.querySelector(".riwayat-item-header").addEventListener(
            "click",
            () => {
                item.classList.toggle("expanded");
            }
        );
    });
    $$(".riwayat-action-btn.edit", ctx).forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            openEditModal(btn.dataset.pid);
        });
    });
    $$(".riwayat-action-btn.delete", ctx).forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            Confirm.show(btn, () => deleteFromHistory(btn.dataset.pid));
        });
    });
}

// ==================== RIWAYAT ====================
function renderRiwayat() {
    const pg = $("#page-riwayat");

    const getRange = () => {
        const t = today();
        if (riwayatFilter === "7d") {
            const from = new Date();
            from.setDate(from.getDate() - 6);
            const to = new Date();
            to.setDate(to.getDate() + 7);
            return [
                from.toISOString().split("T")[0],
                to.toISOString().split("T")[0]
            ];
        }
        if (riwayatFilter === "30d") {
            const from = new Date();
            from.setDate(from.getDate() - 29);
            const to = new Date();
            to.setDate(to.getDate() + 30);
            return [
                from.toISOString().split("T")[0],
                to.toISOString().split("T")[0]
            ];
        }
        if (riwayatFilter === "custom")
            return [riwayatFrom || t, riwayatTo || t];
        return [t, t];
    };

    const [from, to] = getRange();
    const data = DB.getByRange(from, to);
    const grouped = {};
    data.forEach(p => {
        if (!grouped[p.date]) grouped[p.date] = [];
        grouped[p.date].push(p);
    });
    const dates = Object.keys(grouped).sort().reverse();

    const customVisible = riwayatFilter === "custom" ? "visible" : "";
    // Simpan id item yang sedang expanded
    const currentExpanded = $$(".riwayat-item.expanded").map(
        el => el.dataset.rid
    );
    expandedRiwayatIds = new Set(currentExpanded);

    pg.innerHTML = `
    <div class="filter-row">
      <div class="filter-chip ${riwayatFilter === "7d" ? "active" : ""}" data-f="7d">7 Hari</div>
      <div class="filter-chip ${riwayatFilter === "30d" ? "active" : ""}" data-f="30d">Bulan Ini</div>
      <div class="filter-chip ${riwayatFilter === "custom" ? "active" : ""}" data-f="custom">Custom</div>
    </div>
    <div class="custom-range ${customVisible}" id="customRange">
      <div>
        <label class="field-label">Dari</label>
        <input class="field-input" type="date" id="rangeFrom" value="${riwayatFrom}" />
      </div>
      <div>
        <label class="field-label">Sampai</label>
        <input class="field-input" type="date" id="rangeTo" value="${riwayatTo}" />
      </div>
    </div>
    ${
        dates.length === 0
            ? `<div class="empty-state" style="min-height:200px"><p>Tidak ada data di rentang ini.</p></div>`
            : dates
                  .map(
                      date => `
        <div class="riwayat-day-group">
          <div class="riwayat-day-label">${fmtDay(date)}</div>
          ${grouped[date].map(p => buildRiwayatItem(p)).join("")}
        </div>`
                  )
                  .join("")
    }`;

    attachRiwayatItemEvents(pg);
    // Pulihkan expanded
    $$(".riwayat-item", pg).forEach(item => {
        if (expandedRiwayatIds.has(item.dataset.rid)) {
            item.classList.add("expanded");
        }
    });

    $$(".riwayat-day-group", pg).forEach(grp => makeSortable(grp));

    $$(".filter-chip", pg).forEach(chip => {
        chip.addEventListener("click", () => {
            riwayatFilter = chip.dataset.f;
            renderRiwayat();
        });
    });

    const fromEl = $("#rangeFrom"),
        toEl = $("#rangeTo");
    if (fromEl)
        fromEl.addEventListener("change", () => {
            riwayatFrom = fromEl.value;
            renderRiwayat();
        });
    if (toEl)
        toEl.addEventListener("change", () => {
            riwayatTo = toEl.value;
            renderRiwayat();
        });
}

// ==================== KALENDER ====================
function renderKalender() {
    const pg = $("#page-kalender");
    const allData = DB.get();
    const dateDots = {};
    allData.forEach(p => {
        dateDots[p.date] = true;
    });

    const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const now = new Date();
    const todayStr = today();
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startDow = firstDay.getDay();
    const monthName = firstDay.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric"
    });

    let cells = "";
    for (let i = 0; i < startDow; i++) {
        const day = -startDow + i + 1;
        const d = new Date(calYear, calMonth, day);
        const ds = formatYMD(calYear, calMonth, day);
        cells += `<div class="cal-day other-month" data-date="${ds}"><span>${d.getDate()}</span></div>`;
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const ds = formatYMD(calYear, calMonth, i);
        const isToday = ds === today();
        const hasDot = dateDots[ds];
        cells += `<div class="cal-day${isToday ? " today" : ""}${hasDot ? " has-data" : ""}" data-date="${ds}">
          <span>${i}</span>
          ${hasDot ? '<div class="cal-day-dot"><div class="dot"></div></div>' : ""}
        </div>`;
    }

    pg.innerHTML = `
    <div class="calendar-header">
      <button class="cal-nav-btn" id="calPrev">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="cal-month-year">${monthName}</div>
      <button class="cal-nav-btn" id="calNext">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
    <div class="cal-grid">
      ${DAYS.map(d => `<div class="cal-dow">${d}</div>`).join("")}
      ${cells}
    </div>
    <div id="calDetail" style="margin-top:18px"></div>`;

    $("#calPrev").addEventListener("click", () => {
        calMonth--;
        if (calMonth < 0) {
            calMonth = 11;
            calYear--;
        }
        renderKalender();
    });
    $("#calNext").addEventListener("click", () => {
        calMonth++;
        if (calMonth > 11) {
            calMonth = 0;
            calYear++;
        }
        renderKalender();
    });

    $$(".cal-day", pg).forEach(day => {
        day.addEventListener("click", () => {
            const date = day.dataset.date;
            $$(".cal-day", pg).forEach(d => d.classList.remove("selected"));
            day.classList.add("selected");
            renderCalDetail(date);
        });
    });
}

function renderCalDetail(date) {
    const det = $("#calDetail");
    const products = DB.getByDate(date);
    if (products.length === 0) {
        det.innerHTML = `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:13px">${fmtShort(date)} — Belum ada data</div>`;
        return;
    }
    det.innerHTML =
        `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:10px;font-family:var(--mono)">${fmtDay(date)}</div>` +
        products.map(p => buildRiwayatItem(p)).join("");

    attachRiwayatItemEvents(det);
    makeSortable(det);
}

// ==================== SETTINGS MODAL ====================
$("#settingsBtn").addEventListener("click", () => {
    $("#sbUrlInput").value = Sync.sbUrl();
    $("#sbKeyInput").value = Sync.sbKey();
    const w = localStorage.getItem("jp_numpad_width") || "80";
    $("#numpadWidthSlider").value = w;
    $("#numpadWidthVal").textContent = w;
    $("#toggleNumpadVertical").checked =
        localStorage.getItem("jp_numpad_v") !== "0";
    $("#toggleNumpadHorizontal").checked =
        localStorage.getItem("jp_numpad_h") !== "0";
    const ck = localStorage.getItem("jp_col_kecil") || "#e5534b";
    const cb = localStorage.getItem("jp_col_besar") || "#388bfd";
    $("#colKecilPicker").value = ck;
    $("#colKecilHex").value = ck;
    $("#colBesarPicker").value = cb;
    $("#colBesarHex").value = cb;
    $$('.color-swatch[data-col="kecil"]').forEach(s =>
        s.classList.toggle("active", s.dataset.hex === ck)
    );
    $$('.color-swatch[data-col="besar"]').forEach(s =>
        s.classList.toggle("active", s.dataset.hex === cb)
    );
    [
        ["singleInputSlider", "jp_input_single", "singleInputVal", "64"],
        ["singleStepperSlider", "jp_stepper_single", "singleStepperVal", "56"],
        ["splitInputSlider", "jp_input_split", "splitInputVal", "52"],
        ["splitStepperSlider", "jp_stepper_split", "splitStepperVal", "44"]
    ].forEach(([id, key, lid, def]) => {
        const v = localStorage.getItem(key) || def;
        const el = $("#" + id);
        if (el) el.value = v;
        const lb = $("#" + lid);
        if (lb) lb.textContent = v;
    });
    Sync.setStatus("");
    $("#settingsOverlay").classList.add("open");
});

$("#numpadWidthSlider").addEventListener("input", () => {
    const v = $("#numpadWidthSlider").value;
    $("#numpadWidthVal").textContent = v;
    localStorage.setItem("jp_numpad_width", v);
    document.documentElement.style.setProperty("--numpad-width", v + "vw");
});

$("#toggleNumpadVertical").addEventListener("change", () => {
    localStorage.setItem(
        "jp_numpad_v",
        $("#toggleNumpadVertical").checked ? "1" : "0"
    );
});
$("#toggleNumpadHorizontal").addEventListener("change", () => {
    localStorage.setItem(
        "jp_numpad_h",
        $("#toggleNumpadHorizontal").checked ? "1" : "0"
    );
});

function applyPanelSizes() {
    const r = document.documentElement;
    const si = localStorage.getItem("jp_input_single") || "64";
    const ss = localStorage.getItem("jp_stepper_single") || "56";
    const di = localStorage.getItem("jp_input_split") || "52";
    const ds = localStorage.getItem("jp_stepper_split") || "44";
    r.style.setProperty("--input-size-single", si + "px");
    r.style.setProperty("--stepper-size-single", ss + "px");
    r.style.setProperty("--input-size-split", di + "px");
    r.style.setProperty("--stepper-size-split", ds + "px");
}
applyPanelSizes();

[
    ["singleInputSlider", "jp_input_single", "singleInputVal"],
    ["singleStepperSlider", "jp_stepper_single", "singleStepperVal"],
    ["splitInputSlider", "jp_input_split", "splitInputVal"],
    ["splitStepperSlider", "jp_stepper_split", "splitStepperVal"]
].forEach(([id, key, labelId]) => {
    const el = $("#" + id);
    if (!el) return;
    el.addEventListener("input", () => {
        $("#" + labelId).textContent = el.value;
        localStorage.setItem(key, el.value);
        applyPanelSizes();
    });
});

function applyColSetting(col, hex) {
    const key = col === "kecil" ? "jp_col_kecil" : "jp_col_besar";
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    localStorage.setItem(key, hex);
    $$('.color-swatch[data-col="' + col + '"]').forEach(s =>
        s.classList.toggle("active", s.dataset.hex === hex)
    );
    if (col === "kecil") {
        $("#colKecilPicker").value = hex;
        $("#colKecilHex").value = hex;
    } else {
        $("#colBesarPicker").value = hex;
        $("#colBesarHex").value = hex;
    }
}

$$(".color-swatch").forEach(btn => {
    btn.addEventListener("click", () =>
        applyColSetting(btn.dataset.col, btn.dataset.hex)
    );
});

["colKecilPicker", "colBesarPicker"].forEach(id => {
    const col = id.includes("Kecil") ? "kecil" : "besar";
    const hexInput = id.includes("Kecil")
        ? $("#colKecilHex")
        : $("#colBesarHex");
    $("#" + id).addEventListener("input", () => {
        hexInput.value = $("#" + id).value;
        applyColSetting(col, $("#" + id).value);
    });
});

["colKecilHex", "colBesarHex"].forEach(id => {
    const col = id.includes("Kecil") ? "kecil" : "besar";
    const picker = id.includes("Kecil")
        ? $("#colKecilPicker")
        : $("#colBesarPicker");
    $("#" + id).addEventListener("change", () => {
        const v = $("#" + id).value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
            picker.value = v;
            applyColSetting(col, v);
        }
    });
});

$("#btnSettingsBatal").addEventListener("click", () => {
    $("#settingsOverlay").classList.remove("open");
});
$("#settingsOverlay").addEventListener("click", e => {
    if (e.target === $("#settingsOverlay"))
        $("#settingsOverlay").classList.remove("open");
});

$("#btnSimpanUrl").addEventListener("click", async () => {
    const url = $("#sbUrlInput").value.trim();
    const key = $("#sbKeyInput").value.trim();
    if (url) localStorage.setItem(SB_URL_KEY, url);
    if (key) localStorage.setItem(SB_KEY_KEY, key);
    Sync.setStatus("Menghubungkan ke Supabase...", "");
    try {
        await Sync.pull();
        Sync.setStatus("✓ Terhubung! Data berhasil disinkronisasi.", "ok");
        refreshApp();
    } catch (e) {
        Sync.setStatus("✗ Gagal terhubung. Periksa URL dan Key.", "err");
    }
});

$("#btnSyncNow").addEventListener("click", async () => {
    Sync.setStatus("Menyinkronkan...", "");
    try {
        await Sync.pull();
        Sync.setStatus("✓ Sinkronisasi berhasil.", "ok");
        refreshApp();
    } catch (e) {
        Sync.setStatus("✗ Gagal. Periksa koneksi internet.", "err");
    }
});

(function () {
    Sync.setDot("ok");
    Sync.pull()
        .then(() => refreshApp())
        .catch(() => Sync.setDot("err"));
})();

// ==================== DRAG & DROP SORT ====================
function makeSortable(containerEl, getIdFn) {
    let dragEl = null,
        ghostEl = null;
    let startX = 0,
        startY = 0,
        offsetX = 0,
        offsetY = 0;
    let lastOver = null;

    function getItems() {
        return [
            ...containerEl.querySelectorAll(
                ":scope > [data-pid], :scope > [data-rid]"
            )
        ];
    }

    function createGhost(el) {
        const rect = el.getBoundingClientRect();
        const g = el.cloneNode(true);
        g.className = "drag-ghost";
        g.style.width = rect.width + "px";
        g.style.top = rect.top + "px";
        g.style.left = rect.left + "px";
        document.body.appendChild(g);
        return g;
    }

    function moveGhost(x, y) {
        if (!ghostEl) return;
        ghostEl.style.top = y - offsetY + "px";
        ghostEl.style.left = x - offsetX + "px";
    }

    function getTargetItem(y) {
        return getItems().find(el => {
            if (el === dragEl) return false;
            const r = el.getBoundingClientRect();
            return y >= r.top && y <= r.bottom;
        });
    }

    containerEl.addEventListener(
        "touchstart",
        e => {
            const handle = e.target.closest(".drag-handle");
            if (!handle) return;
            e.preventDefault();
            const item = handle.closest("[data-pid],[data-rid]");
            if (!item) return;

            dragEl = item;
            const rect = item.getBoundingClientRect();
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            offsetX = touch.clientX - rect.left;
            offsetY = touch.clientY - rect.top;

            ghostEl = createGhost(item);
            dragEl.classList.add("dragging");
            dragEl.classList.remove("expanded");
        },
        { passive: false }
    );

    containerEl.addEventListener(
        "touchmove",
        e => {
            if (!dragEl) return;
            e.preventDefault();
            const touch = e.touches[0];
            moveGhost(touch.clientX, touch.clientY);

            const over = getTargetItem(touch.clientY);
            if (over !== lastOver) {
                if (lastOver) lastOver.classList.remove("drag-over");
                if (over) over.classList.add("drag-over");
                lastOver = over;
            }
        },
        { passive: false }
    );

    containerEl.addEventListener("touchend", e => {
        if (!dragEl) return;

        if (ghostEl) {
            ghostEl.remove();
            ghostEl = null;
        }
        dragEl.classList.remove("dragging");
        if (lastOver) lastOver.classList.remove("drag-over");

        const drop = lastOver;
        lastOver = null;

        if (drop && drop !== dragEl) {
            const items = getItems();
            const fromIdx = items.indexOf(dragEl);
            const toIdx = items.indexOf(drop);

            if (fromIdx !== toIdx) {
                if (fromIdx < toIdx) drop.after(dragEl);
                else drop.before(dragEl);

                const newOrder = getItems().map(
                    el => el.dataset.pid || el.dataset.rid
                );
                const allData = DB.get();
                newOrder.forEach((id, idx) => {
                    const p = allData.find(x => x.id === id);
                    if (p) p.order = idx;
                });
                DB.save(allData);

                newOrder.forEach(id => {
                    const p = allData.find(x => x.id === id);
                    if (p) Sync.update(p).catch(() => {});
                });
                showToast("✓ Urutan disimpan", "ok");
            }
        }

        dragEl = null;
    });
}

// ==================== KALKULATOR ====================
const Calc = (() => {
    let expr = "";
    let justEq = false;
    let history = JSON.parse(localStorage.getItem("jp_calc_history") || "[]");

    const saveHistory = () =>
        localStorage.setItem("jp_calc_history", JSON.stringify(history));
    const OPS = ["+", "−", "×", "÷"];

    const fmtNum = n => {
        if (n === null || n === undefined || !isFinite(n)) return "Error";
        return parseFloat(n.toPrecision(12)).toString();
    };

    const unclosedParens = () => {
        let n = 0;
        for (const ch of expr) {
            if (ch === "(") n++;
            else if (ch === ")") n--;
        }
        return n;
    };

    function tokenize(s) {
        const tokens = [];
        let num = "";
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if ("0123456789.".includes(ch)) {
                num += ch;
            } else {
                if (num) {
                    tokens.push(parseFloat(num));
                    num = "";
                }
                if (OPS.includes(ch) || ch === "(" || ch === ")")
                    tokens.push(ch);
            }
        }
        if (num) tokens.push(parseFloat(num));
        return tokens;
    }

    function evaluate(s) {
        const tokens = tokenize(s);
        const prec = { "+": 1, "−": 1, "×": 2, "÷": 2 };
        const out = [],
            ops = [];
        const applyOp = () => {
            const op = ops.pop(),
                b = out.pop(),
                a = out.pop();
            if (op === "+") out.push(a + b);
            else if (op === "−") out.push(a - b);
            else if (op === "×") out.push(a * b);
            else if (op === "÷") {
                if (b === 0) throw new Error("div0");
                out.push(a / b);
            }
        };
        for (const tok of tokens) {
            if (typeof tok === "number") {
                out.push(tok);
            } else if (tok === "(") {
                ops.push(tok);
            } else if (tok === ")") {
                while (ops.length && ops[ops.length - 1] !== "(") applyOp();
                ops.pop();
            } else if (OPS.includes(tok)) {
                while (
                    ops.length &&
                    ops[ops.length - 1] !== "(" &&
                    prec[ops[ops.length - 1]] >= prec[tok]
                )
                    applyOp();
                ops.push(tok);
            }
        }
        while (ops.length) applyOp();
        return out[0] ?? null;
    }

    function tryEval(s) {
        if (!s) return null;
        try {
            const open =
                (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
            const closed = s + ")".repeat(Math.max(0, open));
            const last = closed.trim().slice(-1);
            if (OPS.includes(last) || last === "(") return null;
            const res = evaluate(closed);
            return res !== null && isFinite(res) ? fmtNum(res) : null;
        } catch {
            return null;
        }
    }

    const lastIsOp = () => expr.length > 0 && OPS.includes(expr.slice(-1));
    const lastIsNum = () =>
        expr.length > 0 && "0123456789.)".includes(expr.slice(-1));
    const lastChar = () => expr.slice(-1);

    function pressNum(n) {
        if (justEq) {
            expr = "";
            justEq = false;
        }
        expr += n;
    }

    function pressOp(o) {
        if (justEq) {
            justEq = false;
        }
        if (!expr) return;
        if (lastIsOp()) {
            expr = expr.slice(0, -1) + o;
        } else if (lastChar() !== "(") {
            expr += o;
        }
    }

    function pressParen() {
        if (justEq) {
            expr = "";
            justEq = false;
        }
        if (!expr || lastIsOp() || lastChar() === "(") {
            expr += "(";
        } else if (unclosedParens() > 0 && lastIsNum()) {
            expr += ")";
        } else {
            expr += "(";
        }
    }

    function pressDot() {
        if (justEq) {
            expr = "";
            justEq = false;
        }
        const parts = expr.split(/[+−×÷()]/);
        const last = parts[parts.length - 1];
        if (!last.includes(".")) expr += ".";
    }

    function pressPercent() {
        const live = tryEval(expr);
        if (live !== null) {
            expr = fmtNum(parseFloat(live) / 100);
            justEq = false;
        }
    }

    function pressEq() {
        if (!expr) return;
        const open = unclosedParens();
        const full = expr + ")".repeat(open);
        const hasOp = OPS.some(op => full.includes(op));
        if (!hasOp) {
            expr = full;
            justEq = true;
            return;
        }
        try {
            const res = evaluate(full);
            if (res === null || !isFinite(res)) {
                expr = "Error";
                justEq = true;
                return;
            }
            const result = fmtNum(res);
            history.push({ expr: full, result });
            if (history.length > 50) history.shift();
            saveHistory();
            expr = result;
            justEq = true;
        } catch {
            expr = "Error";
            justEq = true;
        }
    }

    function pressDel() {
        if (justEq) {
            expr = "";
            justEq = false;
            return;
        }
        if (expr === "Error") {
            expr = "";
            return;
        }
        expr = expr.slice(0, -1);
    }

    function pressClear() {
        expr = "";
        justEq = false;
    }

    function getExprLine() {
        if (justEq) return expr;
        return expr || "0";
    }

    function getResultLine() {
        if (justEq) return "";
        const live = tryEval(expr);
        return live !== null && live !== expr ? "= " + live : "";
    }

    function isJustEq() {
        return justEq;
    }
    function clearHistory() {
        history = [];
        saveHistory();
    }

    return {
        pressNum,
        pressOp,
        pressDot,
        pressPercent,
        pressEq,
        pressDel,
        pressClear,
        pressParen,
        getExprLine,
        getResultLine,
        isJustEq,
        getCur: () => expr || "0",
        getHistory: () => history,
        clearHistory
    };
})();

function renderKalkulator(animate = false) {
    const pg = $("#page-kalkulator");
    const hist = Calc.getHistory();
    const total = hist.length;

    const histHTML =
        total === 0
            ? ""
            : hist
                  .map((h, i) => {
                      const delay = animate
                          ? ((total - 1 - i) * 0.07).toFixed(2)
                          : "0";
                      return `<div class="calc-history-item" data-hidx="${i}" style="animation-delay:${delay}s">
          <span class="calc-history-expr">${h.expr} =</span>
          <span class="calc-history-result">${h.result}</span>
        </div>`;
                  })
                  .join("");

    pg.innerHTML = `
    <div class="calc-scroll-area" id="calcScrollArea">
      ${
          Calc.getHistory().length > 0
              ? `
      <button class="calc-history-clear" id="calcHistClear">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        Hapus
      </button>`
              : ""
      }
      <div class="calc-history-list">${histHTML}</div>
    </div>
    <div class="calc-fixed-bottom">
      <div class="calc-display">
        <div class="calc-expr" id="calcExpr"></div>
        <div class="calc-val" id="calcVal"></div>
      </div>
      <div class="calc-grid">
        <button class="ck ck-clear" data-c="AC">AC</button>
        <button class="ck ck-op" data-c="()">(  )</button>
        <button class="ck ck-op" data-c="%">%</button>
        <button class="ck ck-op" data-c="÷">÷</button>
        <button class="ck" data-c="7">7</button>
        <button class="ck" data-c="8">8</button>
        <button class="ck" data-c="9">9</button>
        <button class="ck ck-op" data-c="×">×</button>
        <button class="ck" data-c="4">4</button>
        <button class="ck" data-c="5">5</button>
        <button class="ck" data-c="6">6</button>
        <button class="ck ck-op" data-c="−">−</button>
        <button class="ck" data-c="1">1</button>
        <button class="ck" data-c="2">2</button>
        <button class="ck" data-c="3">3</button>
        <button class="ck ck-op" data-c="+">+</button>
        <button class="ck" data-c="0">0</button>
        <button class="ck" data-c=".">.</button>
        <button class="ck ck-op" data-c="DEL">⌫</button>
        <button class="ck ck-eq" data-c="=">=</button>
      </div>
    </div>`;

    function update() {
        const exprEl = $("#calcExpr");
        const valEl = $("#calcVal");
        if (Calc.isJustEq()) {
            exprEl.textContent = Calc.getExprLine();
            exprEl.style.fontSize = "36px";
            exprEl.style.fontWeight = "700";
            exprEl.style.color = "var(--text)";
            valEl.textContent = "";
            valEl.style.fontSize = "";
        } else {
            exprEl.textContent = Calc.getExprLine();
            exprEl.style.fontSize = "";
            exprEl.style.fontWeight = "";
            exprEl.style.color = "";
            valEl.textContent = Calc.getResultLine();
            valEl.style.fontSize = "";
        }
    }

    update();

    $$(".ck", pg).forEach(btn => {
        btn.addEventListener("click", () => {
            const c = btn.dataset.c;
            if ("0123456789".includes(c)) Calc.pressNum(c);
            else if (c === ".") Calc.pressDot();
            else if (c === "%") Calc.pressPercent();
            else if (c === "()") Calc.pressParen();
            else if (["+", "−", "×", "÷"].includes(c)) Calc.pressOp(c);
            else if (c === "=") {
                Calc.pressEq();
                renderKalkulator(true);
                const sa = $("#calcScrollArea");
                if (sa) sa.scrollTop = sa.scrollHeight;
                return;
            } else if (c === "AC") Calc.pressClear();
            else if (c === "DEL") Calc.pressDel();
            update();
        });
    });

    $$(".calc-history-item", pg).forEach(item => {
        item.addEventListener("click", () => {
            const idx = parseInt(item.dataset.hidx);
            const h = Calc.getHistory()[idx];
            if (h) {
                Calc.pressClear();
                "" +
                    h.result.split("").forEach(ch => {
                        if ("0123456789".includes(ch)) Calc.pressNum(ch);
                        else if (ch === ".") Calc.pressDot();
                    });
                update();
            }
        });
    });

    const histClearBtn = $("#calcHistClear");
    if (histClearBtn)
        histClearBtn.addEventListener("click", () => {
            Calc.clearHistory();
            renderKalkulator();
        });
}

// ==================== CONFIRM POPUP ====================
const Confirm = (() => {
    const backdrop = document.getElementById("confirmBackdrop");
    const popup = document.getElementById("confirmPopup");
    const yesBtn = document.getElementById("confirmYes");
    let onYes = null;

    function show(triggerEl, cb) {
        onYes = cb;
        popup.classList.remove("hiding");
        backdrop.style.display = "block";
        popup.style.display = "flex";

        requestAnimationFrame(() => {
            const rect = triggerEl.getBoundingClientRect();
            const pw = popup.offsetWidth;
            const ph = popup.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const gap = 6;

            let top = rect.top - ph - gap;
            let left = rect.left + rect.width / 2 - pw / 2;

            if (top < gap) top = rect.bottom + gap;
            if (top + ph > vh - gap) top = vh - ph - gap;

            left = Math.max(gap, Math.min(left, vw - pw - gap));

            popup.style.top = top + "px";
            popup.style.left = left + "px";
        });
    }

    function hide() {
        popup.classList.add("hiding");
        setTimeout(() => {
            popup.style.display = "none";
            backdrop.style.display = "none";
            popup.classList.remove("hiding");
        }, 120);
        onYes = null;
    }

    yesBtn.addEventListener("click", e => {
        e.stopPropagation();
        const cb = onYes;
        hide();
        if (cb) cb();
    });

    backdrop.addEventListener("click", () => hide());

    return { show, hide };
})();

// ==================== NUMPAD KEYBOARD (desimal) ====================
const Numpad = (() => {
    const overlay = document.getElementById("numpad");
    const backdrop = document.getElementById("numpadBackdrop");
    const display = document.getElementById("numpadDisplay");
    const delBtn = document.getElementById("numpadDel");
    const okBtn = document.getElementById("numpadOk");

    let activeInput = null;
    let currentVal = ""; // simpan sebagai string dengan koma
    let originalVal = "";
    let onCommit = null;

    function show(inputEl, commitCb) {
        if (window.innerWidth >= 768) return;
        activeInput = inputEl;
        onCommit = commitCb;
        currentVal = "";
        originalVal = inputEl.value || "";
        // Tampilkan originalVal dengan format desimal (ganti titik ke koma jika perlu)
        let displayVal = originalVal.replace(/\./g, ",");
        display.textContent = displayVal || "0";
        currentVal = displayVal === "0" ? "" : displayVal;

        const savedWidth = localStorage.getItem("jp_numpad_width") || "80";
        document.documentElement.style.setProperty(
            "--numpad-width",
            savedWidth + "vw"
        );

        const modeV = localStorage.getItem("jp_numpad_v") !== "0";
        const modeH = localStorage.getItem("jp_numpad_h") !== "0";

        const container = overlay.querySelector(".numpad-container");
        container.classList.remove("hiding");

        backdrop.style.display = "block";
        overlay.style.display = "block";

        requestAnimationFrame(() => {
            const rect = inputEl.getBoundingClientRect();
            const kbH = container.offsetHeight;
            const kbW = container.offsetWidth;
            const gap = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            if (modeV) {
                const rowMidOffset = kbH * 0.52;
                const inputCenterY = rect.top + rect.height / 2;
                let top = inputCenterY - rowMidOffset;
                top = Math.max(gap, Math.min(top, vh - kbH - gap));
                overlay.style.top = top + "px";
                overlay.style.bottom = "";
                overlay.style.justifyContent = "center";
            } else {
                overlay.style.top = "";
                overlay.style.bottom = "80px";
                overlay.style.justifyContent = "center";
            }

            if (modeH) {
                const inputCenterX = rect.left + rect.width / 2;
                let left = inputCenterX - kbW / 2;
                left = Math.max(gap, Math.min(left, vw - kbW - gap));
                overlay.style.justifyContent = "flex-start";
                container.style.marginLeft = left + "px";
            } else {
                overlay.style.justifyContent = "center";
                container.style.marginLeft = "";
            }
        });
    }

    function hide() {
        const container = overlay.querySelector(".numpad-container");
        container.classList.add("hiding");
        setTimeout(() => {
            overlay.style.display = "none";
            backdrop.style.display = "none";
            container.classList.remove("hiding");
            container.style.marginLeft = "";
        }, 140);
        activeInput = null;
        onCommit = null;
        currentVal = "";
    }

    function press(val) {
        if (val === ",") {
            if (currentVal.includes(",")) return; // hanya satu koma
            if (currentVal === "") currentVal = "0,";
            else currentVal += ",";
        } else {
            // angka
            if (currentVal === "") currentVal = val;
            else currentVal += val;
        }
        // batasi panjang (opsional)
        if (currentVal.length > 12) currentVal = currentVal.slice(0, 12);
        display.textContent = currentVal;
        if (activeInput) activeInput.value = currentVal.replace(/,/g, ".");
    }

    function del() {
        if (currentVal.length <= 1) {
            currentVal = "";
            display.textContent = "0";
            if (activeInput) activeInput.value = "";
        } else {
            currentVal = currentVal.slice(0, -1);
            display.textContent = currentVal === "" ? "0" : currentVal;
            if (activeInput) activeInput.value = currentVal.replace(/,/g, ".");
        }
    }

    function commit() {
        let floatVal = 0;
        if (currentVal === "") {
            floatVal = 0;
        } else {
            // ganti koma ke titik untuk parsing
            floatVal = parseFloat(currentVal.replace(/,/g, "."));
            if (isNaN(floatVal)) floatVal = 0;
        }
        if (activeInput)
            activeInput.value = floatVal.toString().replace(/\./g, ",");
        const cb = onCommit;
        hide();
        if (cb) cb(floatVal);
    }

    // Event listeners
    $$(".nk[data-val]", overlay).forEach(btn => {
        btn.addEventListener("pointerdown", e => {
            e.preventDefault();
            press(btn.dataset.val);
        });
    });
    if (delBtn)
        delBtn.addEventListener("pointerdown", e => {
            e.preventDefault();
            del();
        });
    if (okBtn)
        okBtn.addEventListener("pointerdown", e => {
            e.preventDefault();
            commit();
        });

    backdrop.addEventListener("pointerdown", e => {
        e.preventDefault();
        e.stopPropagation();
        commit();
    });

    return { show, hide, commit };
})();

function attachNumpad(ctx) {
    if (window.innerWidth >= 768) return;

    function bindNumpad(input, commitCb) {
        input.setAttribute("inputmode", "none");
        input.setAttribute("readonly", "readonly");

        let startX, startY;

        input.addEventListener("pointerdown", e => {
            startX = e.clientX;
            startY = e.clientY;
        });

        input.addEventListener("pointerup", e => {
            const dx = Math.abs(e.clientX - startX);
            const dy = Math.abs(e.clientY - startY);
            if (dx > 8 || dy > 8) return;
            e.preventDefault();
            Numpad.show(input, commitCb);
        });
    }

    $$(".container-input", ctx).forEach(input => {
        const pid = input.dataset.pid;
        const col = input.dataset.col;
        const cidx = parseInt(input.dataset.cidx);
        bindNumpad(input, val => {
            input.removeAttribute("readonly");
            input.value = formatNumberForDisplay(val);
            input.setAttribute("readonly", "readonly");
            const data = DB.get();
            const p = data.find(x => x.id === pid);
            if (!p) return;
            p.containers[col][cidx].val = val;
            saveAndSync(pid, data);
            updateResult(pid, col, cidx, p.containers[col][cidx]);
            refreshSummary(pid);
        });
    });

    $$(".mult-step-input", ctx).forEach(input => {
        const pid = input.dataset.pid;
        const col = input.dataset.col;
        const cidx = parseInt(input.dataset.cidx);
        bindNumpad(input, val => {
            const v = Math.max(1, val);
            input.removeAttribute("readonly");
            input.value = v;
            input.setAttribute("readonly", "readonly");
            saveMult(pid, col, cidx, v);
        });
    });
}

// ==================== SINKRONISASI PERIODIK ====================
let syncInterval = null;
const SYNC_INTERVAL_MS = 300000; // 15 detik

async function periodicSync() {
    if (document.hidden) return;
    try {
        const changed = await Sync.pull(); // true jika data berubah
        if (changed) {
            saveScrollPosition(currentTab);
            if (currentTab === "beranda") renderBeranda();
            if (currentTab === "riwayat") renderRiwayat();
            if (currentTab === "kalender") renderKalender();
            if (currentTab === "kalkulator") renderKalkulator();
            restoreScrollPosition(currentTab);
            showToast("🔄 Data tersinkronisasi", "ok");
        }
    } catch (e) {
        console.warn("Periodic sync gagal", e);
    }
}

function startPeriodicSync() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(periodicSync, SYNC_INTERVAL_MS);
}

function stopPeriodicSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

// Hentikan saat halaman ditutup (opsional)
window.addEventListener("beforeunload", () => {
    stopPeriodicSync();
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
    });
}

// ==================== AUTO HIDE HEADER & BOTTOM NAV ====================
let lastScrollTop = 0;
const header = document.querySelector(".app-header");
const bottomNav = document.querySelector(".bottom-nav");
const SCROLL_THRESHOLD = 10;

function handleScroll() {
    const activePage = document.querySelector(".page.active");
    if (!activePage) return;
    const scrollTop = activePage.scrollTop;
    const scrollDiff = scrollTop - lastScrollTop;

    if (scrollDiff > SCROLL_THRESHOLD && scrollTop > 50) {
        header.classList.add("hide");
        bottomNav.classList.add("hide");
    } else if (scrollDiff < -SCROLL_THRESHOLD || scrollTop <= 10) {
        header.classList.remove("hide");
        bottomNav.classList.remove("hide");
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
}

function attachAutoHideListener() {
    const activePage = document.querySelector(".page.active");
    if (activePage) {
        activePage.removeEventListener("scroll", handleScroll);
        activePage.addEventListener("scroll", handleScroll, { passive: true });
    }
}

// Setelah setiap pergantian tab
const originalSetTab = setTab;
window.setTab = function (tab) {
    originalSetTab(tab);
    setTimeout(attachAutoHideListener, 100);
};

document.addEventListener("DOMContentLoaded", () => {
    setTab("beranda");
    startPeriodicSync();
    attachAutoHideListener();
});
