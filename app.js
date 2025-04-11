// app.js

// ========== UTILITAS ========== //
function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(angka);
}

function showForm(jenis) {
  let html = `
    <form onsubmit="saveTransaksi(event, '${jenis}')">
      <div class="mb-2">
        <label>Nominal</label>
        <input type="number" class="form-control" name="nominal" required>
      </div>
      <div class="mb-2">
        <label>Tanggal</label>
        <input type="date" class="form-control" name="tanggal" required value="${new Date().toISOString().split("T")[0]}">
      </div>
  `;

  if (jenis === "transfer") {
    html += `
      <div class="mb-2">
        <label>Dari Dompet</label>
        <input type="text" class="form-control" name="dompet_asal" required>
      </div>
      <div class="mb-2">
        <label>Ke Dompet</label>
        <input type="text" class="form-control" name="dompet_tujuan" required>
      </div>
    `;
  } else {
    html += `
      <div class="mb-2">
        <label>Dompet</label>
        <input type="text" class="form-control" name="${jenis === "pemasukan" ? "dompet_tujuan" : "dompet_asal"}" required>
      </div>
    `;
  }

  html += `
    <div class="mb-2">
      <label>Kategori</label>
      <input type="text" class="form-control" name="kategori" required>
    </div>
    <div class="mb-2">
      <label>Catatan</label>
      <input type="text" class="form-control" name="catatan">
    </div>
    <button type="submit" class="btn btn-primary w-100">Simpan</button>
  </form>
  `;

  document.getElementById("form-area").innerHTML = html;
}

// ========== SIMPAN TRANSAKSI ========== //
async function saveTransaksi(e, jenis) {
  e.preventDefault();
  const form = e.target;

  const data = {
    jenis,
    nominal: parseFloat(form.nominal.value),
    tanggal: form.tanggal.value,
    kategori: form.kategori.value,
    catatan: form.catatan.value || "-",
    dompet_asal: form.dompet_asal?.value || null,
    dompet_tujuan: form.dompet_tujuan?.value || null,
  };

  await db.transaksi.add(data);
  form.reset();
  document.getElementById("form-area").innerHTML = "";
  loadSummary();
  loadTransaksi();
}

// ========== RINGKASAN SALDO ========== //
async function loadSummary() {
  const transaksi = await db.transaksi.toArray();
  const saldo = {};

  transaksi.forEach(t => {
    if (t.jenis === "pemasukan") {
      saldo[t.dompet_tujuan] = (saldo[t.dompet_tujuan] || 0) + t.nominal;
    } else if (t.jenis === "pengeluaran") {
      saldo[t.dompet_asal] = (saldo[t.dompet_asal] || 0) - t.nominal;
    } else if (t.jenis === "transfer") {
      saldo[t.dompet_asal] = (saldo[t.dompet_asal] || 0) - t.nominal;
      saldo[t.dompet_tujuan] = (saldo[t.dompet_tujuan] || 0) + t.nominal;
    }
  });

  let html = "<ul class='list-group'>";
  for (const dompet in saldo) {
    html += `<li class="list-group-item d-flex justify-content-between">
      <span>${dompet}</span><strong>${formatRupiah(saldo[dompet])}</strong>
    </li>`;
  }
  html += "</ul>";

  document.getElementById("summary").innerHTML = html;
}

// ========== RIWAYAT TRANSAKSI ========== //
async function loadTransaksi() {
  const data = await db.transaksi.orderBy("tanggal").reverse().limit(20).toArray();
  let html = "<ul class='list-group'>";

  data.forEach(t => {
    html += `<li class="list-group-item">
      <div class="d-flex justify-content-between">
        <div>
          <small>${t.tanggal}</small><br>
          <strong>${t.jenis.toUpperCase()}</strong> - ${t.kategori}<br>
          <small>${t.catatan}</small>
        </div>
        <div class="text-end">
          <span class="${t.jenis === 'pemasukan' ? 'text-success' : t.jenis === 'pengeluaran' ? 'text-danger' : 'text-warning'}">
            ${formatRupiah(t.nominal)}
          </span>
        </div>
      </div>
    </li>`;
  });

  html += "</ul>";
  document.getElementById("transaction-list").innerHTML = html;
}

// ========== BACKUP ========== //
async function backupData() {
  const transaksi = await db.transaksi.toArray();
  const data = { transaksi };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "backup-keuangan.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ========== IMPORT ========== //
function importData(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const json = JSON.parse(e.target.result);
    await db.transaksi.clear();
    await db.transaksi.bulkAdd(json.transaksi);
    alert("Import selesai!");
    loadSummary();
    loadTransaksi();
  };
  reader.readAsText(file);
}

// ========== INISIALISASI ========== //
window.addEventListener("load", () => {
  loadSummary();
  loadTransaksi();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
});
