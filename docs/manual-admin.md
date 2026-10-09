# 投稿ノート 説明書(管理する人向け)

この文書には、秘密の値(トークンなど)を書きません。秘密の値は、GASのスクリプトプロパティにだけ置きます。なぜこの構成にしたかは [architecture-review.md](architecture-review.md) を見てください。

---

## 1. 全体の構成

| 部品 | 置き場所 | 役目 |
|---|---|---|
| スタッフの画面 | GitHub Pages(このリポジトリ) | 投稿の画像を作る。配信データで動く |
| 正しいデータ | Googleスプレッドシート「投稿ノート データ」 | ひとこと、商品、設定、カレンダー、予約、作業時間、動作記録 |
| 公開窓口と毎日の自動実行 | GASプロジェクト「投稿ノート」(`gas/`) | 配信データを渡す、作業時間を足す、カレンダーの画像を受けとる、1時間ごとの自動投稿と知らせ |
| 管理ページ | GASプロジェクト「投稿ノート 管理」(`gas-admin/`) | 登録と確認。開いた本人の権限で動く。**秘密の情報を置かない** |
| 画像の原本 | 持ち主のドライブのフォルダ「投稿ノート カレンダーの原本」(非公開) | 確認した画像の原本 |
| 投稿用の画像 | このリポジトリの `calendar/` | Instagramが取りに来る公開用の写し |
| Instagram | Metaの開発者アプリ(開発モード)+ Facebookページ + Instagramのプロアカウント | 営業カレンダーの自動投稿 |
| 知らせ | お店の中だけのLINE公式アカウント | 確認のお知らせ、失敗、期限 |

**ウェブアプリの公開の設定**

| | 実行するユーザー | アクセスできるユーザー | URLの置き場所 |
|---|---|---|---|
| 公開窓口(投稿ノート) | 自分(持ち主) | 全員 | `config.js` の `feedUrl` |
| 管理ページ(投稿ノート 管理) | アクセスしているユーザー | Googleアカウントを持つ全員 | `config.js` の `adminUrl` |

この設定は、それぞれの `appsscript.json` の `webapp` に書いてあります。

---

## 2. 手元の準備

```bash
npm install -g @google/clasp
```
```bash
clasp login
```

- GASのAPIをオンにする:https://script.google.com/home/usersettings
- `clasp login` で作られるログインの情報(ホームフォルダの `.clasprc.json`)は秘密です。リポジトリには入りません
- 各プロジェクトのフォルダ(`gas/`、`gas-admin/`)に `.clasp.json` が必要です。リポジトリには入れていないので、見本の `.clasp.json.example` を `.clasp.json` に写し、`scriptId` に、GASのエディタの「プロジェクトの設定」にある「スクリプトID」を入れます

---

## 3. コードを直して公開する

**先に必ず取りこむ**:GASが画像を置くたびに、リポジトリに変更(コミット)が増えます。手元から送る前に、取りこんでください。
```bash
git pull
```

### 画面(GitHub Pages)

1. `js/`、`css/`、`config.js` を直したら、版の番号を上げる:`index.html`・`js/*.js`・`sw.js`・`gas-admin/admin.html` の中の `?v=N` をすべて次の番号にし、`sw.js` の `VERSION` も同じ番号にする(README にも書いてあります)
2. テストを動かす(「8. テスト」)
3. コミットしてプッシュする。1〜2分で公開されます。GitHub Pagesは、ページを最大10分ほど覚えさせるので、すぐに出ないときは少し待ちます

### 公開窓口(投稿ノート)

```bash
cd gas && clasp push --force
```

コードを直したら、**同じURLのまま**公開し直します(公開し直さないと、ウェブアプリは古いコードのまま動きます)。`<ID>` は `config.js` の `feedUrl` の `/s/` と `/exec` のあいだの文字です。
```bash
clasp create-deployment -i <ID> -d "公開窓口"
```

`setupSheet`、`hourlyJob`、試しの関数など、エディタから実行するものは、push しただけで新しいコードになります。

### 管理ページ(投稿ノート 管理)

共通の部分(`gas/core/`、`gas/Config.js`、`gas/Sheet.js`)を写してから送ります。
```bash
sh tools/push-admin.sh
```
`<ID>` は `config.js` の `adminUrl` のもの。
```bash
cd gas-admin && clasp create-deployment -i <ID> -d "管理ページ"
```

`gas/core/` や `gas/Sheet.js` を直したときは、**両方のプロジェクト**を送って公開し直してください。

---

## 4. 設定欄(スクリプトプロパティ)

値はGASのエディタの「プロジェクトの設定」→「スクリプト プロパティ」で、持ち主が手で入れます。ここには名前だけを書きます。

### 投稿ノート(公開窓口)

| 名前 | 中身 | 秘密 |
|---|---|---|
| `META_PAGE_TOKEN` | Facebookページのアクセストークン | **秘密** |
| `GITHUB_TOKEN` | GitHubの細かい権限のトークン | **秘密** |
| `LINE_CHANNEL_TOKEN` | お店の中だけのLINE公式アカウントの、長期のチャネルアクセストークン | **秘密** |
| `GITHUB_TOKEN_EXPIRES` | GitHubのトークンが切れる日(`2027-10-10` の形)。30日前にLINEで知らせる | |
| `META_DATA_ACCESS_EXPIRES` | ページのトークンの「データアクセスの有効期限」(`2027-01-08` の形)。14日前にLINEで知らせる | |
| `FB_PAGE_ID` | FacebookページのID | |
| `IG_USER_ID` | InstagramのアカウントID(`check1_page` で調べられる) | |
| `GRAPH_VERSION` | Graph APIの版(`v26.0`) | |
| `GITHUB_REPO` | `持ち主/リポジトリ名` | |
| `GITHUB_BRANCH` | `main` | |
| `IMAGE_BASE_URL` | GitHub PagesのURL(最後に `/`)。画像のURLの頭と、LINEのリンクに使う | |
| `SHEET_ID` | シートのID(`setupSheet` が入れる) | |
| `DRIVE_FOLDER_ID` | 原本のフォルダのID(`setupSheet` が入れる) | |
| `ALLOW_TEST_POSTS` | `yes` のときだけ、試しの関数が動く。**お店のアカウントに移す前に消す** | |
| `TEST_BREAK_TOKEN` | 試しのとき、わざとトークンを使えなくする。ふだんは入れない | |

`LAST_OK_AT`、`TOKEN_BAD`、`LAST_DAILY`、`TOKEN_CHECKED_AT`、`LOG_DAY`、`SENT_…`、`TEST_…` は、コードが自動で書きます。手で直さないでください(`SENT_…` を消すと、その知らせがもう一度送られます)。

### 投稿ノート 管理(管理ページ)

| 名前 | 中身 |
|---|---|
| `SHEET_ID` | シートのID(投稿ノートと同じ) |
| `APP_URL` | GitHub PagesのURL(最後に `/`) |

秘密の情報は置きません。

---

## 5. 初めて作るとき(新しい持ち主のとき)

1. 「2. 手元の準備」をする
2. `gas/` で `clasp create-script --type standalone --title "投稿ノート" --rootDir .`。作ったときに `appsscript.json` が書きかわるので、`git checkout -- appsscript.json` で戻してから `clasp push --force`
3. 「投稿ノート」の設定欄に、`SHEET_ID` と `DRIVE_FOLDER_ID` 以外の値を入れる(「6〜8」で作るトークンなど)
4. エディタで `setupSheet` を実行する(シート、保護、入力規則、例、原本のフォルダ、編集の見はり、1時間ごとの自動実行を作る)。許可の画面が出たら、詳細 → 移動 → 許可
5. `clasp create-deployment -d "公開窓口"` で公開し、出たIDで `config.js` の `feedUrl` を直す
6. `gas-admin/` でも同じく作り(タイトルは「投稿ノート 管理」)、`appsscript.json` を戻してから `sh tools/push-admin.sh`。設定欄に `SHEET_ID` と `APP_URL` を入れ、`clasp create-deployment -d "管理ページ"` で公開し、`config.js` の `adminUrl` を直す
7. 画面の版の番号を上げて、プッシュする

トリガー(自動実行)は、作った人の権限で動きます。持ち主が変わったら、新しい持ち主が `setupSheet` を実行して作り直してください(古いトリガーは、古い持ち主のエディタの「トリガー」から消す)。

---

## 6. Meta(Instagramへの投稿)

**お店の本番のアカウントで試さないでください。** 試しは、テスト用のInstagramと仮のFacebookページで行います。

### 開発者アプリ

1. https://developers.facebook.com/ で「アプリを作成」
2. ユースケース:「**Instagramでメッセージとコンテンツを管理**」(と「ページのすべてを管理」)
3. ビジネスポートフォリオは、つながない
4. 「FacebookログインによるAPI設定」で「Add required content permissions」だけを押す(メッセージの権限は足さない)
5. 「公開」は押さない(**開発モード**のまま。役割を持つ人だけが使え、審査も毎年の確認もいりません)

### ページとInstagramをつなぐ

- Instagramをプロアカウント(ビジネスかクリエイター)にする
- Facebookページの「設定」→「リンク済みのアカウント」で、Instagramをつなぐ

### ページのトークンを作る(作り直すときも同じ)

1. https://developers.facebook.com/tools/explorer/ でアプリをえらび、「ユーザーアクセストークンを取得」
2. 権限:`pages_show_list`、`pages_read_engagement`、`instagram_basic`、`instagram_content_publish`
3. 「Generate Access Token」→ ページは「**現在のページのみ**」で、そのページだけ。Instagramもそのアカウントだけ
4. トークンの左の「ⓘ」→「アクセストークンツールで開く」→ いちばん下の「**アクセストークンを延長**」→ 出た60日のトークンをコピー
5. https://developers.facebook.com/tools/debug/accesstoken/ に60日のトークンを貼り、「詳細なスコープ」の数字(ページID)を見る
6. エクスプローラのトークンの欄に60日のトークンを入れ、`ページID?fields=name,access_token` を送信する。出た `access_token` がページのトークン(`me/accounts` は、ページを1つだけ選ぶと空になるので使わない)
7. デバッガーにページのトークンを貼り、**タイプが Page、有効期限が「なし」**であることを確かめる。「データアクセスの有効期限」の日付を `META_DATA_ACCESS_EXPIRES` に入れる
8. `META_PAGE_TOKEN` を新しいトークンにして、エディタで `check1_page` を実行して確かめる。メモしたトークンは消す

**90日の件**:ページのトークンにも「データアクセスの有効期限」(作ってから90日)がつきます。過ぎると使えなくなるおそれがあるので、14日前にLINEで知らせが届いたら、上の手順で作り直してください。週に1回、自動実行がトークンを試し、使えなければすぐ知らせます。

**Graph APIの版**:Metaの版には寿命があります(およそ2年)。https://developers.facebook.com/docs/graph-api/changelog/versions で期限を見て、2年に1度、`GRAPH_VERSION` を新しい版にします(2026年10月時点で v26.0)。

---

## 7. GitHub

### 細かい権限のトークン(1年ごとに作り直す)

1. https://github.com/settings/personal-access-tokens/new
2. 名前:`投稿ノート GAS 画像置き場`。期限:1年後(その日を `GITHUB_TOKEN_EXPIRES` に入れる)
3. Repository access:「Only select repositories」で、このリポジトリだけ
4. 「Add permissions」→「Contents」を「Read and write」(Metadata は自動で Read-only)。ほかは足さない
5. 作ったトークンを `GITHUB_TOKEN` に入れる。30日前にLINEで知らせが届きます

### 秘密の検出

リポジトリの Settings → Advanced Security で、「Secret Protection」と「Push protection」を有効にしておく(秘密の値をうっかり送ると止めてくれます)。

### GitHub Pages

Settings → Pages で、Source は「Deploy from a branch」、Branch は `main` / `(root)`。`.nojekyll` があるので、ファイルはそのまま公開されます。

---

## 8. LINE(お店の中だけの知らせ)

**お客さん向けのLINE公式アカウントでは、ぜったいに送らないでください。** 友だち全員あてに送るので、お客さんに届いてしまいます。必ず、お店の中だけのアカウントを別に作ります。

1. https://entry.line.biz/start/jp/ でLINE公式アカウントを作る(ビジネスマネージャーの組織は新しく作る)
2. LINE Official Account Manager(https://manager.line.biz/)の「設定」→「応答設定」で、応答メッセージをオフ
3. 「設定」→「Messaging API」→「Messaging APIを利用する」
4. https://developers.line.biz/console/ のチャネル →「Messaging API設定」→「チャネルアクセストークン(長期)」を発行し、`LINE_CHANNEL_TOKEN` に入れる
5. 同じ画面のQRコードで、知らせを受けとる人(シェフ、奥さん)が友だちになる
6. エディタで `testLineMessage` を実行して、届くか確かめる

無料プランは月200通です(宛先の人数で数えます)。上限を超えると送れません。ふだんは月に数通です。

---

## 9. QRコード(お店の裏に貼る)

1. パソコンのChromeでアプリを開く
2. アドレスの欄の右にある共有のボタン(またはアドレスの欄を右クリック)→「**QRコードを作成**」
3. 「ダウンロード」で画像を保存して、印刷する

URLが変わったとき(シェフの名義に移すときなど)は、作り直して貼りかえます。

---

## 10. テスト

**コマンドで**(日付の計算、文字の折り返し、データの検査、記録の受けつけ、予約の状態の移り方)
```bash
node tests/run.mjs
```

**ブラウザで**:手元でサーバーを動かして、http://localhost:8000/tests/ を開く(本物の書体での折り返しも確かめます)。
```bash
python3 -m http.server 8000
```

**GASで**(テスト用のInstagramで。設定欄の `ALLOW_TEST_POSTS` が `yes` のとき)

| 関数 | すること |
|---|---|
| `check0_settings` 〜 `check5_story` | 設定欄、ページ、GitHub、公開、フィードとストーリーズへの投稿の確かめ |
| `testLineMessage` | LINEに試しの知らせを送る |
| `testMakeReservationNow` | すぐに投稿の対象になる試しの予約を作る。そのあと `hourlyJob` |
| `testStuckPublishing` | 「投稿中」で止まった予約を作る。`hourlyJob` で「要確認」になり、投稿されない |
| `TEST_BREAK_TOKEN` = `yes` にしてから試しの予約 → `hourlyJob` | トークンが使えないときの知らせ |
| `testStartWeek` / `testStopWeek` | 毎日11時台に試しの予約を作る(1週間の試し)/止める |

**試しのあとの片づけ**
- シートの「予約」の、月が `TEST` の行を消す
- リポジトリの `calendar/test-…jpg` と `calendar/test-2026…` を消してプッシュする
- テスト用のInstagramの試しの投稿は、必要なら手で消す
- `testStopWeek` を実行する。`ALLOW_TEST_POSTS` と `TEST_BREAK_TOKEN` を消す

---

## 11. ふだんの点検

| いつ | すること |
|---|---|
| 知らせが届いたとき | LINEや画面の黄色い知らせのとおりにする |
| 約90日ごと(LINEで知らせが届く) | ページのトークンを作り直す(「6」) |
| 1年ごと(LINEで知らせが届く) | GitHubのトークンを作り直す(「7」) |
| 2年ごと | `GRAPH_VERSION` を新しい版にする(「6」) |
| ときどき | シートの「動作記録」に「失敗」が続いていないか見る |

---

## 12. よくある問題

| 起きること | 原因と直し方 |
|---|---|
| 管理ページで「このアカウントでは、お店のシートを開けません」 | シートが共有されていない。GASは、共有されていないシートを開くと処理をその場で打ち切る(try で受けとめられない)ので、画面の側で案内を出している |
| 管理ページで「読みこめませんでした」 | ブラウザに複数のGoogleアカウントでログインしていると起きる。1つだけにするか、プライベートブラウズで開く |
| 直したのにウェブアプリが変わらない | `clasp create-deployment -i <ID>` で公開し直していない |
| 画面が古いまま | 版の番号を上げ忘れた、またはGitHub Pagesの10分の覚え。版を上げてプッシュし、数分待つ |
| 「この内容でOK」で、画像を送れない | 公開窓口にドライブの許可がない(`setupSheet` をもう一度実行して許可する)、または合言葉がちがう(もう一度OKを押す) |
| 見出しの行を直せない | 持ち主しか直せない保護にしてある。直すときは持ち主で |

---

## 13. シェフの名義へ移す

シェフに、最後まで動く試作を通して使ってもらい、確認してもらってから移します。移すときにスタッフに影響するのは、**GitHubのURLが1回変わる**ことだけです。

### 移す順番

1. シェフを、Metaの開発者アプリ(アプリの役割 → 管理者)と、LINE公式アカウント(管理者)に追加する
2. シート「投稿ノート データ」、GASの2つのプロジェクト、原本のフォルダ「投稿ノート カレンダーの原本」と**その中のファイル**のオーナーを、シェフに譲渡する(ドライブで「共有」→ オーナーにする。シェフが承諾する)。フォルダのオーナーを移しても、中のファイルは移らないので、ひとつずつ移す
3. シェフが、手元の準備(「2」)をして、両方のプロジェクトで、公開し直す(新しい持ち主として `clasp create-deployment -d …`。URLが変わる)。シェフが `setupSheet` を実行して、トリガーを作り直す。古い持ち主のトリガーは消す
4. `config.js` の `feedUrl` と `adminUrl` を、新しいURLに直す
5. GitHubのリポジトリをシェフのアカウントへ譲る(Settings → Danger Zone → Transfer。シェフが承諾する)。GitHub Pagesを設定し直す。`IMAGE_BASE_URL`(投稿ノート)と `APP_URL`(投稿ノート 管理)と `config.js` の `appUrl` を、新しいURLに直す。新しいURLのQRコードを配り、古いURLにはしばらく移転先の案内を置く
6. シェフが、お店のFacebookページのトークン(「6」)と、GitHubのトークン(「7」)を作り、`FB_PAGE_ID`、`IG_USER_ID`、`META_PAGE_TOKEN`、`META_DATA_ACCESS_EXPIRES`、`GITHUB_TOKEN`、`GITHUB_TOKEN_EXPIRES`、`GITHUB_REPO` を差しかえる。**お店の本番のアカウントに投稿するのは、この時点から**
7. `ALLOW_TEST_POSTS` と `TEST_BREAK_TOKEN` を消し、`testStopWeek` を実行する
8. 10章の確認項目([checklist.md](checklist.md))を、もう一度通す
9. 制作者を、シートの共有、Metaの開発者アプリ、LINE公式アカウントから外し、古いトークンを無効にする(GitHubのトークンは削除、Metaはアプリの設定でアクセスを外す)

### 移行の練習

本番の前に、別の仮のアカウント(仮アカウント2)へ、上の順番で一度移してみます。移したあと、checklist.md の項目と、検証計画の1〜10をもう一度通せれば合格です。URLが変わったあとも、配り直したQRコードから全員が開けることを確かめます。

GitHub Pagesの古いURLは、自動では新しいURLに転送されない見込みです。練習のときに確かめて、結果をこの節に書き足してください。

### 連絡先

引き継いだあとに困ったときの連絡先:(制作者の連絡先を、ここに書く)
