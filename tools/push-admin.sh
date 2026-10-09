#!/bin/sh
# 管理ページのプロジェクト(gas-admin)に、共通の部分を写してから、GASに送る。
# 共通の部分:gas/core/(検査など)、gas/Config.js(設定欄の読み出し)、gas/Sheet.js(シートの読み書き)
set -e
cd "$(dirname "$0")/.."
rm -rf gas-admin/shared
mkdir -p gas-admin/shared/core
cp gas/core/*.js gas-admin/shared/core/
cp gas/Config.js gas/Sheet.js gas-admin/shared/
cd gas-admin && clasp push --force
