// ==== DOM取得ショートカット関数（最優先で定義）====
const $ = (s) => document.querySelector(s);

/* ===== 設定 ===== */
const API = "http://localhost:4000";
const BAR_WIDTH_PX = 45;
const GAP_PX       = 40;
const PADDING_PX   = 6;

// 自分（左端＆黒）
const MY_NAME = "窓辺あかり";
const MY_USER_ID = 6;

/* ===== 状態 ===== */
let RAW = { users: [], departments: [], positions: [], readings: [] };
let chart;
let allRows = [];


let currentPage = 0;      // 現在のページ（0スタート）
const BARS_PER_PAGE = 5;  // 1ページに表示する棒の数

$('#nextBtn').addEventListener('click', () => {
  const totalPages = Math.ceil(allRows.length / BARS_PER_PAGE);
  if (currentPage < totalPages - 1) {
    currentPage++;
    render(); // 再描画
  }
});

$('#prevBtn').addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    render(); // 再描画
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
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < data.length; i++) {
      const el = meta.data[i];
      if (!el) continue;
      const value = data[i];
      const isMine = labels[i] === MY_NAME;
      const centerY = (el.y + el.base) / 2;
      ctx.fillStyle = isMine ? '#fff' : '#666';
      ctx.fillText(`${value}冊`, el.x, centerY);
    }
    ctx.restore();
  }
};

/* ===== Utils ===== */
// const $ = (s)=>document.querySelector(s);
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

/* ===== 内部幅（横スクロール用） ===== */
function setInnerWidth(count){
  const CAT = BAR_WIDTH_PX + GAP_PX;
  const needed = CAT * (count + 1) + (PADDING_PX * 2); // x.offset=true を考慮
  const inner  = $('#chartInner');
  const canvas = $('#mainCanvas');
  const wrap   = $('.chart-inner');
  if (inner) inner.style.width = `${needed}px`;
  canvas.width  = needed;
  canvas.height = wrap ? wrap.clientHeight : canvas.height;
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
      backgroundColor: [],            // renderで設定
      userMeta: [],                   // ツールチップ用
      borderRadius: 10,
      borderSkipped: false,
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
          grid:   { display: false, drawBorder: false },
          border: { display: false },
          ticks:  { minRotation: 0, maxRotation: 0, autoSkip: false, font: { size: 13 }, padding: 16, display: true }
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

/* ===== 親へ“当月の自分の冊数”を通知（任意） ===== */
function postMonthlyCountToParent() {
  // 月（未選択なら本日）
  let ym = $('#month')?.value;
  if (!ym) {
    const t = new Date();
    ym = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;
  }
  const { start: sd, end: ed } = monthToRange(ym);

  // 自分（ID/名前・型は文字列で比較）
  const me = RAW.users.find(u => String(u.id) === String(MY_USER_ID)) 
          || RAW.users.find(u => u.name === MY_NAME);
  if (!me) return;

  const myCompleted = RAW.readings.filter(r =>
    String(r.userId) === String(me.id) &&
    between(r.date, sd, ed) &&
    Number(r.progress ?? 0) >= 100
  );

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
    buildSelectors();

    // ★ 初期月＝本日が属する年月
    const t = new Date();
    $('#month').value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;

    render();
    postMonthlyCountToParent();

  } catch (e) {
    console.error('取得失敗', e);
  }
}

function buildSelectors(){
  const selDept=$('#selDept'), selPos=$('#selPos');
  selDept.querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  selPos .querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  // 値は文字列で入れる（型統一）
  RAW.departments.forEach(d=>{ let o=document.createElement('option'); o.value=String(d.id); o.textContent=d.name; selDept.appendChild(o); });
  RAW.positions  .forEach(p=>{ let o=document.createElement('option'); o.value=String(p.id); o.textContent=p.name; selPos.appendChild(o); });
}

/* ===== 集計＆描画（progress==100のみ・IDは文字列キー一致） ===== */
function render(){
  // セレクト値は文字列で受ける
  const deptId=$('#selDept').value || null;
  const posId=$('#selPos').value || null;

  // 月（空なら本日でフォールバック）
  let ym = $('#month').value;
  if (!ym) {
    const t = new Date();
    ym = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;
  }
  const { start: sd, end: ed } = monthToRange(ym);

  // ユーザーフィルタ（型は文字列で比較）
  let users = RAW.users.filter(u=>{
    if (deptId && String(u.departmentId) !== String(deptId)) return false;
    if (posId  && String(u.positionId)  !== String(posId) ) return false;
    return true;
  });

  // 本人は必ず候補に含める（0冊なら後で落ちる）
  const me = RAW.users.find(u => String(u.id) === String(MY_USER_ID) || u.name === MY_NAME);
  if (me && !users.some(u => String(u.id) === String(me.id))) users = [me, ...users];

  // IDは文字列キーで扱う
  const uids=new Set(users.map(u=>String(u.id)));

  // 完了のみ
  const reads = RAW.readings.filter(
    r => uids.has(String(r.userId)) &&
         between(r.date, sd, ed) &&
         Number(r.progress ?? 0) >= 100
  );

  // userId(文字列)→冊数
  const map=new Map();
  reads.forEach(r=>{
    const k = String(r.userId);
    map.set(k,(map.get(k)||0)+1);
  });

  // id→部門/役職名（キーは文字列）
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

  // 0冊は全員除外
  rows = rows.filter(r => r.count > 0);

  // ✅ 自分を先頭に移動
  rows.sort((a, b) => {
    const isAme = String(a.id) === String(MY_USER_ID) || a.name === MY_NAME;
    const isBme = String(b.id) === String(MY_USER_ID) || b.name === MY_NAME;
    if (isAme && !isBme) return -1; // aが自分 → 先頭
    if (!isAme && isBme) return 1;  // bが自分 → 先頭
    return b.count - a.count;       // 残りは読書数の多い順
  });


  // ✅ グローバルに保存（自分も含めて）
  allRows = rows;

  // ⛔ ここから先を上書きします（現在のページ計算など）
  const meRow = rows.find(r => String(r.id) === String(MY_USER_ID) || r.name === MY_NAME);
  const others = rows.filter(r => String(r.id) !== String(MY_USER_ID) && r.name !== MY_NAME);

  // ページングは他人だけ
  const totalPages = Math.ceil(others.length / (BARS_PER_PAGE - 1));
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;

  // 今のページの他人だけ
  const startIdx = currentPage * (BARS_PER_PAGE - 1);
  const endIdx = startIdx + (BARS_PER_PAGE - 1);
  const pageRows = others.slice(startIdx, endIdx);

  // ✅ 描画用のデータ：先頭に自分、その後に他人
  const finalRows = meRow ? [meRow, ...pageRows] : [...pageRows];

  const labels   = finalRows.map(r => r.name);
  const counts   = finalRows.map(r => r.count);
  const colors   = finalRows.map(r => (String(r.id) === String(MY_USER_ID) || r.name === MY_NAME) ? '#000000' : '#dedcdcff');
  const userMeta = finalRows.map(r => ({ dept: r.dept, pos: r.pos }));

  setInnerWidth(labels.length);


  const c = ensureChart();
  const cvs = $('#mainCanvas');
  c.resize(cvs.width, cvs.height);

  c.data.labels = labels;
  c.data.datasets[0].data = counts;
  c.data.datasets[0].backgroundColor = colors;
  c.data.datasets[0].userMeta = userMeta;

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
  toggleEmpty(labels.length === 0);

  $('#prevBtn').disabled = (currentPage === 0);
  $('#nextBtn').disabled = (currentPage >= totalPages - 1);

  postMonthlyCountToParent();
}

/* ===== イベント ===== */
$('#selDept').addEventListener('change', render);
$('#selPos').addEventListener('change', render);
$('#month').addEventListener('change', () => {
  const ym = $('#month').value;
  window.parent?.postMessage({ type:'month-change', ym }, '*');
  render();
});

/* ===== 初回 ===== */
fetchAll();
