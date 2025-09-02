// ==== 設定 ====
const API_SEARCH = "http://localhost:4000";
const LOGIN_USER_ID = parseInt(localStorage.getItem('loginUserId')); // ログインユーザーID

// DOMヘルパ
const qs = (sel) => document.querySelector(sel);

// 便利: HTML生成
const html = (s, ...v) => s.map((x,i)=>x + (v[i]??"")).join("");

// 安全なトースト
function showToast(message) {
  const container = document.getElementById("toastContainer");
  if (!container) { alert(message); return; }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => container.removeChild(toast), 300);
  }, 1800);
}

// 検索本体
async function searchBooksByTitle() {
  const input = qs("#bookTitleInput");
  if (!input) return;
  const keyword = input.value.trim();
  const resultsEl = qs("#bookSearchResults");
  if (!resultsEl) return;

  if (!keyword) {
    resultsEl.innerHTML = "";
    return;
  }

  try {
    const books = await fetch(`${API_SEARCH}/books`).then(r=>r.json());
    const results = books.filter(b => String(b.title || "").includes(keyword));

    if (typeof showPage === "function") showPage("kensaku");

    resultsEl.innerHTML = html`
      <h2>「${keyword}」の検索結果（${results.length}件）</h2>
      ${results.length === 0 ? "<div>該当する本がありません。</div>" : ""}
      ${results.map(book=>{
        const img = book.image || "images/noimage.png";
        const author = book.author || "";
        return html`
          <div class="book-result" style="display:flex;align-items:flex-start;gap:16px;margin-bottom:32px;">
            <img src="${img}" alt="${book.title}" style="width:80px;height:110px;object-fit:cover;border-radius:8px;background:#eee;">
            <div>
              <div style="font-size:1.1em;font-weight:bold;margin-bottom:4px;">${book.title}</div>
              <div style="color:#555;margin-bottom:10px;">${author}</div>
              <div style="display:flex; gap:8px;">
                <button class="register-btn reading" data-bookid="${book.id}">読んでいる</button>
                <button class="register-btn done"    data-bookid="${book.id}">読んだ！</button>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    `;
  } catch (e) {
    console.error(e);
    resultsEl.innerHTML = "<div>本データの取得に失敗しました。</div>";
  }
}

// 検索ボタン
document.addEventListener("DOMContentLoaded", ()=>{
  const btn = qs("#searchBookBtn");
  const input = qs("#bookTitleInput");

  btn?.addEventListener("click", (e)=>{
    e.preventDefault();
    searchBooksByTitle();
  });

  input?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter") {
      e.preventDefault();
      searchBooksByTitle();
    }
  });
});

// 「読んでいる / 読んだ！」登録
document.addEventListener("click", async (e)=>{
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("register-btn")) return;

  if (!Number.isFinite(LOGIN_USER_ID)) {
    showToast("ログインが必要です");
    return;
  }

  const bookId = Number(target.dataset.bookid);
  const isDone = target.classList.contains("done");
  const progressValue = isDone ? 100 : 0;

  try {
    // 重複登録チェック
    const readings = await fetch(`${API_SEARCH}/readings`).then(r=>r.json());
    if (readings.some(r => Number(r.userId) === LOGIN_USER_ID && Number(r.bookId) === bookId)) {
      showToast("この本はすでに登録されています");
      return;
    }

    // 新ID採番
    const maxId = readings.length ? Math.max(...readings.map(r => Number(r.id)||0)) : 0;
    const readingData = {
      id: maxId + 1,
      userId: LOGIN_USER_ID,
      bookId,
      date: new Date().toISOString().split("T")[0],
      progress: progressValue
    };

    // ★ 先にPOSTを完了させる（遅延させない／リロード前に完了させる）
    const res = await fetch(`${API_SEARCH}/readings`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(readingData)
    });
    if (!res.ok) {
      const t = await res.text().catch(()=> "");
      throw new Error(`POST failed: ${res.status} ${t}`);
    }

    // UI更新・通知
    showToast(isDone ? "「読んだ本」に登録しました" : "「読んでいる本」に登録しました");

    // サイドバーの進捗を「ランキングの月」で再描画（無ければ登録月で）
    try {
      const ymFromRanking = (typeof getCurrentYMForSidebar === "function") ? getCurrentYMForSidebar() : null;
      const ym = ymFromRanking || readingData.date.slice(0,7);
      if (typeof renderInProgressArea === "function") renderInProgressArea(ym);
    } catch(_){}

    // ランキングの今月冊数を再計算依頼（読んだ！の時だけでもOK。ここでは両方で呼んでも害なし）
    try { document.getElementById("rankingFrame")?.contentWindow?.postMessage({ type:"request-monthly-count" }, "*"); } catch(_){}

    // 必要なら軽く待ってからリロード（任意）
    // setTimeout(()=> location.reload(), 800);

  } catch (e) {
    console.error(e);
    showToast('登録に失敗しました');
  }
});
