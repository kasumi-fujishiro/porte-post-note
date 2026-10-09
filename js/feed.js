// 配信データ(ひとこと、商品、お店の設定、確認ずみのカレンダー)を受け取る。
// 正しいデータはスプレッドシート。ここにあるのは、版番号つきの写し。
// 開いたらまず端末に保存した写しですぐ動き、裏で新しい版を確かめる。
import { CONFIG } from '../config.js?v=12';
import { ls } from './store.js?v=12';
import { PHRASES, PRODUCTS, DEFAULT_SETTINGS } from './data.js?v=12';

const KEY = 'pn-feed';
const valid = f => !!(f && typeof f === 'object' && Number.isInteger(f.version) && f.settings
  && Array.isArray(f.phrases) && Array.isArray(f.products));

// 端末に保存した写し(なければ null)
export function cachedFeed() {
  const f = ls.get(KEY, null);
  return valid(f) ? f : null;
}

// 一度も受け取っていないときの予備(画面に入れた仮のデータ)
export function fallbackFeed() {
  return {
    version: 0, generatedAt: '', settings: { hours: DEFAULT_SETTINGS.hours, theme: DEFAULT_SETTINGS.theme, regular: DEFAULT_SETTINGS.regular },
    phrases: PHRASES, products: PRODUCTS, calendars: [], calendarState: {}, auto: { lastOkAt: '', alert: null }
  };
}

// 公開窓口から受け取る。新しい版なら端末に保存して返す。同じ版、または受け取れなかったら null
// 返り値の2つめは、受け取れたかどうか('new' | 'same' | 'offline' | 'none')
export async function fetchFeed(current) {
  if (!CONFIG.feedUrl) return [null, 'none'];
  try {
    const res = await fetch(`${CONFIG.feedUrl}?api=feed&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [null, 'offline'];
    const f = await res.json();
    if (!valid(f)) return [null, 'offline'];
    if (current && current.version === f.version && current.generatedAt === f.generatedAt) return [null, 'same'];
    ls.set(KEY, f);
    return [f, 'new'];
  } catch {
    return [null, 'offline'];
  }
}
