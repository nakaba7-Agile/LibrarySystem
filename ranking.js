/* ===== 設定 ===== */
const API = "http://localhost:4000";   // json-server のURL
const BAR_WIDTH_PX = 90;               // 棒の太さ（固定）
const GAP_PX       = 50;               // 棒と棒の間隔（固定）
const PADDING_PX   = 10;               // 左右パディング（px）

/* ===== 状態 ===== */
let RAW = { users: [], departments: [], positions: [], readings: [] };
let chart;

/* ===== Utils ===== */
const $ = (s)=>document.querySelector(s);
function setStatus(t){ $('#status').textContent=t||''; }
function toggleEmpty(show){ $('#empty').style.display = show ? 'block':'none'; }

function parseDate(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function between(dateStr, startStr, endStr){
  if(!startStr && !endStr) return true;
  const dt=parseDate(dateStr); if(!dt) return false;
  const s=parseDate(startStr); const e=parseDate(endStr);
  if(s && dt < s) return false;
  if(e){ const ee=new Date(e.getFullYear(),e.getMonth(),e.getDate(),23,59,59,999); if(dt>ee) return false; }
  return true;
}

// きりのいい上限に切り上げ（1,2,5,10系列）
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
  // x.offset=true なので、両端に半カテゴリ×2 = 1カテゴリ分の余白を足す
  const needed = CAT * (count + 1) + (PADDING_PX * 2);

  const inner  = document.getElementById('chartInner');
  const canvas = document.getElementById('mainCanvas');
  const wrap   = document.querySelector('.chart-wrap');

  inner.style.width = `${needed}px`;   // スクロール用の見かけの幅
  canvas.width  = needed;              // 内部ピクセル幅も“ちょうど”に
  canvas.height = wrap.clientHeight;   // 高さも同期
}

/* ===== Chart.js 初期化 ===== */
function ensureChart(){
  if(chart) return chart;
  const ctx = document.getElementById('mainCanvas').getContext('2d');
  chart = new Chart(ctx, {
    type:'bar',
    data:{ labels:[], datasets:[{
      label:'読書数',
      data:[],
      categoryPercentage:1.0,
      barPercentage:1.0,
      barThickness: BAR_WIDTH_PX,
      maxBarThickness: BAR_WIDTH_PX,
      borderWidth: 0
    }]},
    options:{
      responsive:false,
      maintainAspectRatio:false,
      animation:false,
      layout: { padding: { left: PADDING_PX, right: PADDING_PX, bottom: 28 } },
      scales:{
        x: {
          offset: true,                                  // 両端の見切れ防止
          grid: { display: false },
          ticks: { minRotation: 0, maxRotation: 0, autoSkip: false, font: { size: 16 } }
        },
        y: {
          beginAtZero: true,
          min: 0,
          suggestedMax: 10,                              // 基本は0〜10
          ticks: { stepSize: 1, precision: 0 },
          grid: { color: 'rgba(0,0,0,0.08)' },
          border: { display: false }
        }
      },
      plugins:{ legend:{ display:false } }
    }
  });
  return chart;
}

/* ===== データ取得 ===== */
async function fetchAll(){
  setStatus('取得中...');
  const [users,depts,poses,reads] = await Promise.all([
    fetch(`${API}/users`).then(r=>r.json()),
    fetch(`${API}/departments`).then(r=>r.json()),
    fetch(`${API}/positions`).then(r=>r.json()),
    fetch(`${API}/readings`).then(r=>r.json())
  ]);
  RAW={users,departments:depts,positions:poses,readings:reads};
  buildSelectors();
  render();
}

function buildSelectors(){
  const sd=$('#selDept'), sp=$('#selPos');
  sd.querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  sp.querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  RAW.departments.forEach(d=>{ let o=document.createElement('option'); o.value=d.id; o.textContent=d.name; sd.appendChild(o); });
  RAW.positions.forEach(p=>{ let o=document.createElement('option'); o.value=p.id; o.textContent=p.name; sp.appendChild(o); });
}

/* ===== 集計＆描画 ===== */
function render(){
  const deptId=$('#selDept').value?Number($('#selDept').value):null;
  const posId=$('#selPos').value?Number($('#selPos').value):null;
  const sd=$('#startDate').value, ed=$('#endDate').value;

  const users=RAW.users.filter(u=>{
    if(deptId && u.departmentId!==deptId) return false;
    if(posId && u.positionId!==posId) return false;
    return true;
  });
  const uids=new Set(users.map(u=>u.id));

  const reads=RAW.readings.filter(r=>uids.has(r.userId)&&between(r.date,sd,ed));
  const map=new Map();
  reads.forEach(r=>map.set(r.userId,(map.get(r.userId)||0)+1));

  // ※ 読書数0のユーザーは表示しない仕様（必要なら .filter を外す）
  const rows=users.map(u=>({name:u.name,count:map.get(u.id)||0}))
    .filter(r=>r.count>0)
    .sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ja'));

  const labels=rows.map(r=>r.name);
  const counts=rows.map(r=>r.count);

  setInnerWidth(labels.length);

  const c=ensureChart();

  // キャンバス解像度を変えたので、Chart.js にもサイズ変更を通知
  const cvs = document.getElementById('mainCanvas');
  c.resize(cvs.width, cvs.height);

  // データ反映
  c.data.labels=labels;
  c.data.datasets[0].data=counts;

  // --- Y軸：基本は0〜10、超えたら拡張 ---
  const maxVal = counts.length ? Math.max(...counts) : 0;
  const yopt = c.options.scales.y;
  yopt.min = 0;
  if (maxVal <= 10) {
    yopt.max = 10;
    yopt.suggestedMax = undefined;
    yopt.ticks.stepSize = 1;
  } else {
    const upper = niceCeil(maxVal);
    yopt.max = upper;
    yopt.suggestedMax = undefined;
    yopt.ticks.stepSize = Math.max(1, Math.round(upper / 10));
  }

  c.update();

  toggleEmpty(labels.length===0);
  setStatus(`表示人数:${labels.length}`);
}

/* ===== イベント ===== */
$('#btnReload').addEventListener('click', fetchAll);
$('#selDept').addEventListener('change', render);
$('#selPos').addEventListener('change', render);
$('#startDate').addEventListener('change', render);
$('#endDate').addEventListener('change', render);

// 初回
fetchAll().catch(e=>{
  console.error(e);
  setStatus('データ取得に失敗しました。json-server の起動を確認してください。');
});
