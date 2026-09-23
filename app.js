
/* =========================================================
   MODERN UI DIALOGS — NO window.alert / confirm / prompt
   ========================================================= */
(function(){
  function ensureDialogHost(){
    let host=document.getElementById('modern-dialog-host');
    if(host) return host;
    host=document.createElement('div');
    host.id='modern-dialog-host';
    host.innerHTML=`
      <div id="modern-dialog-backdrop" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px">
        <div id="modern-dialog-box" style="width:min(100%,400px);background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.4);padding:20px">
          <div id="modern-dialog-title" style="font-weight:800;font-size:17px;margin-bottom:8px"></div>
          <div id="modern-dialog-message" style="font-size:14px;line-height:1.5;color:#cbd5e1;white-space:pre-wrap"></div>
          <div id="modern-dialog-actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"></div>
        </div>
      </div>
      <div id="modern-toast" style="display:none;position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:100000;width:min(calc(100% - 28px),420px);background:#111827;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:12px 15px;box-shadow:0 15px 40px rgba(0,0,0,.35);font-size:13px"></div>`;
    document.body.appendChild(host);
    return host;
  }
  window.uiToast=function(message){
    ensureDialogHost();
    const el=document.getElementById('modern-toast');
    el.textContent=message;
    el.style.display='block';
    clearTimeout(window.__toastTimer);
    window.__toastTimer=setTimeout(()=>el.style.display='none',2800);
  };
  window.uiConfirm=function(message,title='Konfirmasi'){
    ensureDialogHost();
    return new Promise(resolve=>{
      const back=document.getElementById('modern-dialog-backdrop');
      document.getElementById('modern-dialog-title').textContent=title;
      document.getElementById('modern-dialog-message').textContent=message;
      const actions=document.getElementById('modern-dialog-actions');
      actions.innerHTML='';
      const cancel=document.createElement('button');
      cancel.textContent='Batal';
      const ok=document.createElement('button');
      ok.textContent='Lanjutkan';
      [cancel,ok].forEach(b=>{b.type='button';b.style.cssText='border:0;border-radius:11px;padding:10px 16px;font-weight:700;cursor:pointer'});
      cancel.style.background='#334155'; cancel.style.color='#fff';
      ok.style.background='#2563eb'; ok.style.color='#fff';
      const close=v=>{back.style.display='none';resolve(v)};
      cancel.onclick=()=>close(false); ok.onclick=()=>close(true);
      actions.append(cancel,ok);
      back.style.display='flex';
    });
  };
})();

let isCommissionActive = true;

window.addEventListener('DOMContentLoaded', () => {
  initClock();
  loadSavedLogo();
});

function initClock() {
  setInterval(() => {
    const now = new Date();
    const dateEl = document.getElementById('real-date');
    const timeEl = document.getElementById('real-time');
    if (dateEl) dateEl.innerText = now.toLocaleDateString('id-ID');
    if (timeEl) timeEl.innerText = now.toLocaleTimeString('id-ID');
  }, 1000);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(el => el.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');

  const btnIndex = tabId === 'input' ? 0 : tabId === 'rekap' ? 1 : 2;
  const navBtns = document.querySelectorAll('nav button');
  if (navBtns[btnIndex]) navBtns[btnIndex].classList.add('active');
}

function toggleCommissionMode() {
  const toggle = document.getElementById('commissionToggle');
  const label = document.getElementById('commission-status-label');
  isCommissionActive = toggle ? toggle.checked : true;

  if (label) {
    label.innerText = isCommissionActive ? "AKTIF" : "NONAKTIF";
    label.style.color = isCommissionActive ? "var(--success)" : "var(--danger)";
  }

  document.querySelectorAll('.com-col').forEach(el => {
    el.style.display = isCommissionActive ? '' : 'none';
  });

  // Jangan panggil renderAll() dari sini.
  // renderAll() -> renderItemsTable()/renderOrdersTable() -> toggleCommissionMode()
  // sebelumnya menyebabkan recursive render tanpa akhir.
}

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64Image = e.target.result;
    localStorage.setItem('app_custom_logo', base64Image);
    applyLogo(base64Image);
    uiToast('Logo berhasil dipasang untuk Header, Favicon, Nota PNG, dan Splash Screen!');
  };
  reader.readAsDataURL(file);
}

function loadSavedLogo() {
  const savedLogo = localStorage.getItem('app_custom_logo');
  if (savedLogo) applyLogo(savedLogo);
}

function applyLogo(logoData) {
  const headerLogo = document.getElementById('appHeaderLogo');
  if (headerLogo) {
    headerLogo.src = logoData;
    headerLogo.style.display = 'block';
  }

  let favicon = document.querySelector("link[rel*='icon']");
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'shortcut icon';
    document.getElementsByTagName('head')[0].appendChild(favicon);
  }
  favicon.href = logoData;

  let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
  if (!appleIcon) {
    appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    document.getElementsByTagName('head')[0].appendChild(appleIcon);
  }
  appleIcon.href = logoData;
}

// Render Seluruh Tampilan UI
function renderAll() {
  if (!db) return;
  renderKaryawanOptions();
  renderKaryawanList();
  renderItemsTable();
  renderCommissionRulesTable();
  renderOrdersTable();
  generateEmployeeDailyReport();
}

function renderKaryawanOptions() {
  const tx = db.transaction('karyawan', 'readonly');
  tx.objectStore('karyawan').getAll().onsuccess = (e) => {
    const list = e.target.result;
    const opts = list.map(k => `<option value="${k.nama}">${k.nama}</option>`).join('');
    
    const selInput = document.getElementById('input-karyawan-select');
    const selRekap = document.getElementById('rekap-karyawan-select');
    const selRule = document.getElementById('ruleKaryawanSelect');

    if (selInput) selInput.innerHTML = opts;
    if (selRekap) selRekap.innerHTML = opts;
    if (selRule) selRule.innerHTML = opts;
  };
}

function renderKaryawanList() {
  const tx = db.transaction('karyawan', 'readonly');
  tx.objectStore('karyawan').getAll().onsuccess = (e) => {
    const container = document.getElementById('karyawanListContainer');
    if (container) {
      container.innerHTML = e.target.result.map(k => `
        <div style="display:flex; justify:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #ddd;">
          <span><b>${k.nama}</b></span>
          <button class="btn btn-danger" style="padding:2px 6px; font-size:0.7em;" onclick="deleteKaryawan(${k.id})">Hapus</button>
        </div>
      `).join('');
    }
  };
}

function addKaryawan() {
  const input = document.getElementById('newKaryawanInput');
  const nama = input ? input.value.trim() : '';
  if (!nama) return;

  const tx = db.transaction('karyawan', 'readwrite');
  tx.objectStore('karyawan').add({ nama: nama });
  tx.oncomplete = () => {
    input.value = '';
    renderAll();
  };
}

async function deleteKaryawan(id) {
  if (!(await uiConfirm("Hapus karyawan ini?"))) return;
  const tx = db.transaction('karyawan', 'readwrite');
  tx.objectStore('karyawan').delete(id);
  tx.oncomplete = () => renderAll();
}

function renderItemsTable() {
  const tx = db.transaction('items', 'readonly');
  tx.objectStore('items').getAll().onsuccess = (e) => {
    const items = e.target.result;
    const tbody = document.getElementById('itemsTable');
    if (tbody) {
      tbody.innerHTML = items.map(i => `
        <tr>
          <td><b>${i.alias}</b></td>
          <td>${i.name}</td>
          <td>${i.unit}</td>
          <td class="com-col">Rp ${(i.price || 0).toLocaleString()}</td>
          <td><button class="btn btn-danger" style="padding:2px 4px; font-size:0.7em;" onclick="deleteItem('${i.alias}')">Hapus</button></td>
        </tr>
      `).join('');
    }

    const selRuleItem = document.getElementById('ruleItemSelect');
    if (selRuleItem) {
      selRuleItem.innerHTML = items.map(i => `<option value="${i.alias}">${i.name} (${i.alias})</option>`).join('');
    }
    toggleCommissionMode();
  };
}

function addItem() {
  const alias = document.getElementById('itemAlias').value.trim().toLowerCase();
  const name = document.getElementById('itemName').value.trim();
  const unit = document.getElementById('itemUnit').value;
  const price = parseFloat(document.getElementById('itemPrice').value) || 0;

  if (!alias || !name) {
    uiToast("Isi Kode WA dan Nama Pekerjaan!");
    return;
  }

  const tx = db.transaction('items', 'readwrite');
  tx.objectStore('items').put({ alias, name, unit, price });
  tx.oncomplete = () => {
    document.getElementById('itemAlias').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemPrice').value = '';
    renderAll();
  };
}

async function deleteItem(alias) {
  if (!(await uiConfirm(`Hapus barang dengan kode "${alias}"?`))) return;
  const tx = db.transaction('items', 'readwrite');
  tx.objectStore('items').delete(alias);
  tx.oncomplete = () => renderAll();
}

function renderCommissionRulesTable() {
  const tx = db.transaction('comm_rules', 'readonly');
  tx.objectStore('comm_rules').getAll().onsuccess = (e) => {
    const rules = e.target.result;
    const tbody = document.getElementById('commissionRulesTable');
    if (tbody) {
      tbody.innerHTML = rules.map(r => `
        <tr>
          <td><b>${r.karyawan}</b></td>
          <td>${r.itemAlias}</td>
          <td>${r.minQuota}</td>
          <td>&le;${r.tier1Limit}: Rp ${(r.tier1Rate || 0).toLocaleString()}</td>
          <td>>${r.tier1Limit}: Rp ${(r.tier2Rate || 0).toLocaleString()}</td>
          <td><button class="btn btn-danger" style="padding:2px 4px; font-size:0.7em;" onclick="deleteCommissionRule('${r.key}')">Hapus</button></td>
        </tr>
      `).join('');
    }
  };
}

function addCommissionRule() {
  const karyawan = document.getElementById('ruleKaryawanSelect').value;
  const itemAlias = document.getElementById('ruleItemSelect').value;
  const minQuota = parseFloat(document.getElementById('ruleMinQuota').value) || 0;
  const tier1Limit = parseFloat(document.getElementById('ruleTier1Limit').value) || 9999;
  const tier1Rate = parseFloat(document.getElementById('ruleTier1Rate').value) || 0;
  const tier2Rate = parseFloat(document.getElementById('ruleTier2Rate').value) || 0;

  const key = `${karyawan}_${itemAlias}`;

  const tx = db.transaction('comm_rules', 'readwrite');
  tx.objectStore('comm_rules').put({ key, karyawan, itemAlias, minQuota, tier1Limit, tier1Rate, tier2Rate });
  tx.oncomplete = () => {
    document.getElementById('ruleMinQuota').value = '';
    document.getElementById('ruleTier1Limit').value = '';
    document.getElementById('ruleTier1Rate').value = '';
    document.getElementById('ruleTier2Rate').value = '';
    renderAll();
  };
}

function deleteCommissionRule(key) {
  const tx = db.transaction('comm_rules', 'readwrite');
  tx.objectStore('comm_rules').delete(key);
  tx.oncomplete = () => renderAll();
}

function renderOrdersTable() {
  const todayStr = new Date().toLocaleDateString('id-ID');
  const tx = db.transaction('orders', 'readonly');
  tx.objectStore('orders').getAll().onsuccess = (e) => {
    const orders = e.target.result.filter(o => o.tanggal === todayStr);
    const tbody = document.getElementById('dataTable');
    if (tbody) {
      tbody.innerHTML = orders.map(o => {
        const custText = o.customer ? `[${o.customer}] ` : '';
        return `
          <tr>
            <td><small>${o.waktu}</small></td>
            <td><b>${o.karyawan}</b></td>
            <td>${custText}${o.jenis}</td>
            <td>${o.qty} ${o.unit}</td>
            <td class="com-col">Rp ${(o.totalOmset || 0).toLocaleString()}</td>
            <td class="com-col">Rp ${(o.totalKomisi || 0).toLocaleString()}</td>
            <td><button class="btn btn-danger" style="padding:2px 4px; font-size:0.7em;" onclick="deleteOrder(${o.id})">X</button></td>
          </tr>
        `;
      }).join('');
    }
    toggleCommissionMode();
  };
}

function deleteOrder(id) {
  const tx = db.transaction('orders', 'readwrite');
  tx.objectStore('orders').delete(id);
  tx.oncomplete = () => renderAll();
}

async function clearAllOrders() {
  if (!(await uiConfirm("Hapus seluruh data pengerjaan hari ini?"))) return;
  const tx = db.transaction('orders', 'readwrite');
  tx.objectStore('orders').clear();
  tx.oncomplete = () => renderAll();
}