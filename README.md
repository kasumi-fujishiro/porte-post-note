# 投稿ノート

洋菓子店のInstagram投稿(営業中・新作・駐車場・営業カレンダー)の画像を、えらぶだけで作るWebアプリ。

- 指示書:[docs/claude-code-prompt.md](docs/claude-code-prompt.md)(第2版。第1版は docs/old/)
- 技術構成の検討書:[docs/architecture-review.md](docs/architecture-review.md)
- 説明書:お店の人向け(`manual.html`。アプリの「使い方」から開ける)、[管理する人向け](docs/manual-admin.md)
- できあがりの確認:[docs/checklist.md](docs/checklist.md)
- データのやり取り(ER図と窓口):[docs/data-model.md](docs/data-model.md)

正しいデータはGoogleスプレッドシート1つで、裏側はGoogle Apps Script(`gas/`)。この画面(GitHub Pages)は、GASの公開窓口から配信データを受け取って動く。

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
- `js/store.js` 端末への保存 / `js/data.js` 配信データが届かないときの予備
- `js/feed.js` 配信データを受け取る / `js/logqueue.js` 作業時間を送る
- `sw.js` 電波がないときのために、画面のファイルを端末に保存する
- `gas/` 裏側(GAS)。`gas/core/` はGASに頼らない部分で、Node.jsでテストする
- `manual.html` お店の人向けの説明書
- `images/parking.jpg` お店で決めた駐車場の案内
- `tests/` 自動テスト
- `prototype-post-note.html` 参考にした試作版

## 秘密の情報について

このリポジトリは公開です。トークンなどの秘密の情報は、GASのスクリプトプロパティにだけ置き、ここには入れない。

## 直したものを公開するとき

ブラウザが古いファイルを覚えていて、新しい版と混ざらないように、ファイル名の後ろに版の番号(`?v=12`)をつけています。`js/` や `css/` や `config.js` を直したら、`index.html`・`js/*.js`・`sw.js`・`gas-admin/admin.html` の中の `?v=12` をすべて次の番号(`?v=13` など)に変え、`sw.js` の `VERSION` も同じ番号(`v13`)にしてから公開します。サービスワーカー(`sw.js`)が古いファイルを消して、次に開いたときに全員が新しい版になります。
