/* ===== 設定 ===== */
const API = "http://localhost:4000";   // json-server のURL
const BAR_WIDTH_PX = 45;               // 棒の太さ
const GAP_PX       = 40;               // 棒間隔
const PADDING_PX   = 6;                // 左右パディング

// ★ 自分の表示名（左端・黒で表示）
const MY_NAME = "窓辺あかり";

/* ===== 状態 ===== */
let RAW = { users: [], departments: [], positions: [], readings: [] };
let chart;

/* ===== 値ラベル描画プラグイン ===== */
// バーの中（高さが足りなければ上）に「n冊」を描画
const valueLabelPlugin = {
  id: 'valueLabel',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const data = chart.data.datasets[0].data;
    const labels = chart.data.labels;

    ctx.save();
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < data.length; i++) {
      const el = meta.data[i];
      if (!el) continue;
      const value = data[i];
      const isMine = labels[i] === MY_NAME;

      const barTopY  = el.y;
      const barBaseY = el.base;
      const centerY  = (barTopY + barBaseY) / 2;   // ← 棒の中央

      const text = `${value}冊`;
      ctx.fillStyle = isMine ? '#fff' : '#666';
      ctx.fillText(text, el.x, centerY);
    }
    ctx.restore();
  }
};

/* ===== Utils ===== */
const $ = (s)=>document.querySelector(s);
function toggleEmpty(show){ const el=$('#empty'); if(el) el.style.display = show ? 'block':'none'; }

function parseDate(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function between(dateStr, startStr, endStr){
  if(!startStr && !endStr) return true;
  const dt=parseDate(dateStr); if(!dt) return false;
  const s=parseDate(startStr); const e=parseDate(endStr);
  if(s && dt < s) return false;
  if(e){ const ee=new Date(e.getFullYear(),e.getMonth(),e.getDate(),23,59,59,999); if(dt>ee) return false; }
  return true;
}

// 月（YYYY-MM）→ 開始・終了（YYYY-MM-DD文字列）
function monthToRange(ym) {
  if (!ym) return { start: "", end: "" };
  const [y,m] = ym.split('-').map(Number);
  const start = new Date(y, m-1, 1);
  const end   = new Date(y, m, 0);
  const pad = n => String(n).padStart(2,'0');
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`,
    end:   `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}`
  };
}

// きりのいい上限（1,2,5,10 系列）
function niceCeil(v) {
  if (v <= 10) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  let m = 10;
  if (n <= 1) m = 1;
  else if (n <= 2) m = 2;
  else if (n <= 5) m = 5;
  return m * pow;
}

/* ===== 内部幅（スクロール領域＋キャンバス解像度） ===== */
function setInnerWidth(count){
  const CAT = BAR_WIDTH_PX + GAP_PX;
  const needed = CAT * (count + 1) + (PADDING_PX * 2); // x.offset=true を考慮

  const inner  = $('#chartInner');
  const canvas = $('#mainCanvas');
  const wrap   = $('.chart-inner');     // ← 枠内のスクロール領域の高さに合わせる

  if (inner) inner.style.width = `${needed}px`;
  canvas.width  = needed;
  canvas.height = wrap ? wrap.clientHeight : canvas.height;
}

/* ===== Chart.js 初期化 ===== */
function ensureChart(){
  if(chart) return chart;
  const ctx = $('#mainCanvas').getContext('2d');
  chart = new Chart(ctx, {
    type:'bar',
    data:{ labels:[], datasets:[{
      label:'読書数',
      data:[],
      categoryPercentage:1.0,
      barPercentage:1.0,
      barThickness: BAR_WIDTH_PX,
      maxBarThickness: BAR_WIDTH_PX,
      backgroundColor: [],       // ← 自分だけ黒にするため配列で指定（renderでセット）
      borderRadius: 10,
      borderSkipped: false,      // 下の角も含めて丸める
      borderWidth: 0
    }]},
    options:{
      responsive:false,
      maintainAspectRatio:false,
      animation:false,
      layout: { padding: { left: 6, right: PADDING_PX, bottom: 8 } },
      scales:{
        x: {
          offset: true,
          grid: { display: false, drawBorder: false },
          border: { display: false },             // 下の基準線を消す
          ticks: { minRotation: 0, maxRotation: 0, autoSkip: false, font: { size: 13 }, padding: 16, display: true }
        },
        y: {
          beginAtZero: true,
          min: 0,
          suggestedMax: 10,                       // 基本は10
          display: false,                         // 縦軸非表示
          grid: { drawBorder: false },
          border: { display: false }
        }
      },
      plugins:{ legend:{ display:false }, tooltip:{ enabled:true } }
    },
    plugins: [valueLabelPlugin]                    // ★ ラベル描画プラグイン
  });
  return chart;
}

/* ===== データ取得 ===== */
async function fetchAll(){
  try {
    const [users,depts,poses,reads] = await Promise.all([
      fetch(`${API}/users`).then(r=>r.json()),
      fetch(`${API}/departments`).then(r=>r.json()),
      fetch(`${API}/positions`).then(r=>r.json()),
      fetch(`${API}/readings`).then(r=>r.json())
    ]);
    RAW={users,departments:depts,positions:poses,readings:reads};
    buildSelectors();
    // デフォルト：当月
    const m = $('#month');
    if (!m.value){
      const today = new Date();
      const ym = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
      m.value = ym;
    }
    render();
  } catch (e) {
    console.error('データ取得に失敗しました。json-server の起動/ポート/CORS を確認してください。', e);
  }
}

function buildSelectors(){
  const selDept=$('#selDept'), selPos=$('#selPos');
  selDept.querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  selPos .querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  RAW.departments.forEach(d=>{ let o=document.createElement('option'); o.value=d.id; o.textContent=d.name; selDept.appendChild(o); });
  RAW.positions  .forEach(p=>{ let o=document.createElement('option'); o.value=p.id; o.textContent=p.name; selPos.appendChild(o); });
}

/* ===== 集計＆描画 ===== */
function render(){
  const deptId=$('#selDept').value?Number($('#selDept').value):null;
  const posId=$('#selPos').value?Number($('#selPos').value):null;

  // 月→期間に変換
  const ym = $('#month').value;
  const { start: sd, end: ed } = monthToRange(ym);

  // ① まず通常のフィルタ
  let users = RAW.users.filter(u=>{
    if (deptId && u.departmentId !== deptId) return false;
    if (posId  && u.positionId  !== posId ) return false;
    return true;
  });

  // ② 本人だけはフィルタから“除外”して必ず含める
  const me = RAW.users.find(u => u.name === MY_NAME);
  if (me && !users.some(u => u.id === me.id)) {
    users = [me, ...users];   // 先頭に差し込む（この後のロジックでも最左に固定）
  }

  const uids=new Set(users.map(u=>u.id));

  const reads=RAW.readings.filter(r=>uids.has(r.userId)&&between(r.date,sd,ed));
  const map=new Map();
  reads.forEach(r=>map.set(r.userId,(map.get(r.userId)||0)+1));

  // --- (4)の要件 ---
  // 1) 全員を作る
  let rows = users.map(u => ({ name: u.name, count: map.get(u.id) ?? 0 }));
  // 2) 自分（MY_NAME）は0冊でも残す。他は0冊を除外（必要ならこの行を外す）
  rows = rows.filter(r => r.count > 0 || r.name === MY_NAME);
  // 3) 読書数降順 → 名前昇順
  rows.sort((a,b)=> b.count - a.count || a.name.localeCompare(b.name,'ja'));
  // 4) 自分を先頭へ
  const mineIdx = rows.findIndex(r => r.name === MY_NAME);
  if (mineIdx > -1) {
    const mine = rows.splice(mineIdx, 1)[0];
    rows = [mine, ...rows];
  }

  const labels = rows.map(r => r.name);
  const counts = rows.map(r => r.count);
  const colors = rows.map(r => r.name === MY_NAME ? '#b0a8a8ff' : '#dedcdcff'); // 自分は黒

  // スクロール用の幅とキャンバス解像度を調整
  setInnerWidth(labels.length);

  const c = ensureChart();
  const cvs = $('#mainCanvas');
  c.resize(cvs.width, cvs.height);

  // データ反映
  c.data.labels = labels;
  c.data.datasets[0].data = counts;
  c.data.datasets[0].backgroundColor = colors;

  // Y軸：基本0〜10、超えたら拡張
  const maxVal = counts.length ? Math.max(...counts) : 0;
  const yopt = c.options.scales.y;
  yopt.min = 0;
  if (maxVal <= 10) {
    yopt.max = 10;
    yopt.suggestedMax = undefined;
  } else {
    const upper = niceCeil(maxVal);
    yopt.max = upper;
    yopt.suggestedMax = undefined;
  }

  c.update();
  toggleEmpty(labels.length===0);
}

/* ===== イベント ===== */
$('#selDept').addEventListener('change', render);
$('#selPos').addEventListener('change', render);
$('#month').addEventListener('change', render);

// 初回
fetchAll();
