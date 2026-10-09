// 画面側の設定ファイル。URLはここにだけ書く(持ち主を移すときは、このファイルを直す)。
// 秘密の情報は、ここに書かない(このファイルは、だれでも見られる)。
export const CONFIG = {
  // GASの公開窓口のURL(ウェブアプリ「公開窓口」の /exec で終わるURL)。空のときは、画面に入れた仮データで動く
  feedUrl: 'https://script.google.com/macros/s/AKfycbxYNtqMDJETEIBpuw2QczMPx7MLYcFmWIOMPaDIe6OJCvSQAGEz_pEhsvQQwjNe_CPHXQ/exec',
  // GASの管理ページのURL(ウェブアプリ「管理ページ」の /exec で終わるURL)。空のときは「準備中」と出す
  adminUrl: 'https://script.google.com/macros/s/AKfycbxJ0kzfZKKPAx3azZk-IMKpkJooPQeIFP7Ql0F5frCTnOI2MnBrpQuIFxVTI39gnNeT/exec',
  // このアプリのURL
  appUrl: 'https://kasumi-fujishiro.github.io/porte-post-note/'
};
