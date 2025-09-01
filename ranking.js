// ==== DOM取得ショートカット関数（最優先で定義）====
const $ = (s) => document.querySelector(s);

/* ===== 設定 ===== */
const API = "http://localhost:4000";
const BAR_WIDTH_PX = 75;
const GAP_PX       = 40;
const PADDING_PX   = 6;

// 自分（左端＆黒）
let MY_NAME = "";
let MY_USER_ID = parseInt(localStorage.getItem('loginUserId')); // ログインユーザーID

if (MY_USER_ID) {
  fetch(`${API}/users/${MY_USER_ID}`)
    .then(res => res.json())
    .then(user => {
      MY_NAME = user?.name || "";
      fetchAll();
    })
    .catch(()=> fetchAll());
} else {
  // 未ログイン（念のため起動）
  fetchAll();
}

/* ===== 状態 ===== */
let RAW = { users: [], departments: [], positions: [], readings: [] };
let chart;
let allRows = [];

let currentPage = 0;      // 現在のページ（0スタート）
const BARS_PER_PAGE = 5;  // 1ページに表示する棒の数

$('#nextBtn')?.addEventListener('click', () => {
  const totalPages = Math.ceil(allRows.length / BARS_PER_PAGE);
  if (currentPage < totalPages - 1) {
    currentPage++;
    render();
  }
});

$('#prevBtn')?.addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    render();
  }
});

/* ===== 値ラベル（棒の中央に “n冊”） ===== */
const valueLabelPlugin = {
  id: 'valueLabel',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta   = chart.getDatasetMeta(0);
    const data   = chart.data.datasets[0].data;
    const labels = chart.data.labels;

    ctx.save();
    ctx.font = '18px system-ui, -apple-system, Segoe UI, Roboto, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < data.length; i++) {
      const el = meta.data[i];
      if (!el) continue;

      const value = data[i];
      const label = labels[i];
      if (!label || label.trim() === '') continue; // ダミー棒は無視

      const isMine = label === MY_NAME;
      const centerY = (el.y + el.base) / 2;
      ctx.fillStyle = isMine ? '#fff' : '#171717';
      ctx.fillText(`${value}冊`, el.x, centerY);
    }
    ctx.restore();
  }
};

/* ===== Utils ===== */
function toggleEmpty(show){
  const el=$('#empty');
  if(el) el.style.display = show ? 'flex':'none';
}
function parseDate(s){ if(!s) return null; const [y,m,d]=String(s).split('-').map(Number); return new Date(y,m-1,d); }
function between(dateStr, startStr, endStr){
  if(!startStr && !endStr) return true;
  const dt=parseDate(dateStr); if(!dt) return false;
  const s=parseDate(startStr); const e=parseDate(endStr);
  if(s && dt < s) return false;
  if(e){ const ee=new Date(e.getFullYear(),e.getMonth(),e.getDate(),23,59,59,999); if(dt>ee) return false; }
  return true;
}
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

/* ===== Chart.js ===== */
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
      backgroundColor: [],
      userMeta: [],
      borderRadius: 10,
      borderSkipped: false,
      borderWidth: 0
    }]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout: { padding: { left: 6, right: PADDING_PX, bottom: 8 } },
      scales:{
        x: {
          offset: true,
          grid:   { display: false, drawBorder: false },
          border: { display: false },
          ticks:  { minRotation: 0, maxRotation: 0, autoSkip: false, font: { size: 15 }, padding: 16, display: true }
        },
        y: {
          beginAtZero: true,
          min: 0,
          suggestedMax: 10,
          display: false,
          grid:   { drawBorder: false },
          border: { display: false }
        }
      },
      plugins:{
        legend:{ display:false },
        tooltip:{
          enabled: true,
          callbacks: {
            title(items){
              const i = items[0].dataIndex;
              const ch = items[0].chart;
              const name = ch.data.labels[i];
              const cnt  = ch.data.datasets[0].data[i];
              return `${name}：${cnt}冊`;
            },
            label(item){
              const i = item.dataIndex;
              const meta = item.chart.data.datasets[0].userMeta?.[i];
              if (!meta) return '';
              return `${meta.dept}／${meta.pos}`;
            }
          }
        }
      }
    },
    plugins: [valueLabelPlugin]
  });
  return chart;
}

/* ===== 親へ“当月の自分の冊数”を通知（堅牢版） ===== */
function postMonthlyCountToParent() {
  // 選択中の月（未選択なら今日）
  let ym = $('#month')?.value;
  if (!ym) {
    const t = new Date();
    ym = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;
  }
  const { start: sd, end: ed } = monthToRange(ym);

  // ★ users に依存せず、userId だけで判定
  const myIdStr = String(MY_USER_ID);
  const myCompleted = RAW.readings.filter(r =>
    String(r.userId) === myIdStr &&
    between(r.date, sd, ed) &&
    Number(r.progress ?? 0) >= 100
  );

  // 同じ本は 1 冊として数える
  const count = new Set(myCompleted.map(r => r.bookId)).size;
  window.parent?.postMessage({ type:'monthly-count', ym, count }, '*');
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

    // 初期月＝今日
    const t = new Date();
    const monthEl = $('#month');
    if (monthEl) monthEl.value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;

    buildSelectors();
    render();
    postMonthlyCountToParent();
  } catch (e) {
    console.error('取得失敗', e);
  }
}

function buildSelectors(){
  const selDept=$('#selDept'), selPos=$('#selPos');
  if (!selDept || !selPos) return;
  selDept.querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  selPos .querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  RAW.departments.forEach(d=>{ let o=document.createElement('option'); o.value=String(d.id); o.textContent=d.name; selDept.appendChild(o); });
  RAW.positions  .forEach(p=>{ let o=document.createElement('option'); o.value=String(p.id); o.textContent=p.name; selPos.appendChild(o); });
}

/* ===== 集計＆描画（progress==100のみ） ===== */
function render(){
  const selDept=$('#selDept'), selPos=$('#selPos'), monthEl=$('#month');
  const deptId=selDept ? selDept.value || null : null;
  const posId =selPos  ? selPos.value  || null : null;

  // 月（空なら今日）
  let ym = monthEl?.value;
  if (!ym) {
    const t = new Date();
    ym = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;
  }
  const { start: sd, end: ed } = monthToRange(ym);

  // ユーザーフィルタ
  let users = RAW.users.filter(u=>{
    if (deptId && String(u.departmentId) !== String(deptId)) return false;
    if (posId  && String(u.positionId)  !== String(posId) ) return false;
    return true;
  });

  // 本人は必ず候補に含める（0冊なら後で落ちる）
  const me = RAW.users.find(u => String(u.id) === String(MY_USER_ID) || u.name === MY_NAME);
  if (me && !users.some(u => String(u.id) === String(me.id))) users = [me, ...users];

  const uids=new Set(users.map(u=>String(u.id)));

  // 完了のみ
  const reads = RAW.readings.filter(
    r => uids.has(String(r.userId)) &&
         between(r.date, sd, ed) &&
         Number(r.progress ?? 0) >= 100
  );

  // userId → 冊数
  const map=new Map();
  reads.forEach(r=>{
    const k = String(r.userId);
    map.set(k,(map.get(k)||0)+1);
  });

  // 部署/役職名
  const deptById = new Map(RAW.departments.map(d => [String(d.id), d.name]));
  const posById  = new Map(RAW.positions.map(p => [String(p.id), p.name]));

  // rows
  let rows = users.map(u => {
    const key = String(u.id);
    return {
      id: key,
      name: u.name,
      count: map.get(key) ?? 0,
      dept: deptById.get(String(u.departmentId)) || '',
      pos:  posById.get(String(u.positionId))  || ''
    };
  });

  // 0冊は除外
  rows = rows.filter(r => r.count > 0);

  // 自分を先頭、それ以外は降順
  rows.sort((a, b) => {
    const isAme = String(a.id) === String(MY_USER_ID) || a.name === MY_NAME;
    const isBme = String(b.id) === String(MY_USER_ID) || b.name === MY_NAME;
    if (isAme && !isBme) return -1;
    if (!isAme && isBme) return 1;
    return b.count - a.count;
  });

  allRows = rows;

  const meRow = rows.find(r => String(r.id) === String(MY_USER_ID) || r.name === MY_NAME);
  const others = rows.filter(r => String(r.id) !== String(MY_USER_ID) && r.name !== MY_NAME);

  // ページングは他人だけ（自分 + 4人 = 5本）
  const totalPages = Math.ceil(others.length / (BARS_PER_PAGE - 1)) || 1;
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;

  const startIdx = currentPage * (BARS_PER_PAGE - 1);
  const endIdx = startIdx + (BARS_PER_PAGE - 1);
  const pageRows = others.slice(startIdx, endIdx);

  let finalRows = meRow ? [meRow, ...pageRows] : [...pageRows];

  // 足りない分はダミー（透明）で埋める
  while (finalRows.length < BARS_PER_PAGE) {
    finalRows.push({ id:'', name:'', count:0, dept:'', pos:'' });
  }

  const labels   = finalRows.map(r => r.name);
  const counts   = finalRows.map(r => r.count);
  const colors   = finalRows.map(r => r.name === '' ? 'transparent' :
    
                                 (String(r.id) === String(MY_USER_ID) || r.name === MY_NAME) ? '#1FB9EF' : '#ACE9FF');
  const userMeta = finalRows.map(r => ({ dept: r.dept, pos: r.pos }));

  const c = ensureChart();
  c.data.labels = labels;
  c.data.datasets[0].data = counts;
  c.data.datasets[0].backgroundColor = colors;
  c.data.datasets[0].userMeta = userMeta;

  const maxVal = counts.length ? Math.max(...counts) : 0;
  const yopt = c.options.scales.y;
  yopt.min = 0;
  if (maxVal <= 10) { yopt.max = 10; yopt.suggestedMax = undefined; }
  else { const upper = niceCeil(maxVal); yopt.max = upper; yopt.suggestedMax = undefined; }

  c.update();
  toggleEmpty(labels.length === 0);

  $('#prevBtn') && ($('#prevBtn').disabled = (currentPage === 0));
  $('#nextBtn') && ($('#nextBtn').disabled = (currentPage >= totalPages - 1));

  // 親へ冊数通知
  postMonthlyCountToParent();
}

/* ===== 親(ホーム) からの再集計依頼に応答 ===== */
window.addEventListener("message", async (e) => {
  const data = e?.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "request-monthly-count") {
    try {
      RAW.readings = await fetch(`${API}/readings`).then(r => r.json());
      render();
      postMonthlyCountToParent();
    } catch (err) {
      console.error("recalc monthly-count failed:", err);
    }
  }
});

/* ===== イベント ===== */
$('#selDept')?.addEventListener('change', render);
$('#selPos') ?.addEventListener('change', render);
$('#month')  ?.addEventListener('change', () => {
  const ym = $('#month').value;
  window.parent?.postMessage({ type:'month-change', ym }, '*');
  render();
});
