// 作業時間の記録を、公開窓口に送る。送れなかった分は端末にためておき、次に開いたときや電波が戻ったときに送る。
// 送るのは、日時・種類・大きさ・秒数だけ(名前や端末の情報は送らない)。
import { CONFIG } from '../config.js?v=11';
import { ls } from './store.js?v=11';

const KEY = 'pn-logq', MAX = 50, BATCH = 20;
let busy = false;

export function enqueueLog(rec) {
  const q = ls.get(KEY, []);
  q.push({ at: rec.at, kind: rec.kind, fmt: rec.fmt, sec: rec.sec });
  ls.set(KEY, q.slice(-MAX));
  flushLogs();
}

export const pendingLogs = () => ls.get(KEY, []).length;

export async function flushLogs() {
  if (busy || !CONFIG.feedUrl || !navigator.onLine) return;
  const q = ls.get(KEY, []);
  if (!q.length) return;
  busy = true;
  try {
    const batch = q.slice(0, BATCH);
    // text/plain で送る(前もっての問い合わせがいらない、いちばん簡単な送り方)
    const res = await fetch(CONFIG.feedUrl, { method: 'POST', body: JSON.stringify({ records: batch }) });
    const j = await res.json();
    // 受けつけられた分も、形がちがって断られた分も、送りなおさない(同じものは何度送っても断られるため)
    if (j && !j.retry && (j.ok || j.error)) {
      const rest = ls.get(KEY, []).slice(batch.length);
      ls.set(KEY, rest);
      if (rest.length && j.ok) setTimeout(flushLogs, 2000);
    }
  } catch {
    // 電波がないなど。次の機会に送る
  } finally {
    busy = false;
  }
}
