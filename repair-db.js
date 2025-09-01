// repair-db.js  — db.json の id / *Id / progress を数値へ正規化
const fs = require('fs');
const FILE = './db.json';
const BK = `./db.backup.${Date.now()}.json`;

const NUM_KEYS = new Set(['id','userid','bookid','departmentid','positionid','progress']);

const looksNum = v => typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v));

function fixKey(k, v) {
  const key = String(k).toLowerCase();
  if (key === 'date' || key.endsWith('date')) return v; // 日付は文字列のまま
  if (NUM_KEYS.has(key) || key.endsWith('id')) {
    return looksNum(v) ? Number(v) : v;
  }
  return v;
}

function normalize(node) {
  if (Array.isArray(node)) return node.map(normalize);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = (v && typeof v === 'object') ? normalize(v) : fixKey(k, v);
    }
    return out;
  }
  return node;
}

const raw = fs.readFileSync(FILE, 'utf8');
fs.writeFileSync(BK, raw); // 退避
const db = JSON.parse(raw);
for (const k of Object.keys(db)) db[k] = normalize(db[k]);
fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
console.log('✅ normalized. backup =>', BK);
