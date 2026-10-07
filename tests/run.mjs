// コマンドで動かす: node tests/run.mjs
import { run } from './cases.js';

const results = run();
for (const r of results) {
  console.log(`${r.ok ? '○' : '×'} ${r.name}`);
  r.errors.forEach(e => console.log(`    ${e}`));
}
const bad = results.filter(r => !r.ok).length;
console.log(`\n${results.length}件中 ${results.length - bad}件 OK${bad ? `、${bad}件 まちがい` : ''}`);
process.exit(bad ? 1 : 0);
