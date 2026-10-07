// 端末への保存。
// 小さなもの(えらんだ内容、カレンダー)は localStorage、写真は IndexedDB に置く。

export const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 保存できない端末では何もしない */ } }
};

const DB = 'post-note', STORE = 'kv';
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req && req.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

// 写真は { day: 'YYYY-MM-DD', blob } の形で1枚だけ置く
export const photoStore = {
  async get() { try { return await tx('readonly', s => s.get('photo')); } catch { return null; } },
  async set(v) { try { await tx('readwrite', s => s.put(v, 'photo')); return true; } catch { return false; } },
  async del() { try { await tx('readwrite', s => s.delete('photo')); } catch { /* なにもしない */ } }
};
