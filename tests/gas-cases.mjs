// gas/core のテスト(Node.js だけで動かす)。GASと同じく、ファイルを1つの場所(グローバル)に読みこむ。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ console });
for (const f of ['Schema.js', 'Validate.js', 'LogRules.js', 'Edit.js', 'Examples.js']) {
  vm.runInContext(readFileSync(new URL(`../gas/core/${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
}
const G = name => vm.runInContext(name, ctx);

const settingsRows = (over = {}) => G('SETTING_ROWS').map(([key, value], i) => ({ row: i + 2, key, value: key in over ? over[key] : value }));
const NOW = Date.UTC(2026, 9, 10, 3, 0); // 2026-10-10 12:00 日本時間

export const gasCases = [
  // ---------- シートの形 ----------
  ['見出しの行から、行ごとのオブジェクトにする(空の行は外す)', eq => {
    const rows = G('rowsToObjects')('phrases', [['ID', '状況', 'ひとこと', '並び順', 'しまう', '例', '更新日時'], ['a1', '雨の日', '足元に', '1', 'FALSE', 'TRUE', ''], ['', '', '', '', '', '', '']]);
    eq(rows.length, 1); eq(rows[0].cat, '雨の日'); eq(rows[0].row, 2);
  }],
  ['チェックボックスだけの空の行(FALSE)は、空の行として外す', eq => {
    const rows = G('rowsToObjects')('phrases', [['ID', '状況', 'ひとこと', '並び順', 'しまう', '例', '更新日時'], ['', '', '', '', 'FALSE', 'FALSE', ''], ['a1', '雨の日', '足元に', '1', 'FALSE', 'FALSE', '']]);
    eq(rows.length, 1); eq(rows[0].id, 'a1');
  }],
  ['見出しの順番を入れかえても読める', eq => {
    const rows = G('rowsToObjects')('phrases', [['ひとこと', 'ID', '状況'], ['足元に', 'a1', '雨の日']]);
    eq(rows[0].id, 'a1'); eq(rows[0].text, '足元に');
  }],

  // ---------- 検査 ----------
  ['設定:初めの値どおりなら、問題はない', eq => {
    const p = []; const s = G('readSettings')(settingsRows(), p);
    eq(p.length, 0); eq(JSON.stringify(s.regular), '[1,2]'); eq(s.schedule.postDay, 25); eq(s.postTo, 'feed');
  }],
  ['設定:おかしな値は初めの値にして、直してほしい行に出す', eq => {
    const p = []; const s = G('readSettings')(settingsRows({ theme: 'red', postDay: '31', regular: '月,火', postTo: 'reel' }), p);
    eq(s.theme, 'pink'); eq(s.schedule.postDay, 25); eq(JSON.stringify(s.regular), '[1,2]'); eq(s.postTo, 'feed'); eq(p.length, 4);
  }],
  ['ひとこと:しまったものは配らない。並び順で並べる', eq => {
    const p = []; const out = G('checkPhrases')([
      { row: 2, id: 'a', cat: '雨の日', text: 'B', order: '2', hidden: 'FALSE', ex: 'TRUE' },
      { row: 3, id: 'b', cat: '雨の日', text: 'A', order: '1', hidden: 'FALSE', ex: 'FALSE' },
      { row: 4, id: 'c', cat: '雨の日', text: 'C', order: '3', hidden: 'TRUE', ex: 'FALSE' }], p);
    eq(out.map(x => x.text).join(''), 'AB'); eq(out[1].ex, true); eq(p.length, 0);
  }],
  ['ひとこと:必須の欄が空、IDの重なり、価格は、配信から外す', eq => {
    const p = []; const out = G('checkPhrases')([
      { row: 2, id: 'a', cat: '雨の日', text: '', order: '1' },
      { row: 3, id: 'b', cat: '雨の日', text: '本日 500円', order: '1' },
      { row: 4, id: 'c', cat: '雨の日', text: 'OK', order: '1' },
      { row: 5, id: 'c', cat: '雨の日', text: 'もう1つ', order: '1' },
      { row: 6, id: '', cat: '雨の日', text: 'IDなし', order: '1' }], p);
    eq(out.length, 1); eq(p.length, 4); eq(p.map(x => x.row).join(','), '2,3,5,6');
  }],
  ['商品:色は決まった5つだけ', eq => {
    const p = []; const out = G('checkProducts')([
      { row: 2, id: 'a', name: 'タルト', desc: '', color: 'green' },
      { row: 3, id: 'b', name: 'ケーキ', desc: '', color: 'red' }], p);
    eq(out.length, 1); eq(p[0].row, 3);
  }],
  ['カレンダー:日ごとの状態を読む。月にない日はだめ', eq => {
    eq(JSON.stringify(G('parseDays')('2:c, 3:c,23:s', '2026-11')), '{"2":"c","3":"c","23":"s"}');
    eq(G('parseDays')('31:c', '2026-11'), null);
    eq(G('parseDays')('2:x', '2026-11'), null);
    eq(JSON.stringify(G('parseDays')('', '2026-11')), '{}');
    eq(G('daysToText')({ 23: 's', 2: 'c' }), '2:c,23:s');
  }],
  ['カレンダー:確認済みの月だけ中身を配る。確認前は「まだ」とだけ伝える', eq => {
    const p = []; const r = G('checkCalendars')([
      { row: 2, month: '2026-11', days: '2:c', note: '', state: '確認済み' },
      { row: 3, month: '2026-12', days: '1:c', note: '', state: '未確認' }], p);
    eq(r.calendars.length, 1); eq(r.calendars[0].month, '2026-11');
    eq(r.calendarState['2026-11'], 'confirmed'); eq(r.calendarState['2026-12'], 'unconfirmed'); eq(p.length, 0);
  }],
  ['配信データ:シートがこわれていても止まらず、直してほしい行を返す', eq => {
    const { feed, problems } = G('buildFeed')({
      settings: settingsRows({ version: '7' }),
      phrases: [{ row: 2, id: 'a', cat: '', text: '' }, { row: 3, id: 'b', cat: '雨の日', text: '足元に' }],
      products: [], calendars: [{ row: 2, month: '11月', days: '', state: '確認済み' }]
    }, '2026-10-10T12:00:00+09:00', null);
    eq(feed.version, 7); eq(feed.phrases.length, 1); eq(feed.calendars.length, 0); eq(problems.length, 2);
    eq('version' in feed.settings, false); eq(feed.auto.alert, null);
  }],

  // ---------- 作業時間の受けつけ ----------
  ['記録:決まった形のものだけ受けつけ、余分な項目は捨てる', eq => {
    const body = JSON.stringify({ records: [
      { at: '2026-10-10 11:58', kind: 'open', fmt: 'story', sec: 18, name: '山田' },
      { at: '2026-10-10 11:58', kind: 'open', fmt: 'story', sec: 0 },
      { at: '2026-10-10 11:58', kind: 'video', fmt: 'story', sec: 10 },
      { at: '2026-10-10 11:58', kind: 'open', fmt: 'story', sec: 9999 },
      { at: '2026-10-10 11:58', kind: 'open', fmt: 'story', sec: 1.5 },
      { at: '2026-10-01 11:58', kind: 'open', fmt: 'story', sec: 10 }] });
    const r = G('validateLogBatch')(body, NOW);
    eq(r.records.length, 1); eq(r.rejected, 5); eq('name' in r.records[0], false);
  }],
  ['記録:1回に21件以上は受けつけない。JSONでないものも受けつけない', eq => {
    const many = Array.from({ length: 21 }, () => ({ at: '2026-10-10 11:58', kind: 'open', fmt: 'story', sec: 5 }));
    eq(G('validateLogBatch')(JSON.stringify({ records: many }), NOW).records.length, 0);
    eq(G('validateLogBatch')('<script>', NOW).error !== '', true);
  }],
  // ---------- 管理ページの登録 ----------
  ['登録:ひとことは前後の空白を取り、価格が入っていたら理由を出す', eq => {
    const c = G('cleanPhrase');
    eq(c({ cat: ' 雨の日 ', text: '足元に  お気をつけて' }).value.text, '足元に お気をつけて');
    eq(c({ cat: '雨の日', text: '本日500円' }).error.includes('価格'), true);
    eq(c({ cat: '雨の日', text: '¥500 です' }).error.includes('価格'), true);
    eq(c({ cat: '', text: 'あ' }).error !== '', true);
    eq(c({ cat: '雨の日', text: 'あ'.repeat(41) }).error.includes('40文字'), true);
  }],
  ['登録:商品は色をえらばないと登録できない', eq => {
    eq(G('cleanProduct')({ name: 'タルト', desc: '', color: '' }).error.includes('色'), true);
    eq(G('cleanProduct')({ name: 'タルト', desc: '', color: 'green' }).error, '');
  }],
  ['登録:設定の日程は「知らせる日1 < 知らせる日2 ≦ 投稿する日」', eq => {
    const base = { hours: '', theme: 'pink', regular: '1, 2', notice1: '20', notice2: '23', postDay: '25', postHour: '12', postTo: 'feed' };
    eq(G('cleanSettings')(base).error, ''); eq(G('cleanSettings')(base).value.regular, '1,2');
    eq(G('cleanSettings')({ ...base, notice2: '26' }).error.includes('順'), true);
    eq(G('cleanSettings')({ ...base, postHour: '25' }).error !== '', true);
    eq(G('cleanSettings')({ ...base, hours: '1000円以上' }).error.includes('価格'), true);
  }],
  ['記録のまとめ:新しい順に並べ、平均を出す', eq => {
    const s = G('logSummary')([{ at: '2026-10-10 10:00', sec: '10' }, { at: '2026-10-11 10:00', sec: '20' }, { at: 'x', sec: 'abc' }]);
    eq(s.count, 2); eq(s.avg, 15); eq(s.rows[0].at, '2026-10-11 10:00');
  }],
  ['例:ひとこと8件、商品3件。価格は入っていない', eq => {
    eq(G('EXAMPLE_PHRASES').length, 8); eq(G('EXAMPLE_PRODUCTS').length, 3);
    eq(G('EXAMPLE_PHRASES').every(([c, t]) => G('cleanPhrase')({ cat: c, text: t }).error === ''), true);
  }],
  ['記録:1分30件・1日300件をこえた分は受けつけない', eq => {
    const a = G('allowedCount');
    eq(a(5, 0, 0), 5); eq(a(5, 28, 0), 2); eq(a(5, 0, 299), 1); eq(a(5, 30, 0), 0);
  }]
];
