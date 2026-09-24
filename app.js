
/* === PARSER RULE: ALIAS / NAMA PEKERJAAN BUKAN CUSTOMER === */
function isWorkAliasOrName(token) {
    const t = String(token || '').trim().toLowerCase();
    if (!t) return false;
    try {
        const items = (typeof getItems === 'function') ? getItems() : [];
        for (const item of (items || [])) {
            const name = String(item?.name || item?.nama || '').trim().toLowerCase();
            const aliases = String(item?.aliases || item?.alias || '')
                .split(',')
                .map(x => x.trim().toLowerCase())
                .filter(Boolean);
            if (t === name || aliases.includes(t)) return true;
        }
    } catch (_) {}
    return [
        'stk','setrika','cks','ckl','cb','sepatu','selimut',
        'bc','bedcover','bed cover','gorden','boneka','bnk',
        'seprai','sprai','spt','spatu'
    ].includes(t);
}


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
  applyLogo(savedLogo || 'laundryicon.png');
}

function applyLogo(logoData) {
  const src = logoData || 'laundryicon.png';
  const headerLogo = document.getElementById('appHeaderLogo');
  if (headerLogo) {
    headerLogo.src = src;
    headerLogo.style.display = 'block';
  }

  document.querySelectorAll("link[rel*='icon'], link[rel='apple-touch-icon']").forEach(el => {
    el.href = src;
  });
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
        const custText = o.customer ? `[${escapeHtml(o.customer)}] ` : '';
        return `
          <tr>
            <td><small>${escapeHtml(o.waktu || '')}</small></td>
            <td><b>${escapeHtml(o.karyawan || '')}</b></td>
            <td>${custText}${escapeHtml(o.jenis || '')}</td>
            <td>${o.qty} ${escapeHtml(o.unit || '')}</td>
            <td class="com-col">Rp ${(o.totalOmset || 0).toLocaleString()}</td>
            <td class="com-col">Rp ${(o.totalKomisi || 0).toLocaleString()}</td>
            <td>
              <div class="report-actions">
                <button class="report-action-btn edit" onclick="editOrder(${o.id})" title="Edit" aria-label="Edit">✏️</button>
                <button class="report-action-btn delete" onclick="deleteOrder(${o.id})" title="Hapus" aria-label="Hapus">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
    toggleCommissionMode();
  };
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}

async function editOrder(id) {
  const tx = db.transaction(['orders','karyawan','items'], 'readonly');
  const orderReq = tx.objectStore('orders').get(id);
  const empReq = tx.objectStore('karyawan').getAll();
  const itemReq = tx.objectStore('items').getAll();

  orderReq.onsuccess = () => {
    const o = orderReq.result;
    if (!o) return uiToast('Data pengerjaan tidak ditemukan.');
    empReq.onsuccess = () => {
      itemReq.onsuccess = () => {
        const empSel=document.getElementById('editOrderEmployee');
        const itemSel=document.getElementById('editOrderItem');
        empSel.innerHTML=empReq.result.map(k=>`<option value="${escapeHtml(k.nama)}">${escapeHtml(k.nama)}</option>`).join('');
        itemSel.innerHTML=itemReq.result.map(i=>`<option value="${escapeHtml(i.alias)}">${escapeHtml(i.name)} (${escapeHtml(i.unit)})</option>`).join('');
        document.getElementById('editOrderId').value=o.id;
        document.getElementById('editOrderCustomer').value=o.customer || '';
        document.getElementById('editOrderQty').value=o.qty;
        empSel.value=o.karyawan || '';
        itemSel.value=o.itemAlias || '';
        document.getElementById('editOrderModal').style.display='flex';
      };
    };
  };
}

function closeEditOrder() {
  const m=document.getElementById('editOrderModal');
  if(m) m.style.display='none';
}

async function saveEditedOrder() {
  const id=Number(document.getElementById('editOrderId').value);
  const customer=document.getElementById('editOrderCustomer').value.trim();
  const karyawan=document.getElementById('editOrderEmployee').value;
  const itemAlias=document.getElementById('editOrderItem').value;
  const qty=parseFloat(document.getElementById('editOrderQty').value);
  if(!id || !karyawan || !itemAlias || !Number.isFinite(qty) || qty<=0) {
    uiToast('Lengkapi data edit terlebih dahulu.'); return;
  }
  const items=await new Promise(resolve=>{
    const t=db.transaction('items','readonly');
    t.objectStore('items').get(itemAlias).onsuccess=e=>resolve(e.target.result);
  });
  if(!items){ uiToast('Jenis pekerjaan tidak ditemukan.'); return; }

  const todayStr=new Date().toLocaleDateString('id-ID');
  const orders=await getTodayOrders(todayStr);
  const current=orders.find(o=>o.id===id);
  const rules=await getCommRulesMap();
  const rule=rules[`${karyawan}_${itemAlias}`]||{minQuota:0,tier1Limit:9999,tier1Rate:0,tier2Rate:0};
  const currentEmpQty=orders.filter(o=>o.id!==id && o.karyawan===karyawan && o.itemAlias===itemAlias)
    .reduce((sum,o)=>sum+Number(o.qty||0),0);
  const komisi=calculateTieredCommission(rule.minQuota,rule.tier1Limit,rule.tier1Rate,rule.tier2Rate,currentEmpQty,qty);

  const updated={
    ...current,
    karyawan, customer, itemAlias, jenis:items.name, unit:items.unit, qty,
    price:items.price||0, totalOmset:qty*(items.price||0), totalKomisi:komisi
  };
  const tx=db.transaction('orders','readwrite');
  tx.objectStore('orders').put(updated);
  tx.oncomplete=()=>{ closeEditOrder(); renderAll(); uiToast('Pengerjaan berhasil diedit.'); };
}

async function deleteOrder(id) {
  if (!(await uiConfirm('Hapus data pengerjaan ini?','Hapus Pengerjaan'))) return;
  const tx = db.transaction('orders', 'readwrite');
  tx.objectStore('orders').delete(id);
  tx.oncomplete = () => { renderAll(); uiToast('Pengerjaan dihapus.'); };
}

async function clearAllOrders() {
  if (!(await uiConfirm("Hapus seluruh data pengerjaan hari ini?"))) return;
  const tx = db.transaction('orders', 'readwrite');
  tx.objectStore('orders').clear();
  tx.oncomplete = () => renderAll();
}