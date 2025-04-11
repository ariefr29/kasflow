// db.js
const db = new Dexie("KeuanganApp");

db.version(1).stores({
  dompet: "++id, nama_dompet",
  transaksi: "++id, jenis, nominal, tanggal, dompet_asal, dompet_tujuan, kategori, catatan"
});
