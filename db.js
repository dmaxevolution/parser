let db = null;

const request = indexedDB.open('PWARekapBoronganDB', 1);

request.onupgradeneeded = (e) => {
  db = e.target.result;

  if (!db.objectStoreNames.contains('karyawan')) {
    const storeK = db.createObjectStore('karyawan', { keyPath: 'id', autoIncrement: true });
    storeK.createIndex('nama', 'nama', { unique: true });
  }

  if (!db.objectStoreNames.contains('items')) {
    const storeI = db.createObjectStore('items', { keyPath: 'alias' });
    storeI.createIndex('name', 'name', { unique: false });
  }

  if (!db.objectStoreNames.contains('comm_rules')) {
    db.createObjectStore('comm_rules', { keyPath: 'key' });
  }

  if (!db.objectStoreNames.contains('orders')) {
    const storeO = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
    storeO.createIndex('tanggal', 'tanggal', { unique: false });
    storeO.createIndex('karyawan', 'karyawan', { unique: false });
  }
};

request.onsuccess = (e) => {
  db = e.target.result;
  seedInitialData();
};

request.onerror = (e) => {
  console.error("IndexedDB Error:", e.target.error);
};

function seedInitialData() {
  const txI = db.transaction('items', 'readwrite');
  const storeI = txI.objectStore('items');
  storeI.count().onsuccess = (e) => {
    if (e.target.result === 0) {
      storeI.add({ alias: 'stk', name: 'Setrika', unit: 'kg', price: 3000 });
      storeI.add({ alias: 'ckl', name: 'Cuci Kering Lipat', unit: 'kg', price: 2000 });
    }
  };

  const txK = db.transaction('karyawan', 'readwrite');
  const storeK = txK.objectStore('karyawan');
  storeK.count().onsuccess = (e) => {
    if (e.target.result === 0) {
      storeK.add({ nama: 'Budi' });
      storeK.add({ nama: 'Siti' });
    }
  };

  txK.oncomplete = () => {
    if (typeof renderAll === 'function') renderAll();
  };
}

// Helper DB
function getItemsMap() {
  return new Promise((resolve) => {
    const tx = db.transaction('items', 'readonly');
    const map = {};
    tx.objectStore('items').getAll().onsuccess = (e) => {
      e.target.result.forEach(item => {
        const aliases = String(item.aliases || item.alias || '')
          .split(',')
          .map(x => x.trim().toLowerCase()).filter(Boolean);
        aliases.forEach(a => { map[a] = item; });
        const name = String(item.name || '').trim().toLowerCase();
        if (name) map[name] = item;
      });
      resolve(map);
    };
  });
}

function getCommRulesMap() {
  return new Promise((resolve) => {
    const tx = db.transaction('comm_rules', 'readonly');
    const map = {};
    tx.objectStore('comm_rules').getAll().onsuccess = (e) => {
      e.target.result.forEach(r => { map[r.key] = r; });
      resolve(map);
    };
  });
}

function getTodayOrders(todayStr) {
  return new Promise((resolve) => {
    const tx = db.transaction('orders', 'readonly');
    tx.objectStore('orders').getAll().onsuccess = (e) => {
      const orders = e.target.result.filter(o => o.tanggal === todayStr);
      resolve(orders);
    };
  });
}

function calculateTieredCommission(minQuota, tier1Limit, tier1Rate, tier2Rate, currentQty, newQty) {
  const totalQty = currentQty + newQty;
  if (totalQty <= minQuota) return 0;

  let applicableNewQty = newQty;
  if (currentQty < minQuota) {
    applicableNewQty = totalQty - minQuota;
  }

  const startQty = Math.max(currentQty, minQuota);
  const endQty = totalQty;

  let komisi = 0;

  if (startQty < tier1Limit) {
    const tier1Qty = Math.min(endQty, tier1Limit) - startQty;
    komisi += tier1Qty * tier1Rate;
  }

  if (endQty > tier1Limit) {
    const tier2Qty = endQty - Math.max(startQty, tier1Limit);
    komisi += tier2Qty * tier2Rate;
  }

  return komisi;
}