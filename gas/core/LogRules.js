// 作業時間の記録の受けつけの決まり。GASに頼らない部分(Node.jsでテストする)。
// 公開窓口はだれでも呼べるので、決まった形のものだけを、決まった量まで受けつける。

const LOG_LIMITS = { perRequest: 20, perMinute: 30, perDay: 300, maxSec: 3600 };

// 「2026-10-10 12:03」を日本時間として読む。返り値はミリ秒(読めなければ NaN)
function parseJstMinute(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(s));
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5]);
}

// body:送られてきたJSONの文字。nowMs:今の時刻。返り値:{ records, rejected, error }
function validateLogBatch(body, nowMs) {
  let data;
  try { data = JSON.parse(body); } catch (e) { return { records: [], rejected: 0, error: 'JSONではありません' }; }
  const list = data && Array.isArray(data.records) ? data.records : null;
  if (!list) return { records: [], rejected: 0, error: 'records がありません' };
  if (list.length > LOG_LIMITS.perRequest) return { records: [], rejected: list.length, error: `1回に送れるのは${LOG_LIMITS.perRequest}件までです` };
  const records = [];
  let rejected = 0;
  for (const r of list) {
    const ok = r && typeof r === 'object'
      && LOG_KINDS.includes(r.kind) && LOG_FMTS.includes(r.fmt)
      && Number.isInteger(r.sec) && r.sec >= 1 && r.sec <= LOG_LIMITS.maxSec
      && Math.abs(parseJstMinute(r.at) - nowMs) <= 24 * 3600 * 1000;
    if (ok) records.push({ at: r.at, kind: r.kind, fmt: r.fmt, sec: r.sec }); // 決まった項目だけを取り出す
    else rejected++;
  }
  return { records, rejected, error: '' };
}

// 1分と1日の数の上限から、いくつまで受けつけるか
function allowedCount(want, usedMinute, usedDay) {
  return Math.max(0, Math.min(want, LOG_LIMITS.perMinute - usedMinute, LOG_LIMITS.perDay - usedDay));
}

if (typeof module !== 'undefined') module.exports = { LOG_LIMITS, parseJstMinute, validateLogBatch, allowedCount };
