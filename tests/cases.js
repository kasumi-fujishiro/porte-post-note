// 自動テストの中身。tests/index.html(ブラウザ)と tests/run.mjs(コマンド)の両方から使う。
import { layout, dateLabel, priceLike } from '../js/text.js';
import { monthInfo, regularMap, countDays, cycleFor, noticeFor, simulatedNow, nextState } from '../js/calendar.js';

// 1文字の幅を「大きさ」と同じにした、仮の幅の測り方
const mono = (t, s) => [...t].length * s;
const D = (y, m, d) => new Date(y, m - 1, d);
const ST = { calday: 25, callead: 5, caltarget: 'next', regular: [1, 2] };

export const cases = [
  // ---------- 日付 ----------
  ['日付は「10.07」の形になる', eq => eq(dateLabel('2026-10-07'), '10.07')],
  ['2026年11月の1日は日曜', eq => eq(monthInfo(2026, 11).first, 0)],
  ['2026年11月は30日まで', eq => eq(monthInfo(2026, 11).n, 30)],
  ['定休日を月曜と火曜にすると、2026年11月のお休みは9日', eq => eq(countDays(regularMap(2026, 11, [1, 2])).closed, 9)],
  ['12月に「翌月の分」を開くと、2027年1月になる', eq => { const c = cycleFor(2026, 11, ST); eq(c.ty, 2027); eq(c.tm, 1); eq(c.key, '2027-01'); }],
  ['「その月の分」なら、12月は2026年12月', eq => eq(cycleFor(2026, 11, { ...ST, caltarget: 'same' }).key, '2026-12')],
  ['出す日が31日でも、2月は月末の日になる', eq => eq(cycleFor(2027, 1, { ...ST, calday: 31 }).P.getDate(), 28)],
  ['タップするたびに お休み → 時間変更 → 営業', eq => { eq(nextState(''), 'c'); eq(nextState('c'), 's'); eq(nextState('s'), ''); }],

  // ---------- 確認のお知らせ ----------
  ['まだ早い(10月7日、使い始めた日が10月1日)', eq => eq(noticeFor(D(2026, 10, 7), ST, {}, '2026-10-01').state, 'early')],
  ['確認の時期(10月20日から。11月の分、あと5日)', eq => {
    const n = noticeFor(D(2026, 10, 20), ST, {}, '2026-10-01');
    eq(n.state, 'due'); eq(n.key, '2026-11'); eq(n.days, 5);
  }],
  ['前日はまだ早い(10月19日)', eq => eq(noticeFor(D(2026, 10, 19), ST, {}, '2026-10-01').state, 'early')],
  ['出す日の当日は、まだ「確認の時期」(あと0日)', eq => { const n = noticeFor(D(2026, 10, 25), ST, {}, '2026-10-01'); eq(n.state, 'due'); eq(n.days, 0); }],
  ['確認ずみ', eq => eq(noticeFor(D(2026, 10, 22), ST, { '2026-11': { at: '10月22日', done: false } }, '2026-10-01').state, 'ok')],
  ['期限を過ぎた(10月26日、未確認)', eq => eq(noticeFor(D(2026, 10, 26), ST, {}, '2026-10-01').state, 'late')],
  ['期限を過ぎても、確認ずみなら「確認ずみ」', eq => eq(noticeFor(D(2026, 10, 26), ST, { '2026-11': { at: '10月26日', done: false } }, '2026-10-01').state, 'ok')],
  ['投稿まで済んだ', eq => eq(noticeFor(D(2026, 10, 26), ST, { '2026-11': { at: '10月22日', done: true } }, '2026-10-01').state, 'done')],
  ['使い始める前の月は知らせない(10月27日に使い始めた)', eq => eq(noticeFor(D(2026, 10, 27), ST, {}, '2026-10-27').state, 'early')],
  ['12月20日からは、2027年1月の分を知らせる', eq => eq(noticeFor(D(2026, 12, 20), ST, {}, '2026-10-01').key, '2027-01')],
  ['表示テスト「知らせる時期」は、10月7日なら10月20日として見る', eq => eq(simulatedNow(D(2026, 10, 7), ST, 'due').getDate(), 20)],
  ['表示テスト「出す日を過ぎた」は、10月26日として見る', eq => eq(noticeFor(simulatedNow(D(2026, 10, 7), ST, 'late'), ST, {}, '2026-10-07').state, 'late')],

  // ---------- 文字の折り返し ----------
  ['1行に入るなら、少し小さくして1行にする', eq => { const r = layout('足元にお気をつけてお越しください', { size: 60, min: 44, maxW: 16 * 50, measure: mono }); eq(r.lines.length, 1); eq(r.size <= 50, true); }],
  ['「足元にお気をつけてお越しください」は、最後の1文字だけが次の行に落ちない', eq => {
    for (let w = 6; w <= 16; w++) {
      const r = layout('足元にお気をつけてお越しください', { size: 10, min: 10, maxW: w * 10, measure: mono });
      for (const l of r.lines) eq([...l].length >= 2, true, `幅${w}文字のとき「${r.lines.join(' / ')}」`);
    }
  }],
  ['2行のときは「お気をつけて」のあとで切る', eq => eq(layout('足元にお気をつけてお越しください', { size: 10, min: 10, maxW: 100, measure: mono }).lines.join(' / '), '足元にお気をつけて / お越しください')],
  ['行の頭に「、」が来ない', eq => {
    const r = layout('雨の中のご来店、ありがとうございます', { size: 10, min: 10, maxW: 70, measure: mono });
    for (const l of r.lines) eq(l.startsWith('、'), false, r.lines.join(' / '));
  }],
  ['折り返しても、文字が1文字も変わらない', eq => {
    const texts = ['足元にお気をつけてお越しください', '雨の中のご来店、ありがとうございます', 'シャインマスカットのタルト', '例:お店の前に ◯台 とめられます'];
    for (const t of texts) for (let w = 5; w <= 20; w++) {
      const r = layout(t, { size: 10, min: 10, maxW: w * 10, measure: mono });
      eq(r.lines.join('').replace(/\s/g, ''), t.replace(/\s/g, ''), `幅${w}文字`);
    }
  }],
  ['カタカナの言葉は途中で切らない(シャインマスカットのタルト)', eq => eq(layout('シャインマスカットのタルト', { size: 10, min: 10, maxW: 100, measure: mono }).lines.join(' / '), 'シャインマスカットの / タルト')],
  ['幅より長いカタカナの言葉は、1文字ずつに分けて入れる', eq => {
    const r = layout('アイスクリームサンドイッチ', { size: 10, min: 10, maxW: 60, measure: mono });
    for (const l of r.lines) eq(mono(l, 10) <= 60, true, r.lines.join(' / '));
  }],
  ['英数字のまとまり(10:00)は途中で切らない', eq => {
    const r = layout('営業時間は10:00からです', { size: 10, min: 10, maxW: 80, measure: mono });
    eq(r.lines.some(l => l.includes('10:00')), true, r.lines.join(' / '));
  }],

  // ---------- 価格 ----------
  ['価格のような文字を見つける', eq => { eq(priceLike('500円'), true); eq(priceLike('¥500'), true); eq(priceLike('１，２００円'), true); eq(priceLike('3個入り'), false); }]
];

// 実行して、結果の一覧を返す
export function run(extra = []) {
  return [...cases, ...extra].map(([name, fn]) => {
    const errors = [];
    const eq = (a, b, note = '') => { if (a !== b) errors.push(`${note ? note + ': ' : ''}${JSON.stringify(a)} ではなく ${JSON.stringify(b)} のはず`); };
    try { fn(eq); } catch (e) { errors.push(String(e)); }
    return { name, ok: errors.length === 0, errors };
  });
}
