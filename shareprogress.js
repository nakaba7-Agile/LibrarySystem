// ==== DOM取得ショートカット ====
const $ = (s) => document.querySelector(s);

/* ===== 設定 ===== */
const API = "http://localhost:4000";
const BAR_WIDTH_PX = 75;
const PADDING_PX   = 6;
const BARS_PER_PAGE = 5;

// 自分（黒棒＆ラベルは「自分」）
let MY_USER_ID = parseInt(localStorage.getItem('loginUserId')) || null;
let MY_NAME = "";

// 状態
let RAW = { users:[], departments:[], positions:[], books:[], readings:[] };
let chart;
let currentPage = 0;
let allRows = []; // 並び替え後の全行（ページング用）

/* ===== 値ラベル（％） ===== */
const valueLabelPlugin = {
  id: 'valueLabel',
  afterDatasetsDraw(c) {
    const ctx = c.ctx;
    const meta = c.getDatasetMeta(0);
    const data = c.data.datasets[0].data;
    const labels = c.data.labels;
    ctx.save();
    ctx.font = '15px system-ui, -apple-system, Segoe UI, Roboto, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i=0;i<data.length;i++){
      const el = meta.data[i];
      if (!el) continue;
      const val = data[i];
      const label = labels[i];
      if (!label || label.trim() === '') continue; // ダミー無視
      const isMine = (label === '自分');
      const cy = (el.y + el.base) / 2;
      ctx.fillStyle = isMine ? '#fff' : '#666';
      ctx.fillText(`${val}%`, el.x, cy);
    }
    ctx.restore();
  }
};

/* ===== Utils ===== */
function toggleEmpty(show){ const el=$('#empty'); if (el) el.style.display = show ? 'flex':'none'; }
function pickLatest(list){ return list.slice().sort((a,b)=> new Date(b.date)-new Date(a.date))[0] || null; }

/* ===== Chart.js 準備 ===== */
function ensureChart(){
  if (chart) return chart;
  const ctx = $('#spCanvas').getContext('2d');
  chart = new Chart(ctx, {
    type:'bar',
    data:{ labels:[], datasets:[{
      label:'進捗',
      data:[],
      barThickness: BAR_WIDTH_PX,
      maxBarThickness: BAR_WIDTH_PX,
      backgroundColor: [],
      userMeta: [],
      borderRadius:10,
      borderSkipped:false,
      borderWidth:0
    }]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout:{ padding:{ left:6, right:PADDING_PX, bottom:8 } },
      scales:{
        x:{ offset:true, grid:{display:false, drawBorder:false}, border:{display:false},
            ticks:{minRotation:0,maxRotation:0,autoSkip:false,font:{size:15},padding:16,display:true} },
        y:{ beginAtZero:true, min:0, max:100, display:false, grid:{drawBorder:false}, border:{display:false} }
      },
      plugins:{
        legend:{ display:false },
        tooltip:{
          enabled:true,
          callbacks:{
            title(items){ const i=items[0].dataIndex; const name = chart.data.labels[i]; const v = chart.data.datasets[0].data[i]; return `${name}：${v}%`; },
            label(item){ const m = chart.data.datasets[0].userMeta?.[item.dataIndex]; return m ? `${m.dept}／${m.pos}` : ''; }
          }
        }
      }
    },
    plugins:[valueLabelPlugin]
  });
  return chart;
}

/* ===== 初期ロード ===== */
(async function init(){
  try{
    const [users,depts,poses,books,reads] = await Promise.all([
      fetch(`${API}/users`).then(r=>r.json()),
      fetch(`${API}/departments`).then(r=>r.json()),
      fetch(`${API}/positions`).then(r=>r.json()),
      fetch(`${API}/books`).then(r=>r.json()),
      fetch(`${API}/readings`).then(r=>r.json())
    ]);
    RAW = { users, departments:depts, positions:poses, books, readings:reads };

    if (MY_USER_ID) {
      try{
        const u = await fetch(`${API}/users/${MY_USER_ID}`).then(r=>r.json());
        MY_NAME = u?.name || "";
      }catch(_){}
    }

    buildSelectors(); // 本/部門/役職
    ensureDefaultBook(); // いい感じの初期本
    render();
  }catch(e){
    console.error('初期取得失敗', e);
  }
})();

/* ===== セレクタ構築 ===== */
function buildSelectors(){
  const selBook = $('#selBook');
  const selDept = $('#selDept');
  const selPos  = $('#selPos');

  // 本
  selBook.querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  const byTitle = RAW.books.slice().sort((a,b)=> (a.title||'').localeCompare(b.title||'','ja'));
  byTitle.forEach(b=>{
    const o=document.createElement('option');
    o.value=String(b.id);
    o.textContent=b.title || '(無題)';
    selBook.appendChild(o);
  });

  // 部門・役職
  selDept.querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  selPos .querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  RAW.departments.forEach(d=>{ const o=document.createElement('option'); o.value=String(d.id); o.textContent=d.name; selDept.appendChild(o); });
  RAW.positions  .forEach(p=>{ const o=document.createElement('option'); o.value=String(p.id); o.textContent=p.name; selPos.appendChild(o); });

  // 変更イベント
  selBook.addEventListener('change', ()=>{ currentPage=0; render(); });
  selDept.addEventListener('change', ()=>{ currentPage=0; render(); });
  selPos .addEventListener('change', ()=>{ currentPage=0; render(); });

  // ページング
  $('#nextBtn').addEventListener('click', ()=>{ const tp = Math.ceil(allRows.length / BARS_PER_PAGE); if (currentPage < tp-1){ currentPage++; render(); } });
  $('#prevBtn').addEventListener('click', ()=>{ if (currentPage > 0){ currentPage--; render(); } });
}

/* ===== 初期表示用の本（自分の最新 or 先頭） ===== */
function ensureDefaultBook(){
  const sel = $('#selBook');
  if (!sel.value) {
    const mine = RAW.readings.filter(r => !isNaN(MY_USER_ID) && Number(r.userId)===Number(MY_USER_ID));
    const latest = pickLatest(mine);
    const defId = latest ? String(latest.bookId) : (RAW.books[0] ? String(RAW.books[0].id) : "");
    if (defId) sel.value = defId;
  }
}

/* ===== 集計＆描画 ===== */
function render(){
  const bookId = $('#selBook').value;
  if (!bookId) { toggleEmpty(true); paint([],[]); return; }

  // フィルタユーザー
  const deptId = $('#selDept').value || null;
  const posId  = $('#selPos').value  || null;
  let users = RAW.users.filter(u=>{
    if (deptId && String(u.departmentId) !== String(deptId)) return false;
    if (posId  && String(u.positionId)  !== String(posId) ) return false;
    return true;
  });

  // 対象本の“そのユーザーの最新レコード”を拾う
  const rows = [];
  const deptById = new Map(RAW.departments.map(d => [String(d.id), d.name]));
  const posById  = new Map(RAW.positions.map(p => [String(p.id), p.name]));

  users.forEach(u=>{
    const list = RAW.readings.filter(r => String(r.userId)===String(u.id) && String(r.bookId)===String(bookId));
    if (!list.length) return;                                  // その本を読んでいない人は除外
    const latest = pickLatest(list);
    const prog = Number(latest.progress ?? 0);
    if (isNaN(prog)) return;
    rows.push({
      id: String(u.id),
      name: (String(u.id)===String(MY_USER_ID) ? '自分' : u.name),
      progress: Math.max(0, Math.min(100, Math.round(prog))),  // 0–100に丸め
      dept: deptById.get(String(u.departmentId)) || '',
      pos:  posById.get(String(u.positionId))  || ''
    });
  });

  // 自分を先頭 → 残りは降順
  rows.sort((a,b)=>{
    const aMe = String(a.id)===String(MY_USER_ID);
    const bMe = String(b.id)===String(MY_USER_ID);
    if (aMe && !bMe) return -1;
    if (!aMe && bMe) return 1;
    return b.progress - a.progress;
  });

  allRows = rows;

  // ページング：自分 + （他 4人）
  const meRow = rows.find(r => String(r.id)===String(MY_USER_ID));
  const others = rows.filter(r => String(r.id)!==String(MY_USER_ID));
  const totalPages = Math.ceil(others.length / (BARS_PER_PAGE - 1)) || 1;
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;
  const start = currentPage * (BARS_PER_PAGE - 1);
  const pageRows = others.slice(start, start + (BARS_PER_PAGE - 1));
  let finalRows = meRow ? [meRow, ...pageRows] : [...pageRows];
  while (finalRows.length < BARS_PER_PAGE) finalRows.push({ id:'', name:'', progress:0, dept:'', pos:'' });

  const labels = finalRows.map(r=>r.name);
  const vals   = finalRows.map(r=>r.name===''?0:r.progress);
  const colors = finalRows.map(r=>{
    if (r.name==='') return 'transparent';
    return (String(r.id)===String(MY_USER_ID)) ? '#000000' : '#dedcdc';
  });
  const meta   = finalRows.map(r=>({dept:r.dept,pos:r.pos}));

  // 塗り
  paint(labels, vals, colors, meta);

  // 空表示
  const hasReal = rows.length > 0;
  toggleEmpty(!hasReal);

  // ナビ有効/無効
  $('#prevBtn').disabled = (currentPage===0);
  $('#nextBtn').disabled = (currentPage>=totalPages-1);
}

/* ===== グラフに流し込む ===== */
function paint(labels, values, colors=[], meta=[]){
  const c = ensureChart();
  c.data.labels = labels;
  c.data.datasets[0].data = values;
  c.data.datasets[0].backgroundColor = colors;
  c.data.datasets[0].userMeta = meta;
  // y軸は 0–100 固定
  c.options.scales.y.min = 0;
  c.options.scales.y.max = 100;
  c.update();
}
