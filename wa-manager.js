
if (typeof window.uiToast !== 'function') {
  window.uiToast = function(message){
    const el=document.createElement('div');
    el.textContent=message;
    el.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100000;background:#111827;color:#fff;padding:12px 16px;border-radius:12px;max-width:90%;font-size:13px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2800);
  };
}
if (typeof window.uiConfirm !== 'function') {
  window.uiConfirm = function(message){
    return Promise.resolve(true);
  };
}

let unmatchedQueue = [];
let currentFixerItem = null;

// ==========================================
// 1. ENGINE AI LOKAL (PARSER 2 KATA & 3 KATA)
// ==========================================
const LocalAI = {
  DEFAULT_ALIAS_2_WORDS: 'stk',

  analyzeLine(line, itemsMap) {
    const parts = line.trim().replace(/\s+/g, ' ').split(' ');

    let customer = '';
    let alias = '';
    let qty = 0;

    // PATTERN 1: 2 KATA (Contoh: "bud 4" -> Cust: bud, Qty: 4, Barang: stk)
    if (parts.length === 2) {
      customer = parts[0];
      alias = this.DEFAULT_ALIAS_2_WORDS;
      qty = parseFloat(parts[1]);

      if (isNaN(qty)) {
        return {
          status: 'ERROR',
          reason: 'INVALID_QTY',
          suggestion: `Format 2 kata terdeteksi ("${customer}"), tapi jumlah "${parts[1]}" bukan angka.`
        };
      }
    } 
    // PATTERN 2: 3 KATA ATAU LEBIH (Contoh: "cak ckl 3")
    else if (parts.length >= 3) {
      customer = parts[0];
      alias = parts[1].toLowerCase();
      qty = parseFloat(parts[2]);

      if (isNaN(qty)) {
        return {
          status: 'ERROR',
          reason: 'INVALID_QTY',
          suggestion: `Jumlah "${parts[2]}" pada customer "${customer}" bukan angka yang valid.`
        };
      }
    } else {
      return {
        status: 'ERROR',
        reason: 'TOO_SHORT',
        suggestion: 'Input terlalu pendek. Minimal 2 kata (contoh: "bud 4") atau 3 kata (contoh: "cak ckl 3").'
      };
    }

    if (!itemsMap[alias]) {
      return {
        status: 'ERROR',
        reason: 'UNKNOWN_ALIAS',
        suggestion: `Kode barang "${alias}" tidak ditemukan di Kamus.`
      };
    }

    return {
      status: 'OK',
      data: { customer, alias, qty }
    };
  },

  cleanInput(rawText) {
    return rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
};

// ==========================================
// 2. PEMROSESAN PENGERJAAN
// ==========================================
async function processInputWA() {
  if (!db) {
    uiToast("Database belum siap!");
    return;
  }

  const inputEl = document.getElementById('inputText');
  const selectEl = document.getElementById('input-karyawan-select');
  const rawInput = inputEl ? inputEl.value : '';
  const selectedEmp = selectEl ? selectEl.value : '';

  if (!selectedEmp) {
    uiToast("Pilih Karyawan terlebih dahulu!");
    return;
  }

  if (!rawInput.trim()) {
    uiToast("Masukkan teks pengerjaan!");
    return;
  }

  const itemsMap = await getItemsMap();
  const rulesMap = await getCommRulesMap();
  const todayStr = new Date().toLocaleDateString('id-ID');

  const cleanedLines = LocalAI.cleanInput(rawInput);
  unmatchedQueue = [];
  const validOrders = [];

  for (let line of cleanedLines) {
    const result = LocalAI.analyzeLine(line, itemsMap);

    if (result.status === 'OK') {
      const { customer, alias, qty } = result.data;
      const item = itemsMap[alias];
      const ruleKey = `${selectedEmp}_${alias}`;
      const rule = rulesMap[ruleKey] || { minQuota: 0, tier1Limit: 9999, tier1Rate: 0, tier2Rate: 0 };

      const existingOrders = await getTodayOrders(todayStr);
      const currentEmpQty = existingOrders
        .filter(o => o.karyawan === selectedEmp && o.itemAlias === alias)
        .reduce((sum, o) => sum + o.qty, 0);

      const komisi = calculateTieredCommission(
        rule.minQuota,
        rule.tier1Limit,
        rule.tier1Rate,
        rule.tier2Rate,
        currentEmpQty,
        qty
      );

      validOrders.push({
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        tanggal: todayStr,
        karyawan: selectedEmp,
        customer: customer,
        itemAlias: alias,
        jenis: item.name,
        qty: qty,
        unit: item.unit,
        price: item.price || 0,
        totalOmset: qty * (item.price || 0),
        totalKomisi: komisi
      });
    } else {
      const parts = line.split(' ');
      unmatchedQueue.push({
        line: line,
        customer: parts[0] || 'Umum',
        empName: selectedEmp,
        itemAlias: parts[1] ? parts[1].toLowerCase() : 'stk',
        amount: !isNaN(parseFloat(parts[parts.length - 1])) ? parseFloat(parts[parts.length - 1]) : 1,
        aiReason: result.suggestion
      });
    }
  }

  if (validOrders.length > 0) {
    const tx = db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    validOrders.forEach(order => store.add(order));

    tx.oncomplete = () => {
      if (inputEl) inputEl.value = '';
      renderAll();

      if (unmatchedQueue.length > 0) {
        triggerNextFixer();
      } else {
        uiToast(`Data (${validOrders.length} item) berhasil disimpan!`);
      }
    };
  } else if (unmatchedQueue.length > 0) {
    triggerNextFixer();
  }
}

// ==========================================
// 3. FIXER MODAL
// ==========================================
function triggerNextFixer() {
  if (unmatchedQueue.length === 0) {
    const modal = document.getElementById('fixerModal');
    if (modal) modal.style.display = 'none';
    uiToast('Semua data berhasil disesuaikan!');
    renderAll();
    return;
  }

  currentFixerItem = unmatchedQueue.shift();

  const labelEmp = document.getElementById('fixerEmpLabel');
  const rawTextEl = document.getElementById('fixerRawText');
  const qtyEl = document.getElementById('fixerQty');

  if (labelEmp) labelEmp.innerText = `${currentFixerItem.empName.toUpperCase()} (Cust: ${currentFixerItem.customer})`;
  if (rawTextEl) rawTextEl.innerText = `${currentFixerItem.line}\n⚠️ AI Info: ${currentFixerItem.aiReason}`;
  if (qtyEl) qtyEl.value = currentFixerItem.amount;

  const txI = db.transaction('items', 'readonly');
  txI.objectStore('items').getAll().onsuccess = (e) => {
    const selI = document.getElementById('fixerItem');
    if (selI) {
      selI.innerHTML = e.target.result.map(i => `<option value="${i.alias}">${i.name} (${i.unit})</option>`).join('');
    }
  };

  const modal = document.getElementById('fixerModal');
  if (modal) modal.style.display = 'flex';
}

async function saveFixerItem() {
  const itemAlias = document.getElementById('fixerItem').value;
  const qty = parseFloat(document.getElementById('fixerQty').value);
  const todayStr = new Date().toLocaleDateString('id-ID');

  const itemsMap = await getItemsMap();
  const rulesMap = await getCommRulesMap();
  const existingOrders = await getTodayOrders(todayStr);

  const item = itemsMap[itemAlias];
  const ruleKey = `${currentFixerItem.empName}_${itemAlias}`;
  const rule = rulesMap[ruleKey] || { minQuota: 0, tier1Limit: 9999, tier1Rate: 0, tier2Rate: 0 };

  const currentEmpQty = existingOrders
    .filter(o => o.karyawan === currentFixerItem.empName && o.itemAlias === itemAlias)
    .reduce((sum, o) => sum + o.qty, 0);

  const komisi = calculateTieredCommission(rule.minQuota, rule.tier1Limit, rule.tier1Rate, rule.tier2Rate, currentEmpQty, qty);

  const tx = db.transaction('orders', 'readwrite');
  tx.objectStore('orders').add({
    waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    tanggal: todayStr,
    karyawan: currentFixerItem.empName,
    customer: currentFixerItem.customer,
    itemAlias: itemAlias,
    jenis: item.name,
    qty: qty,
    unit: item.unit,
    price: item.price || 0,
    totalOmset: qty * (item.price || 0),
    totalKomisi: komisi
  });

  tx.oncomplete = () => triggerNextFixer();
}

function skipFixerItem() {
  triggerNextFixer();
}

// ==========================================
// 4. BUKTI HARIAN & BACKUP DROPDOWN
// ==========================================
function generateEmployeeDailyReport() {
  const empSelect = document.getElementById('rekap-karyawan-select');
  if (!empSelect || !db) return;

  const empName = empSelect.value;
  if (!empName) return;

  const tx = db.transaction('orders', 'readonly');
  tx.objectStore('orders').getAll().onsuccess = (e) => {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const empOrders = e.target.result.filter(o => o.karyawan === empName && o.tanggal === todayStr);

    if (empOrders.length === 0) {
      document.getElementById('employeeReportText').value = `Belum ada pengerjaan harian (${todayStr}) untuk ${empName.toUpperCase()}.`;
      return;
    }

    let report = `*BUKTI PENGERJAAN HARIAN*\n`;
    report += `Petugas: ${empName.toUpperCase()}\n`;
    report += `Tgl: ${todayStr}\n`;
    report += `----------------------------\n`;

    let totalKomisiHarian = 0;
    let totalQtyMap = {};

    empOrders.forEach((o, i) => {
      totalKomisiHarian += (o.totalKomisi || 0);
      if (!totalQtyMap[o.jenis]) totalQtyMap[o.jenis] = { qty: 0, unit: o.unit };
      totalQtyMap[o.jenis].qty += o.qty;

      const custLabel = o.customer ? `[${o.customer}] ` : '';
      report += `${i + 1}. ${custLabel}${o.jenis}: ${o.qty} ${o.unit}`;
      if (typeof isCommissionActive !== 'undefined' && isCommissionActive) {
        report += ` | Komisi: Rp ${(o.totalKomisi || 0).toLocaleString()}`;
      }
      report += `\n`;
    });

    report += `----------------------------\n`;
    report += `*TOTAL VOLUME PENGERJAAN:*\n`;
    for (let j in totalQtyMap) {
      report += `- ${j}: ${totalQtyMap[j].qty} ${totalQtyMap[j].unit}\n`;
    }

    if (typeof isCommissionActive !== 'undefined' && isCommissionActive) {
      report += `----------------------------\n`;
      report += `*TOTAL KOMISI: Rp ${totalKomisiHarian.toLocaleString()}*`;
    }

    document.getElementById('employeeReportText').value = report;
  };
}

function sendReportWA(type, mode) {
  const text = document.getElementById('employeeReportText').value;

  if (mode === 'text') {
    if (!text.trim()) {
      uiToast("Pilih karyawan/isi teks terlebih dahulu!");
      return;
    }
    const url = type === 'business'
      ? `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  } else if (mode === 'image') {
    generateReportPNG();
    setTimeout(() => {
      uiToast("Gambar Nota PNG berhasil di-download! Silakan lampirkan gambar tersebut di chat WhatsApp.");
      const url = type === 'business' ? `https://api.whatsapp.com/send` : `https://wa.me/`;
      window.open(url, '_blank');
    }, 600);
  }
}

// BACKUP EXPORT & IMPORT
function executeExportBackup() {
  const type = document.getElementById('backupTypeSelect').value;
  if (type === 'svg') exportBackupSVG();
  else exportBackupJSON();
}

function exportBackupJSON() {
  const tx = db.transaction(['orders', 'karyawan', 'items', 'comm_rules'], 'readonly');
  const backupData = {};

  tx.objectStore('orders').getAll().onsuccess = (e) => backupData.orders = e.target.result;
  tx.objectStore('karyawan').getAll().onsuccess = (e) => backupData.karyawan = e.target.result;
  tx.objectStore('items').getAll().onsuccess = (e) => backupData.items = e.target.result;
  tx.objectStore('comm_rules').getAll().onsuccess = (e) => backupData.comm_rules = e.target.result;

  tx.oncomplete = () => {
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Backup_PWA_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
}

function exportBackupSVG() {
  const tx = db.transaction(['orders', 'karyawan', 'items', 'comm_rules'], 'readonly');
  const backupData = {};

  tx.objectStore('orders').getAll().onsuccess = (e) => backupData.orders = e.target.result;
  tx.objectStore('karyawan').getAll().onsuccess = (e) => backupData.karyawan = e.target.result;
  tx.objectStore('items').getAll().onsuccess = (e) => backupData.items = e.target.result;
  tx.objectStore('comm_rules').getAll().onsuccess = (e) => backupData.comm_rules = e.target.result;

  tx.oncomplete = () => {
    const jsonString = JSON.stringify(backupData);
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">
      <rect width="100%" height="100%" fill="#2563eb"/>
      <text x="20" y="50" fill="white" font-family="sans-serif" font-size="16">PWA DATA BACKUP CONTAINER</text>
      <script type="text/plain" id="pwa-db-data">${jsonString}</script>
    </svg>`;

    const dataStr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent);
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Backup_PWA_${new Date().toISOString().slice(0, 10)}.svg`;
    a.click();
  };
}

function importBackupFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      let importedData = null;
      const content = e.target.result;

      if (file.name.endsWith('.svg') || content.includes('<svg')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "image/svg+xml");
        const scriptEl = doc.getElementById('pwa-db-data');
        if (scriptEl) importedData = JSON.parse(scriptEl.textContent);
        else throw new Error("File SVG tidak valid!");
      } else {
        importedData = JSON.parse(content);
      }

      if (importedData && await uiConfirm("Restore data sekarang? Data lama akan ditimpa.", "Restore Backup")) {
        const tx = db.transaction(['orders', 'karyawan', 'items', 'comm_rules'], 'readwrite');

        if (importedData.orders) { const os = tx.objectStore('orders'); os.clear(); importedData.orders.forEach(i => os.add(i)); }
        if (importedData.karyawan) { const os = tx.objectStore('karyawan'); os.clear(); importedData.karyawan.forEach(i => os.add(i)); }
        if (importedData.items) { const os = tx.objectStore('items'); os.clear(); importedData.items.forEach(i => os.add(i)); }
        if (importedData.comm_rules) { const os = tx.objectStore('comm_rules'); os.clear(); importedData.comm_rules.forEach(i => os.add(i)); }

        tx.oncomplete = () => {
          uiToast("Data berhasil dipulihkan!");
          renderAll();
        };
      }
    } catch (err) {
      uiToast("File backup tidak valid!");
    }
  };
  reader.readAsText(file);
}