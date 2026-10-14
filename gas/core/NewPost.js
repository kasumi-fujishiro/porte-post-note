// 新作の自動投稿の決まり。GASに頼らない部分(Node.jsでテストする)。
// シェフが管理ページで商品を写真つきで登録すると、1時間以内にフィードへ投稿する(10月14日に決定)。

// 投稿してよい時(9時台〜20時台)。この外に登録したときは、次の9時台に出す
const NEW_HOURS = { from: 9, to: 20 };

// 「2026-10-14」の次の日
function nextDay(day) {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + 1));
  return d.toISOString().slice(0, 10);
}

// 投稿してよい時か。now は「2026-10-14 15:23:00」の形(日本時間)
function inPostHours(now) {
  const h = +String(now).slice(11, 13);
  return h >= NEW_HOURS.from && h <= NEW_HOURS.to;
}

// 登録した時刻から、投稿する日と時を決める(1時間以内。9〜20時の外なら、次の9時台)
function newPostSlot(now) {
  const day = String(now).slice(0, 10), h = +String(now).slice(11, 13);
  if (h < NEW_HOURS.from) return { postDate: day, postHour: NEW_HOURS.from };
  if (h > NEW_HOURS.to) return { postDate: nextDay(day), postHour: NEW_HOURS.from };
  return { postDate: day, postHour: h };
}

// 「時間を決める」でえらんだ日と時を検査する。過ぎた時や、60日より先は断る
function cleanSlot(input, now) {
  const date = String((input && input.date) || ''), hour = Number(input && input.hour);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '投稿する日をえらんでください。' };
  if (!Number.isInteger(hour) || hour < NEW_HOURS.from || hour > NEW_HOURS.to) return { error: `投稿する時は、${NEW_HOURS.from}時〜${NEW_HOURS.to}時からえらんでください。` };
  const today = String(now).slice(0, 10), h = +String(now).slice(11, 13);
  if (date < today || (date === today && hour < h)) return { error: 'その時間は、もう過ぎています。えらび直してください。' };
  let limit = today;
  for (let i = 0; i < 60; i++) limit = nextDay(limit);
  if (date > limit) return { error: '投稿する日は、60日先までにしてください。' };
  return { value: { postDate: date, postHour: hour }, error: '' };
}

// 投稿する時を、人に伝える言葉にする(「1時間以内」「明日の9時台」など)
function slotWords(slot, now, chosen) {
  const today = String(now).slice(0, 10), within = slot.postDate === today && +slot.postHour === +String(now).slice(11, 13);
  if (within && !chosen) return '1時間以内';
  if (slot.postDate === today) return `今日の${slot.postHour}時台`;
  if (slot.postDate === nextDay(today)) return `明日の${slot.postHour}時台`;
  return `${+slot.postDate.slice(5, 7)}月${+slot.postDate.slice(8)}日の${slot.postHour}時台`;
}

// 投稿の文(キャプション)。商品名と説明だけ。価格は入れない
function captionForProduct(p) {
  return [p && p.name, p && p.desc].map(s => String(s || '').trim()).filter(Boolean).join('\n');
}

// 新作の投稿にしてよい商品か
function checkNewPost(p) {
  if (!p || !p.name) return { error: '商品が見つかりません。読み直してください。' };
  if (String(p.ex).toUpperCase() === 'TRUE') return { error: '「例」の商品は、Instagramに投稿できません。お店の商品を登録してください。' };
  if (priceLike(p.name) || priceLike(p.desc || '')) return { error: '価格のような文字が入っています。お店の方針で、価格は載せません。直してから登録してください。' };
  return { error: '' };
}

// 公開用の画像の場所(新作)
function newImagePath(postDate, resId) {
  return `posts/${postDate}-${String(resId).toLowerCase().replace(/[^a-z0-9]/g, '')}.jpg`;
}

// 予約の呼び名(LINEや画面に出す)
function resLabel(r) {
  const m = /^(\d{4})-(\d{2})$/.exec((r && r.month) || '');
  if (r && r.kind === 'new') return r.month === 'TEST' ? '試しの投稿(新作)' : `新作「${r.title || ''}」`;
  return m ? `${+m[2]}月の営業カレンダー` : '試しの投稿';
}

if (typeof module !== 'undefined') module.exports = { NEW_HOURS, nextDay, slotWords, inPostHours, newPostSlot, cleanSlot, captionForProduct, checkNewPost, newImagePath, resLabel };
