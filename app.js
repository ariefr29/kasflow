// app.js

// ========== UTILITAS ========== //
function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(angka);
}

async function showForm(jenis) {
  const { dompetOptions, kategoriOptions } = await getDropdownOptions(jenis);

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
        <select class="form-select" name="dompet_asal" required>${dompetOptions}</select>
      </div>
      <div class="mb-2">
        <label>Ke Dompet</label>
        <select class="form-select" name="dompet_tujuan" required>${dompetOptions}</select>
      </div>
    `;
  } else {
    const dompetField = jenis === "pemasukan" ? "dompet_tujuan" : "dompet_asal";
    html += `
      <div class="mb-2">
        <label>Dompet</label>
        <select class="form-select" name="${dompetField}" required>${dompetOptions}</select>
      </div>
    `;
  }

  const kategoriList = await db.kategori.where("jenis").equals(jenis).toArray();
  if (jenis !== "transfer") {
    const kategoriOptions = kategoriList.map(k => `<option value="${k.nama_kategori}">${k.nama_kategori}</option>`).join("");
    html += `
      <div class="mb-2">
        <label>Kategori</label>
        <select class="form-select" name="kategori" required>
          <option value="" disabled selected>Pilih Kategori</option>
          ${kategoriOptions}
        </select>
      </div>
    `;
  }
  
  
  html += `
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

  let totalSemua = 0;
  let html = "<ul class='list-group'>";
  for (const dompet in saldo) {
    totalSemua += saldo[dompet]; // Tambahkan saldo per dompet ke total
    html += `<li class="list-group-item d-flex justify-content-between">
      <span>${dompet}</span><strong>${formatRupiah(saldo[dompet])}</strong>
    </li>`;
  }
  html += "</ul>";

  // Tambahkan total keseluruhan di bawah daftar dompet
  html += `
    <div class="alert alert-success mt-3">
      Total Saldo Keseluruhan: <strong>${formatRupiah(totalSemua)}</strong>
    </div>
  `;

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


// ========== Dropdown menu option ========== //
async function getDropdownOptions(jenisTransaksi) {
  const dompetList = await db.dompet.toArray();
  const kategoriList = await db.kategori.where("jenis").equals(jenisTransaksi).toArray();

  return {
    dompetOptions: dompetList.map(d => `<option value="${d.nama_dompet}">${d.nama_dompet}</option>`).join(""),
    kategoriOptions: kategoriList.map(k => `<option value="${k.nama_kategori}">${k.nama_kategori}</option>`).join(""),
  };
}

async function showPengaturan() {
  const dompetList = await db.dompet.toArray();
  const kategoriList = await db.kategori.toArray();

  let html = `
    <div class="row">
      <div class="col-md-6">
        <h6>Dompet</h6>
        <ul class="list-group mb-2">
          ${dompetList.map(d => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <input type="text" value="${d.nama_dompet}" onchange="editDompet(${d.id}, this.value)" class="form-control me-2">
              <button class="btn btn-sm btn-danger" onclick="hapusDompet(${d.id})">Hapus</button>
            </li>
          `).join('')}
        </ul>
        <form onsubmit="tambahDompet(event)">
          <div class="input-group mb-3">
            <input type="text" class="form-control" name="nama_dompet" placeholder="Nama dompet baru" required>
            <button class="btn btn-success" type="submit">Tambah</button>
          </div>
        </form>
      </div>
      <hr>
      <div class="col-md-6">
        <h6>Kategori</h6>
        <ul class="list-group mb-2">
          ${kategoriList.map(k => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <input type="text" value="${k.nama_kategori}" onchange="editKategori(${k.id}, this.value)" class="form-control me-2">
              <button class="btn btn-sm btn-danger" onclick="hapusKategori(${k.id})">Hapus</button>
            </li>
          `).join('')}
        </ul>
        <form id="formTambahKategori" onsubmit="tambahKategori(event)">
          <div class="mb-2">
            <label>Nama Kategori</label>
            <input type="text" class="form-control" name="nama_kategori" required>
          </div>
          <div class="mb-2">
            <label>Jenis Kategori</label>
            <select class="form-select" name="jenis" required>
              <option value="" disabled selected>Pilih Jenis</option>
              <option value="pemasukan">Pemasukan</option>
              <option value="pengeluaran">Pengeluaran</option>
            </select>
          </div>
          <button type="submit" class="btn btn-success w-100">Simpan Kategori</button>
        </form>
        <hr>

      </div>
    </div>
  `;

  document.getElementById("pengaturan-area").innerHTML = html;
}


// ========== fungsi CRUD  ========== //
async function tambahDompet(e) {
  e.preventDefault();
  const nama = e.target.nama_dompet.value.trim();
  if (!nama) return;
  await db.dompet.add({ nama_dompet: nama });
  showPengaturan();
}

async function editDompet(id, namaBaru) {
  await db.dompet.update(id, { nama_dompet: namaBaru });
}

async function hapusDompet(id) {
  const transaksi = await db.transaksi.where('dompet_asal').equals(id).or('dompet_tujuan').equals(id).count();
  if (transaksi > 0) {
    alert("Dompet ini sedang digunakan dalam transaksi, tidak bisa dihapus.");
    return;
  }
  await db.dompet.delete(id);
  showPengaturan();
}

async function tambahKategori(e) {
  e.preventDefault();
  const form = e.target;
  const nama = form.nama_kategori.value.trim();
  const jenis = form.jenis?.value || ""; // jenis dari <select>, fallback ke string kosong jika tidak ada

  if (!nama || !jenis) return;

  // Cek duplikat berdasarkan nama + jenis
  const duplikat = await db.kategori
    .where({ nama_kategori: nama, jenis })
    .count();

  if (duplikat > 0) {
    alert("Kategori dengan nama dan jenis ini sudah ada.");
    return;
  }

  await db.kategori.add({ nama_kategori: nama, jenis });
  form.reset();
  showPengaturan(); // reload tampilan pengaturan setelah tambah kategori
}



async function editKategori(id, namaBaru) {
  await db.kategori.update(id, { nama_kategori: namaBaru });
}

async function hapusKategori(id) {
  const transaksi = await db.transaksi.where('kategori').equals(id).count();
  if (transaksi > 0) {
    alert("Kategori ini sedang digunakan dalam transaksi, tidak bisa dihapus.");
    return;
  }
  await db.kategori.delete(id);
  showPengaturan();
}


// ========== tombol popup  ========== //
async function openPengaturan() {
  await showPengaturan(); // render isi modal dulu
  const modal = new bootstrap.Modal(document.getElementById('modalPengaturan'));
  modal.show();
}
