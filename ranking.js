// ==== 設定 ====
// json-server のポートに合わせてください
const API = "http://localhost:4000";

// 仕様：枠の中で「常に5本分が見える」ようにする
const VISIBLE_BARS = 5;       // 表示枠に常に見せたい本数
const BAR_MIN_PX   = 80;      // 1本あたりの最小幅（見切れ防止）
const BAR_MAX_PX   = 180;     // 1本あたりの最大幅（文字が詰まり過ぎないように）
const CANVAS_HEIGHT = 360;    // キャンバス高さ(px)
const Y_MAX = 10;             // 縦軸上限（0〜10固定）

let chart;
let lastLabels = [];
let lastData = [];

$(async function init() {
  setStatus("マスタ取得中…");
  await Promise.all([loadDepartments(), loadPositions()]); // 部署＆役職

  setStatus("データ取得中…");
  await fetchAndRender();
  setStatus("");

  $("#departmentSelect").on("change", () => fetchAndRender());
  $("#positionSelect").on("change", () => fetchAndRender());
  $("#reload").on("click", () => fetchAndRender());

  // ★ ウィンドウリサイズ時、枠幅に合わせて barWidth を再計算して再描画
  $(window).on("resize", debounce(() => {
    if (!lastLabels.length) return;
    renderWithLayout(lastLabels, lastData);
  }, 150));
});

/** 部署セレクト生成 */
async function loadDepartments() {
  try {
    const deps = await $.getJSON(`${API}/departments`);
    deps.sort((a, b) => a.id - b.id);
    const $sel = $("#departmentSelect");
    $sel.find("option:not([value='0'])").remove();
    deps.forEach(d => $sel.append(new Option(d.name, String(d.id))));
  } catch (e) {
    setStatus("部署リスト取得に失敗しました");
    console.error(e);
  }
}

/** 役職（position）セレクト生成 */
async function loadPositions() {
  try {
    const positions = await $.getJSON(`${API}/positions`);
    positions.sort((a, b) => a.id - b.id);
    const $sel = $("#positionSelect");
    $sel.find("option:not([value='0'])").remove();
    positions.forEach(p => $sel.append(new Option(p.name, String(p.id))));
  } catch (e) {
    setStatus("役職リスト取得に失敗しました");
    console.error(e);
  }
}

/** 読了ログとユーザを手動JOIN → 部署×役職の積集合でfilter → 集計 → レイアウトに沿って描画 */
async function fetchAndRender() {
  const depId = Number($("#departmentSelect").val() || 0);
  const posId = Number($("#positionSelect").val() || 0);
  setStatus("読み込み中…");

  try {
    const [readings, users] = await Promise.all([
      $.getJSON(`${API}/readings`),
      $.getJSON(`${API}/users`)
    ]);

    // 対象ユーザー（部署×役職）…読了0件でも含める
    const eligibleUsers = users.filter(u => {
      const depOk = depId === 0 || Number(u.departmentId) === depId;
      const posOk = posId === 0 || Number(u.positionId) === posId;
      return depOk && posOk;
    });
    const eligibleIds = new Set(eligibleUsers.map(u => u.id));

    // 0 初期化（LEFT JOIN的）
    const counts = {};
    eligibleUsers.forEach(u => { counts[u.name] = 0; });

    // 読了ログで加算
    const userById = Object.fromEntries(users.map(u => [Number(u.id), u]));

    for (const r of readings) {
      const uid = String(r.userId);
      
      if (eligibleIds.has(uid)) {
        const u = userById[uid];
        const name = u?.name ?? `User${uid}`;
        counts[name] = (counts[name] || 0) + 1;
      }
    }


    // 降順
    let entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // 5本未満 → ダミーで5本に埋める（空ラベル＋0）
    if (entries.length < VISIBLE_BARS) {
      const blanks = Array(VISIBLE_BARS - entries.length).fill(null).map(() => ["", 0]);
      entries = entries.concat(blanks);
    }
    // 6本以上 → そのまま全件（枠内で横スクロール）

    const labels = entries.map(([name]) => name);
    const data   = entries.map(([_, count]) => count);

    lastLabels = labels;
    lastData   = data;

    renderWithLayout(labels, data);
    setStatus(`対象ユーザ数: ${eligibleUsers.length}, ログ件数: ${readings.length}`);
  } catch (e) {
    setStatus("データ取得に失敗しました");
    console.error(e);
  }
}

/** 枠幅から 1 本あたりの barWidth を算出し、キャンバス幅を決めて描画 */
function renderWithLayout(labels, data) {
  const area = document.getElementById("chartArea");
  const canvas = document.getElementById("chart");

  // 見える本数 = 5 本に合わせた barWidth を、枠の内寸から動的計算
  const areaInnerWidth = Math.max(0, area.clientWidth - 16); // paddingのぶん少し減らす
  const barWidth = clamp(Math.floor(areaInnerWidth / VISIBLE_BARS), BAR_MIN_PX, BAR_MAX_PX);

  // 全本数ぶんのキャンバス幅を設定（5未満は既にダミーで5本に揃っている）
  const totalBars = labels.length;
  canvas.width  = totalBars * barWidth;
  canvas.height = CANVAS_HEIGHT;

  // “データなし”表示（全0のとき）
  const allZero = data.every(v => v === 0);
  toggleEmpty(allZero);

  renderChart(labels, data);
}

/** Chart.js 描画（縦軸 0〜10 固定） */
function renderChart(labels, data) {
  const ctx = document.getElementById("chart").getContext("2d");
  if (chart) { chart.destroy(); chart = null; }

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "読了数",
        data,
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,          // 親枠で横スクロールするので false
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: Y_MAX,             // ← 縦軸固定
          ticks: { stepSize: 1, precision: 0 }
        }
      },
      plugins: { legend: { display: false } },
      animation: false
    }
  });
}

/* Util */
function toggleEmpty(show) {
  const el = document.getElementById("empty");
  if (!el) return;
  el.hidden = !show;
}
function setStatus(text) { $("#status").text(text); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function debounce(fn, wait=250) {
  let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); };
}

//田北変更箇所はここから
// 本のタイトル検索機能（db.jsonのbooksを利用）
async function searchBooksByTitle() {
  const keyword = $('#bookTitleInput').val().trim();
  if (!keyword) {
    $('#bookSearchResults').empty();
    return;
  }
  try {
    const books = await $.getJSON(`${API}/books`);
    const results = books.filter(book => book.title.includes(keyword));
    // 検索結果ページへ遷移
    showPage('kensaku');
    const $results = $('#bookSearchResults');
    $results.empty();
    // 検索結果の見出しを追加
    $results.append(`<h2>「${keyword}」の検索結果（${results.length}件）</h2>`);
    if (results.length === 0) {
      $results.append('<div>該当する本がありません。</div>');
    } else {
      results.forEach(book => {
        // サムネ画像がなければダミー画像
        const img = book.image ? book.image : 'images/noimage.png';
        // 著者名がなければ空欄
        const author = book.author ? book.author : '';
        $results.append(`
          <div class="book-result" style="display:flex;align-items:flex-start;gap:16px;margin-bottom:32px;">
            <img src="${img}" alt="${book.title}" style="width:80px;height:110px;object-fit:cover;border-radius:8px;background:#eee;">
            <div>
              <div style="font-size:1.1em;font-weight:bold;margin-bottom:4px;">${book.title}</div>
              <div style="color:#555;margin-bottom:10px;">${author}</div>
              <button class="register-btn" data-bookid="${book.id}">読んでいるに登録</button>
            </div>
          </div>
        `);
      });
    }
  } catch (e) {
    $('#bookSearchResults').html('<div>本データの取得に失敗しました。</div>');
    console.error(e);
  }
}

$('#searchBookBtn').on('click', searchBooksByTitle);

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(div => {
    div.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

/*変更ここまで*/
