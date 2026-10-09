// 仮のデータ。段階3で、GASの公開窓口から配る配信データ(正しいデータはスプレッドシート)に置きかえる。
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
  regular: [1, 2],
  calday: 25,
  callead: 5,
  caltarget: 'next'
};

// 営業カレンダーの季節のデザイン(月ごと)
// main: お休みの丸と下線の色(白い数字が読める濃さ)、band: 帯の色、motifs: すみに置く飾り(右上と左下に3つずつ)
export const SEASONS = {
  1: { name: '梅', main: '#C2405A', band: '#E58E9E', motifs: ['plum', 'plumPink', 'plum'] },
  2: { name: 'チョコ', main: '#7A4A2E', band: '#D9A3B5', motifs: ['chocoHeart', 'chocoBar', 'heart'] },
  3: { name: '菜の花', main: '#5E8F2A', band: '#E3C83A', motifs: ['nanohana', 'leafLight', 'nanohana'] },
  4: { name: '桜', main: '#D45C84', band: '#F0A6BC', motifs: ['sakura', 'sakuraLight', 'sakura'] },
  5: { name: 'こどもの日', main: '#3567A8', band: '#8DB7E3', motifs: ['koinobori', 'kabuto', 'leafLight'] },
  6: { name: 'あじさい', main: '#5A6BBF', band: '#9AA9DE', motifs: ['hydrangea', 'drop', 'hydrangeaPurple'] },
  7: { name: '七夕', main: '#35609E', band: '#7FA4DA', motifs: ['milkyWay', 'sasa', 'star'] },
  8: { name: 'ひまわり', main: '#C26F0A', band: '#F0BE4A', motifs: ['sunflower', 'sunflower', 'leaf'] },
  9: { name: 'お月見', main: '#3E4F7A', band: '#D8BC6A', motifs: ['tsukimiDango', 'moon', 'susuki'] },
  10: { name: 'ハロウィン', main: '#D2601A', band: '#A386CF', motifs: ['pumpkin', 'bat', 'candy'] },
  11: { name: '紅葉', main: '#B8432A', band: '#E39A4A', motifs: ['maple', 'mapleYellow', 'maple'] },
  12: { name: 'クリスマス', main: '#B3303A', band: '#6FA87A', motifs: ['tree', 'ornament', 'snow'] }
};
