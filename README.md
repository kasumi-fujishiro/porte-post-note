# 投稿ノート

洋菓子店のInstagram投稿(営業中・営業カレンダー・新作・駐車場)の画像を、えらぶだけで作るWebアプリ。

今は試作の段階1です。ひとこと・商品・お店の設定は、`js/data.js` の仮のもの(「例」の印つき)を使い、えらんだ内容は端末の中だけに保存します。

## 手元で動かす

```bash
python3 -m http.server 8000
```

ブラウザで http://localhost:8000 を開く。テストは http://localhost:8000/tests/ 、またはコマンドで `node tests/run.mjs`。

## ファイル

- `index.html` 画面 / `css/style.css` 見た目
- `js/app.js` 画面の動き / `js/draw.js` 画像を描く処理
- `js/text.js` 日付と文字の折り返し / `js/calendar.js` 営業カレンダーとお知らせの計算
- `js/store.js` 端末への保存 / `js/data.js` 仮のデータ
- `tests/` 自動テスト
- `prototype-post-note.html` 参考にした試作版 / `claude-code-prompt.md` 依頼の全体

## 直したものを公開するとき

ブラウザが古いファイルを覚えていて、新しい版と混ざらないように、ファイル名の後ろに版の番号(`?v=2`)をつけています。`js/` や `css/` を直したら、`index.html` と `js/*.js` の中の `?v=2` をすべて次の番号(`?v=3` など)に変えてから公開します。
