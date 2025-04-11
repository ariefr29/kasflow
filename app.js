// ======================= //
//        UTILITAS        //
// ======================= //

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(angka);
}

async function getDropdownOptions(jenisTransaksi) {
  const dompetList = await db.dompet.toArray();
  const kategoriList = await db.kategori.where("jenis").equals(jenisTransaksi).toArray();

  return {
    dompetOptions: dompetList.map(d => `<option value="${d.nama_dompet}">${d.nama_dompet}</option>`).join(""),
    kategoriOptions: kategoriList.map(k => `<option value="${k.nama_kategori}">${k.nama_kategori}</option>`).join(""),
  };
}


// ========================== //
//     FORM TRANSAKSI        //
// ========================== //

async function showForm(jenis) {
  const { dompetOptions } = await getDropdownOptions(jenis);

  let html = `
    <form id="form-transaksi" onsubmit="saveTransaksi(event, '${jenis}')">
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

  if (jenis !== "transfer") {
    const kategoriList = await db.kategori.where("jenis").equals(jenis).toArray();
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

async function saveTransaksi(e, jenis) {
  e.preventDefault();
  const form = e.target;

  const data = {
    jenis,
    nominal: parseFloat(form.nominal.value),
    tanggal: form.tanggal.value,
    kategori: form.kategori?.value || null,
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


// ========================= //
//     RINGKASAN SALDO      //
// ========================= //

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
    totalSemua += saldo[dompet];
    html += `<li class="list-group-item d-flex justify-content-between">
      <span>${dompet}</span><strong>${formatRupiah(saldo[dompet])}</strong>
    </li>`;
  }
  html += `</ul><div class='alert alert-success mt-3'>Total Saldo Keseluruhan: <strong>${formatRupiah(totalSemua)}</strong></div>`;

  document.getElementById("summary").innerHTML = html;
}


// ============================ //
//     RIWAYAT TRANSAKSI       //
// ============================ //

async function loadTransaksi() {
  await isiFilterDropdown();

  const tanggal = document.getElementById("filter-tanggal").value;
  const jenis = document.getElementById("filter-jenis").value;
  const dompet = document.getElementById("filter-dompet").value;
  const kategori = document.getElementById("filter-kategori").value;

  const transaksi = await db.transaksi.orderBy("tanggal").reverse().toArray();

  // Filter yang sudah diperbaiki
  const filtered = transaksi.filter(t => {
    // Filter tanggal
    if (tanggal && t.tanggal !== tanggal) return false;
    
    // Filter jenis transaksi
    if (jenis && t.jenis !== jenis) return false;
    
    // Filter dompet - periksa baik dompet_asal maupun dompet_tujuan
    if (dompet && t.dompet_asal !== dompet && t.dompet_tujuan !== dompet) return false;
    
    // Filter kategori
    if (kategori && t.kategori !== kategori) return false;
    
    return true;
  });

  let html = "<ul class='list-group'>";
  filtered.forEach(t => {
    const warna = t.jenis === 'pemasukan' ? 'text-success' : t.jenis === 'pengeluaran' ? 'text-danger' : 'text-warning';
    html += `
      <li class="list-group-item d-flex justify-content-between">
        <div>
          <small>${t.tanggal}</small><br>
          <strong>${t.jenis.toUpperCase()}</strong>${t.kategori ? ' - ' + t.kategori : ''}<br>
          <small>${t.catatan}</small>
          ${t.jenis === 'transfer' ? `<br><small>Dari: ${t.dompet_asal} → Ke: ${t.dompet_tujuan}</small>` : 
            t.jenis === 'pemasukan' ? `<br><small>Ke: ${t.dompet_tujuan}</small>` : 
            `<br><small>Dari: ${t.dompet_asal}</small>`}
        </div>
        <div class="text-end">
          <div>
            <button class="btn btn-sm btn-outline-secondary me-1" onclick="editTransaksi(${t.id})">Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="hapusTransaksi(${t.id})">Hapus</button>
          </div>
          <div class="${warna}">${formatRupiah(t.nominal)}</div>
        </div>
      </li>
    `;
  });
  html += "</ul>";

  document.getElementById("transaction-list").innerHTML = html;
}


// ======================== //
//      BACKUP & IMPORT     //
// ======================== //

async function backupData() {
  const transaksi = await db.transaksi.toArray();
  const dompet = await db.dompet.toArray();
  const kategori = await db.kategori.toArray();
  
  const data = {
    transaksi,
    dompet,
    kategori
  };
  
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "backup-keuangan.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      
      // Hapus data yang ada terlebih dahulu
      await db.transaksi.clear();
      if (json.dompet) await db.dompet.clear();
      if (json.kategori) await db.kategori.clear();
      
      // Import data baru
      await db.transaksi.bulkAdd(json.transaksi);
      if (json.dompet) await db.dompet.bulkAdd(json.dompet);
      if (json.kategori) await db.kategori.bulkAdd(json.kategori);
      
      alert("Import selesai!");
      loadSummary();
      loadTransaksi();
    } catch (error) {
      alert("Error saat import data: " + error.message);
    }
  };
  reader.readAsText(file);
}


// ===================== //
//     PENGATURAN UI     //
// ===================== //

async function showPengaturan() {
  const dompetList = await db.dompet.toArray();
  const kategoriList = await db.kategori.toArray();

  const html = `
    <div class="row">
      <div class="col-12">
        <h6>Dompet</h6>
        <ul class="list-group mb-2">
          ${dompetList.map(d => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <input type="text" value="${d.nama_dompet}" onchange="editDompet(${d.id}, this.value)" class="form-control me-2">
              <button class="btn btn-sm btn-danger" onclick="hapusDompet(${d.id})">Hapus</button>
            </li>
          `).join("")}
        </ul>
        <form onsubmit="tambahDompet(event)">
          <div class="input-group mb-3">
            <input type="text" class="form-control" name="nama_dompet" placeholder="Nama dompet baru" required>
            <button class="btn btn-success" type="submit">Tambah</button>
          </div>
        </form>
      </div>

      <hr>

      <div class="col-12">
        <h6>Kategori</h6>
        <ul class="list-group mb-2">
          ${kategoriList.map(k => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <input type="text" value="${k.nama_kategori}" onchange="editKategori(${k.id}, this.value)" class="form-control me-2">
              <span class="badge ${k.jenis === 'pemasukan' ? 'bg-success' : 'bg-danger'} me-2">${k.jenis}</span>
              <button class="btn btn-sm btn-danger" onclick="hapusKategori(${k.id})">Hapus</button>
            </li>
          `).join("")}
        </ul>
        <form onsubmit="tambahKategori(event)">
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
      </div>
    </div>
  `;

  document.getElementById("pengaturan-area").innerHTML = html;
}

async function openPengaturan() {
  await showPengaturan();
  const modal = new bootstrap.Modal(document.getElementById("modalPengaturan"));
  modal.show();
}


// ===================== //
//       FILTER          //
// ===================== //

async function isiFilterDropdown() {
  const dompet = await db.dompet.toArray();
  const kategori = await db.kategori.toArray();

  const filterDompet = document.getElementById("filter-dompet");
  const filterKategori = document.getElementById("filter-kategori");

  filterDompet.innerHTML = '<option value="">Semua Dompet</option>';
  dompet.forEach(d => {
    filterDompet.innerHTML += `<option value="${d.nama_dompet}">${d.nama_dompet}</option>`;
  });

  filterKategori.innerHTML = '<option value="">Semua Kategori</option>';
  kategori.forEach(k => {
    filterKategori.innerHTML += `<option value="${k.nama_kategori}">${k.nama_kategori}</option>`;
  });
}


// ===================== //
//        CRUD           //
// ===================== //

async function tambahDompet(e) {
  e.preventDefault();
  const nama = e.target.nama_dompet.value.trim();
  if (!nama) return;
  await db.dompet.add({ nama_dompet: nama });
  showPengaturan();
  loadSummary();
  loadTransaksi();
}

async function editDompet(id, namaBaru) {
  const dompet = await db.dompet.get(id);
  const namaDompetLama = dompet.nama_dompet;
  
  // Update nama dompet
  await db.dompet.update(id, { nama_dompet: namaBaru });
  
  // Update semua transaksi terkait
  const transaksiAsal = await db.transaksi.where("dompet_asal").equals(namaDompetLama).toArray();
  for (const t of transaksiAsal) {
    await db.transaksi.update(t.id, { dompet_asal: namaBaru });
  }
  
  const transaksiTujuan = await db.transaksi.where("dompet_tujuan").equals(namaDompetLama).toArray();
  for (const t of transaksiTujuan) {
    await db.transaksi.update(t.id, { dompet_tujuan: namaBaru });
  }
  
  loadSummary();
  loadTransaksi();
}

async function hapusDompet(id) {
  const dompet = await db.dompet.get(id);
  const namaDompet = dompet.nama_dompet;
  
  // Periksa apakah dompet masih digunakan dalam transaksi
  const transaksiAsal = await db.transaksi.where("dompet_asal").equals(namaDompet).count();
  const transaksiTujuan = await db.transaksi.where("dompet_tujuan").equals(namaDompet).count();
  
  if (transaksiAsal > 0 || transaksiTujuan > 0) {
    alert("Dompet ini sedang digunakan dalam transaksi, tidak bisa dihapus.");
    return;
  }
  
  await db.dompet.delete(id);
  showPengaturan();
  loadSummary();
  loadTransaksi();
}

async function tambahKategori(e) {
  e.preventDefault();
  const form = e.target;
  const nama = form.nama_kategori.value.trim();
  const jenis = form.jenis.value;

  if (!nama || !jenis) return;

  const duplikat = await db.kategori.where({ nama_kategori: nama, jenis }).count();
  if (duplikat > 0) {
    alert("Kategori dengan nama dan jenis ini sudah ada.");
    return;
  }

  await db.kategori.add({ nama_kategori: nama, jenis });
  form.reset();
  showPengaturan();
  loadTransaksi();
}

async function editKategori(id, namaBaru) {
  const kategori = await db.kategori.get(id);
  const namaKategoriLama = kategori.nama_kategori;
  
  // Update nama kategori
  await db.kategori.update(id, { nama_kategori: namaBaru });
  
  // Update semua transaksi terkait
  const transaksi = await db.transaksi.where("kategori").equals(namaKategoriLama).toArray();
  for (const t of transaksi) {
    await db.transaksi.update(t.id, { kategori: namaBaru });
  }
  
  loadTransaksi();
}

async function hapusKategori(id) {
  const kategori = await db.kategori.get(id);
  const namaKategori = kategori.nama_kategori;
  
  // Periksa apakah kategori masih digunakan dalam transaksi
  const transaksi = await db.transaksi.where("kategori").equals(namaKategori).count();
  
  if (transaksi > 0) {
    alert("Kategori ini sedang digunakan dalam transaksi, tidak bisa dihapus.");
    return;
  }
  
  await db.kategori.delete(id);
  showPengaturan();
  loadTransaksi();
}

async function hapusTransaksi(id) {
  if (!confirm("Yakin ingin menghapus transaksi ini?")) return;
  await db.transaksi.delete(id);
  loadSummary();
  loadTransaksi();
}

async function editTransaksi(id) {
  const data = await db.transaksi.get(id);
  if (!data) return;

  await showForm(data.jenis); // Tunggu form tampil dengan dropdown terisi

  const form = document.querySelector("#form-transaksi");
  form.nominal.value = data.nominal;
  form.tanggal.value = data.tanggal;
  if (form.kategori) form.kategori.value = data.kategori;
  form.catatan.value = data.catatan;

  if (data.jenis === "transfer") {
    form.dompet_asal.value = data.dompet_asal;
    form.dompet_tujuan.value = data.dompet_tujuan;
  } else if (data.jenis === "pemasukan") {
    form.dompet_tujuan.value = data.dompet_tujuan;
  } else {
    form.dompet_asal.value = data.dompet_asal;
  }

  // Ubah onsubmit handler agar dapat menyimpan transaksi yang diedit
  const originalSubmit = form.onsubmit;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const updated = {
      ...data,
      nominal: parseFloat(form.nominal.value),
      tanggal: form.tanggal.value,
      kategori: form.kategori?.value || null,
      catatan: form.catatan.value || "-",
      dompet_asal: form.dompet_asal?.value || null,
      dompet_tujuan: form.dompet_tujuan?.value || null,
    };
    await db.transaksi.put(updated);
    form.reset();
    document.getElementById("form-area").innerHTML = "";
    loadSummary();
    loadTransaksi();
  };
}



// ===================== //
//     INISIALISASI      //
// ===================== //

window.addEventListener("load", () => {
  loadSummary();
  loadTransaksi();

  ["filter-tanggal", "filter-jenis", "filter-dompet", "filter-kategori"].forEach(id => {
    document.getElementById(id).addEventListener("change", loadTransaksi);
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
});