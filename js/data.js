// 仮のデータ。段階3で「登録」の画面とFirestoreに置きかえる。
// ex: true が「例」の印。お店の実際の内容ではない。

export const THEMES = {
  pink: { name: 'ピンク', a: '#E4517A', d: '#8E2444' },
  brown: { name: '茶色', a: '#8A5A36', d: '#4B2E1A' },
  green: { name: '緑', a: '#7FB23A', d: '#3F6418' },
  yellow: { name: '黄色', a: '#E0A81C', d: '#7A5600' },
  purple: { name: 'むらさき', a: '#8E63C0', d: '#4A2C78' }
};

// x: 左右の余白。top / bottom: 文字を置かない範囲(1080幅のときのピクセル)
export const FORMATS = {
  story: { name: 'ストーリーズ', w: 1080, h: 1920, x: 90, top: 250, bottom: 270 },
  feed: { name: 'フィード投稿', w: 1080, h: 1350, x: 80, top: 90, bottom: 90 },
  a4: { name: '店頭掲示 A4', w: 2480, h: 3508, x: 100, top: 130, bottom: 130 }
};

export const KINDS = { open: '営業中', cal: '営業カレンダー', new: '新作・季節', park: '駐車場' };

export const PHRASES = [
  { id: 'ex1', cat: '雨の日', text: '足元にお気をつけてお越しください', ex: true },
  { id: 'ex2', cat: '雨の日', text: '雨の中のご来店、ありがとうございます', ex: true },
  { id: 'ex3', cat: '暑い日', text: '保冷剤をご用意しております', ex: true },
  { id: 'ex4', cat: '暑い日', text: '涼しい店内でお待ちしております', ex: true },
  { id: 'ex5', cat: '寒い日', text: 'あたたかくしてお越しください', ex: true },
  { id: 'ex6', cat: '雪・荒天', text: 'どうぞ無理のないようにお越しください', ex: true },
  { id: 'ex7', cat: '週末・連休', text: '本日も元気に営業しております', ex: true },
  { id: 'ex8', cat: 'いつでも', text: '皆さまのお越しをお待ちしております', ex: true }
];

export const PRODUCTS = [
  { id: 'exp1', name: 'いちごのカップデザート', desc: '甘ずっぱいいちごのソースと、ふんわりホイップ', color: 'pink', ex: true },
  { id: 'exp2', name: 'ガトーショコラ', desc: 'しっとり濃厚なチョコレート生地', color: 'brown', ex: true },
  { id: 'exp3', name: 'シャインマスカットのタルト', desc: 'みずみずしいシャインマスカットをのせました', color: 'green', ex: true }
];

// regular: 定休日の曜日(0=日 … 6=土)
// calday: 毎月この日にカレンダーを出す / callead: 何日前から知らせる / caltarget: next=翌月の分, same=その月の分
export const DEFAULT_SETTINGS = {
  hours: '',
  theme: 'pink',
  park: '例:お店の前に ◯台 とめられます\n例:満車のときは、近くの駐車場をご利用ください',
  regular: [1, 2],
  calday: 25,
  callead: 5,
  caltarget: 'next'
};
