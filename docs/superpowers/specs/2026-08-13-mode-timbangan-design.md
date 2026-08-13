# Design: Mode Timbangan (ganti Sample)

Tanggal: 2026-08-13
Proyek: jurnalproduksi

## Konsep
Hapus total mode Sample. Tambah mode **Timbangan**: 5 kategori tetap (Kecil, Besar,
SMP, Balita, Busui), input **berat (kg, 2 desimal)** + **porsi (opsional, integer)**
per kategori. Unit fix kg. Single & Split tidak berubah.

## Keputusan
- Reuse kolom `sample` di tabel `produksi` (zero migrasi). `sample=true` = timbangan.
- `sample_labels` dihapus dari `toRow`/`fromRow` (kolom DB dibiarkan kosong).
- Data sample lama (deteksi `Array.isArray(containers.raw)`) diskip saat load —
  tidak dirender, tidak dihapus (lembaran baru).
- UI semua label "Sample" → "Timbangan".

## Data
`containers` JSONB (1 kolom), nested object per kategori:
```json
containers = {
  "kecil":  { "berat": 20.0, "porsi": 800 },
  "besar":  { "berat": 35.0, "porsi": 500 },
  "smp":    { "berat": 12.0, "porsi": 300 },
  "balita": { "berat": 8.0,  "porsi": 200 },
  "busui":  { "berat": 10.0, "porsi": 250 }
}
```
porsi boleh kosong → 0, tampil `–`. berat selalu 2 desimal (`20,00`).

## Tampilan
- Add modal: checkbox "Timbangan" (ganti "Sample"). Aktif → 5 kolom berat+porsi,
  unit otomatis kg.
- Kartu riwayat: baris per kategori `Kecil — 20,00 kg · 800 porsi`; header total berat.
- Beranda: sama seperti kartu.
- Laporan: chip "Sample"→"Timbangan"; target/pencapaian `–`; blok rincian kategori
  (total berat + total porsi per kategori sepanjang periode).
- Edit modal: 5 kategori berat+porsi editable.

## Desimal & format
- `fmtBerat(num)` = `toFixed(2)` + koma. `fmtPorsi(num)` = integer, `0` → `–`.
- Parse input: terima koma/titik (parseNumberFromInput existing).

## File
app.js, beranda.js, laporan-core.js, laporan.js, index.html, css,
dev/test-laporan-core.cjs.

## Testing
node dev/test-laporan-core.cjs, node --check semua JS, serve lokal, push main.
