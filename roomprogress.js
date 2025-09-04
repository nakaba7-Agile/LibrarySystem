// ---- DOMショートカット ----
const $ = (s) => document.querySelector(s);

// ---- URLクエリ取得 ----
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const type = params.get('type') || 'count'; // 'count' (読書数) or 'progress'

// ---- 設定値 ----
const API = "http://localhost:4000";
const BAR_WIDTH_PX = 75;
const GAP_PX = 40;
const PADDING_PX = 6;

// ---- ログインユーザー情報 ----
let MY_NAME = "";
let MY_USER_ID = parseInt(localStorage.getItem('loginUserId'));

// ---- 状態 ----
let RAW = { users: [], departments: [], positions: [], readings: [], rooms: [] };
let chart;
let allRows = [];
let currentPage = 0;
const BARS_PER_PAGE = 5;

// ---- オリジナルの valueLabelPlugin (省略せず追加) ----
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
       if (i === 0 && isMine) {
        ctx.font = '600 18px system-ui, -apple-system, Segoe UI, Roboto, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
      } else {
        ctx.font = '18px system-ui, -apple-system, Segoe UI, Roboto, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
      }
      const centerY = (el.y + el.base) / 2;
      ctx.fillStyle = isMine ? '#fff' : '#171717';
      if(type==='count'){
        ctx.fillText(`${value}冊`, el.x, centerY);
      }
      else if(type==='progress'){
        ctx.fillText(`${value}%`, el.x, centerY);
      }
    }
    ctx.restore();
  }
};

// ---- Utils: parseDate, between, monthToRange, niceCeil ----
// （すべて既存コード通りにコピー）
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

// 読書データから冊数を集計する処理
function calculateCounts(users, readings) {
  const map = new Map();

  for (const user of users) {
    const uid = String(user.id);

    // progress >= 100 の読了本のみ
    const finished = readings.filter(r =>
      String(r.userId) === uid &&
      Number(r.progress ?? 0) >= 100
    );

    // 同じ bookId は1冊としてカウント
    const uniqueBooks = new Set(finished.map(r => r.bookId));
    map.set(uid, uniqueBooks.size);
  }

  return map; // Map<userId, 冊数>
}


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
      borderWidth: 0,
      userIds: []
    }]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      onHover(evt, elements) {
        const canvas = evt.chart.canvas;
        if (elements.length > 0) {
          canvas.style.cursor = 'pointer';   // 棒の上にいるとき
        } else {
          canvas.style.cursor = 'default';   // それ以外
        }
      },
      
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
              return `${name}：${cnt}%`;
            },
            label(item){
              const i = item.dataIndex;
              const meta = item.chart.data.datasets[0].userMeta?.[i];
              if (!meta) return '';
              return `${meta.dept}／${meta.pos}`;
            }
          }
        }
      },
      // ★ 棒クリックで userId を取得
      onClick(evt, elements) {
        if (!elements.length) return;
        const idx = elements[0].index;
        const ds  = chart.data.datasets[0];
        const userId = ds.userIds?.[idx];
        if (userId) {
          console.log("Clicked userId:", userId);
          localStorage.setItem('mypageUserId', userId);
          window.parent.postMessage({ type: 'show-mypage' }, '*');
        }
      }
    },
    plugins: [valueLabelPlugin]
  });
  return chart;
}

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

// ---- データ取得 ----
async function fetchAll() {
  try {
    const [users, depts, poses, reads, rooms] = await Promise.all([
      fetch(`${API}/users`).then(r => r.json()),
      fetch(`${API}/departments`).then(r => r.json()),
      fetch(`${API}/positions`).then(r => r.json()),
      fetch(`${API}/readings`).then(r => r.json()),
      fetch(`${API}/rooms`).then(r => r.json())
    ]);

    RAW = { users, departments: depts, positions: poses, readings: reads, rooms };

    // 🔽 ここに追加（RAW = { ... } の直後）

    // 自分のreading.id一覧を取得
    const myReadingIds = new Set(
    RAW.readings
        .filter(r => String(r.userId) === String(MY_USER_ID))
        .map(r => r.id)
    );

    // 自分のreading.idを含むroomのみ抽出
    RAW.rooms = RAW.rooms.filter(room =>
    room.readings.some(rid => myReadingIds.has(rid))
    );

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

// ---- フィルタセレクター構築 ----
function buildSelectors(){
  const selDept=$('#selDept'), selPos=$('#selPos');
  if (!selDept || !selPos) return;
  selDept.querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  selPos .querySelectorAll('option:not([value=""])').forEach(o=>o.remove());
  RAW.departments.forEach(d=>{ let o=document.createElement('option'); o.value=String(d.id); o.textContent=d.name; selDept.appendChild(o); });
  RAW.positions  .forEach(p=>{ let o=document.createElement('option'); o.value=String(p.id); o.textContent=p.name; selPos.appendChild(o); });
}

// ---- 描画ロジック ----
function render() {
  if (!roomId) return;

  // ルーム情報取得
  const room = RAW.rooms.find(r => String(r.id) === String(roomId));
  if (!room) return;

  const selDept = $('#selDept'), selPos = $('#selPos'), monthEl = $('#month');
  const deptId = selDept ? selDept.value || null : null;
  const posId = selPos ? selPos.value || null : null;

  // 月の開始・終了日
  let ym = monthEl?.value;
  if (!ym) {
    const t = new Date();
    ym = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`;
  }
  const { start: sd, end: ed } = monthToRange(ym);

  // ルームに属するユーザーID
  const roomUserIds = new Set(
    RAW.readings
      .filter(r => room.readings.includes(r.id))
      .map(r => String(r.userId))
  );

  // ユーザー一覧をルームのuserIdに絞る（+フィルタ）
  let users = RAW.users.filter(u => {
    if (!roomUserIds.has(String(u.id))) return false;
    if (deptId && String(u.departmentId) !== String(deptId)) return false;
    if (posId && String(u.positionId) !== String(posId)) return false;
    return true;
  });

  // 自分を先頭に追加（未参加でも）
  const me = RAW.users.find(u => String(u.id) === String(MY_USER_ID) || u.name === MY_NAME);
  if (me && !users.some(u => String(u.id) === String(me.id))) users = [me, ...users];

  // ★ 集計処理をtypeで分岐
  const map = new Map();
  if (type === 'progress') {
    // ルーム内の本ID一覧
    const roomReadingIds = new Set(room.readings);
    const roomBookIds = new Set(
      RAW.readings.filter(r => roomReadingIds.has(r.id)).map(r => r.bookId)
    );

    for (const user of users) {
      const uid = String(user.id);
      // 期間内＆ルーム内のreading（同一ユーザー＆ルーム内の本のみ）
      const readingsInMonth = RAW.readings.filter(r =>
        String(r.userId) === uid &&
        between(r.date, sd, ed) &&
        roomBookIds.has(r.bookId)
      );
      // ルーム内の本ごとに最新progressを取得
      const latestProgressByBook = {};
      readingsInMonth.forEach(r => {
        const bid = String(r.bookId);
        if (!latestProgressByBook[bid] || new Date(r.date) > new Date(latestProgressByBook[bid].date)) {
          latestProgressByBook[bid] = r;
        }
      });
      // 平均progress（または0）
      const progresses = Object.values(latestProgressByBook).map(r => Number(r.progress ?? 0));
      const avgProgress = progresses.length ? Math.round(progresses.reduce((a,b)=>a+b,0)/progresses.length) : 0;
      map.set(uid, avgProgress);
    }
  } else {
    // 冊数（期間内でprogress>=100の読了本のみ）
    for (const user of users) {
      const uid = String(user.id);
      const finished = RAW.readings.filter(r =>
        String(r.userId) === uid &&
        Number(r.progress ?? 0) >= 100 &&
        between(r.date, sd, ed)
      );
      // 同じbookIdは1冊としてカウント
      const uniqueBooks = new Set(finished.map(r => r.bookId));
      map.set(uid, uniqueBooks.size);
    }
  }

  // rowsを構築
  const deptById = new Map(RAW.departments.map(d => [String(d.id), d.name]));
  const posById = new Map(RAW.positions.map(p => [String(p.id), p.name]));

  let rows = users.map(u => {
    const key = String(u.id);
    return {
      id: key,
      name: u.name,
      count: map.get(key) ?? 0,
      dept: deptById.get(String(u.departmentId)) || '',
      pos: posById.get(String(u.positionId)) || ''
    };
  });

  // 0でも表示
  rows.sort((a, b) => {
    const isAme = String(a.id) === String(MY_USER_ID) || a.name === MY_NAME;
    const isBme = String(b.id) === String(MY_USER_ID) || b.name === MY_NAME;
    if (isAme && !isBme) return -1;
    if (!isAme && isBme) return 1;
    return b.count - a.count;
  });

  allRows = rows;

  // ページング・描画は従来どおり
  const meRow = rows.find(r => String(r.id) === String(MY_USER_ID) || r.name === MY_NAME);
  const others = rows.filter(r => String(r.id) !== String(MY_USER_ID) && r.name !== MY_NAME);

  const totalPages = Math.ceil(others.length / (BARS_PER_PAGE - 1)) || 1;
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;

  const startIdx = currentPage * (BARS_PER_PAGE - 1);
  const endIdx = startIdx + (BARS_PER_PAGE - 1);
  const pageRows = others.slice(startIdx, endIdx);

  let finalRows = meRow ? [meRow, ...pageRows] : [...pageRows];

  while (finalRows.length < BARS_PER_PAGE) {
    finalRows.push({ id:'', name:'', count:0, dept:'', pos:'' });
  }

  const labels   = finalRows.map(r => r.name);
  const counts   = finalRows.map(r => r.count);
  const colors   = finalRows.map(r => r.name === '' ? 'transparent' :
                                 (String(r.id) === String(MY_USER_ID) || r.name === MY_NAME) ? '#1FB9EF' : '#ACE9FF');
  const userMeta = finalRows.map(r => ({ dept: r.dept, pos: r.pos }));
  const ids      = finalRows.map(r => r.id);

  const c = ensureChart();
  c.data.labels = labels;
  c.data.datasets[0].data = counts;
  c.data.datasets[0].backgroundColor = colors;
  c.data.datasets[0].userMeta = userMeta;
  c.data.datasets[0].userIds = ids;

  // Y軸設定
  const maxVal = counts.length ? Math.max(...counts) : 0;
  const yopt = c.options.scales.y;
  yopt.min = 0;
  if (type === 'progress') {
    yopt.max = 100;
    yopt.suggestedMax = 100;
  } else {
    if (maxVal <= 10) {
      yopt.max = 10;
      yopt.suggestedMax = undefined;
    } else {
      const upper = niceCeil(maxVal);
      yopt.max = upper;
      yopt.suggestedMax = undefined;
    }
  }

  c.update();
  toggleEmpty(labels.length === 0);
  $('#prevBtn').disabled = (currentPage === 0);
  $('#nextBtn').disabled = (currentPage >= Math.ceil((rows.length - 1) / (BARS_PER_PAGE -1)) - 1);

  postMonthlyCountToParent();
}

// ---- メッセージ受信（他フレームからの） ----
window.addEventListener("message", async (e) => {
  const data = e?.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "request-monthly-count") {
    try {
      await fetchAll(); // ← readingsだけでなく全データ再取得
    } catch (err) {
      console.error("recalc monthly-count failed:", err);
    }
  }
});

// ---- フィルタ更新イベント ----
$('#selDept')?.addEventListener('change', render);
$('#selPos')?.addEventListener('change', render);
$('#month')?.addEventListener('change', () => {
  const ym = $('#month').value;
  window.parent?.postMessage({ type: 'month-change', ym }, '*');
  render();
});

// ★ ページ送り（スライド）機能を追加
$('#nextBtn')?.addEventListener('click', () => {
  // ページ数計算
  const totalPages = Math.ceil((allRows.length - 1) / (BARS_PER_PAGE - 1)) || 1;
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

// ラジオボタンの状態監視
function updateMonthInputVisibility() {
  // graph.htmlからtypeを渡している場合はparams.get('type')で取得
  const type = new URLSearchParams(window.location.search).get('type') || 'count';
  const wrap = document.getElementById('month-wrap');
  if (wrap) {
    wrap.style.display = (type === 'progress') ? 'none' : '';
  }
}

// ---- 初期呼び出し ----
fetchAll();
updateMonthInputVisibility();

// URLのtype変更時にも反映（iframeのsrc変更時に再読込されるので基本不要ですが念のため）
window.addEventListener('DOMContentLoaded', updateMonthInputVisibility);
