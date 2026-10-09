# 投稿ノート

洋菓子店のInstagram投稿(営業中・新作・駐車場・営業カレンダー)の画像を、えらぶだけで作るWebアプリ。

- 指示書:[docs/claude-code-prompt.md](docs/claude-code-prompt.md)(第2版。第1版は docs/old/)
- 技術構成の検討書:[docs/architecture-review.md](docs/architecture-review.md)

正しいデータはGoogleスプレッドシート1つで、裏側はGoogle Apps Script(`gas/`、これから作る)。この画面(GitHub Pages)は、GASの公開窓口から配信データを受け取って動く。今は段階1で、ひとこと・商品・お店の設定は `js/data.js` の仮のもの(「例」の印つき)を使う。

## 手元で動かす

```bash
python3 -m http.server 8000
```

ブラウザで http://localhost:8000 を開く。テストは http://localhost:8000/tests/ 、またはコマンドで `node tests/run.mjs`。

## ファイル

- `index.html` スタッフの画面 / `css/style.css` 見た目(管理ページも読む)
- `config.js` 画面側の設定ファイル(公開窓口と管理ページのURL)。秘密の情報は書かない
- `js/app.js` 画面の動き / `js/draw.js` 画像を描く処理(管理ページも読む)
- `js/text.js` 日付と文字の折り返し / `js/calendar.js` 営業カレンダーとお知らせの計算
- `js/store.js` 端末への保存 / `js/data.js` 仮のデータ
- `images/parking.jpg` お店で決めた駐車場の案内
- `tests/` 自動テスト
- `prototype-post-note.html` 参考にした試作版

## 秘密の情報について

このリポジトリは公開です。トークンなどの秘密の情報は、GASのスクリプトプロパティにだけ置き、ここには入れない。

## 直したものを公開するとき

ブラウザが古いファイルを覚えていて、新しい版と混ざらないように、ファイル名の後ろに版の番号(`?v=7`)をつけています。`js/` や `css/` や `config.js` を直したら、`index.html` と `js/*.js` の中の `?v=7` をすべて次の番号(`?v=8` など)に変えてから公開します。
