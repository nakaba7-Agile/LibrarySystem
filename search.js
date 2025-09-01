// ==== 設定 ====
const API_SEARCH = "http://localhost:4000";   // json-server のURL
const LOGIN_USER_ID = 6;                       // 窓辺あかり

// DOMヘルパ（jQueryの$と衝突しない）
const qs = (sel) => document.querySelector(sel);

// 便利: HTML生成
const html = (s, ...v) => s.map((x,i)=>x + (v[i]??"")).join("");

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

    // ページ遷移
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
                <!-- 左に読んでいる、右に読んだ！ -->
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

$('#searchBookBtn').on('click', searchBooksByTitle);

function showToast(message) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  container.appendChild(toast);

  // 少し遅れて .show を付与 → アニメーションでフェードイン
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // 3秒後に削除
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      container.removeChild(toast);
    }, 500); // アニメーションが終わるのを待って削除
  }, 3000);
}

// ボタンクリック処理（読んでいる=progress0, 読んだ=progress100）
$('#bookSearchResults').on('click', '.register-btn', async function() {
  const bookId = $(this).data('bookid');
  const userId = parseInt(localStorage.getItem('loginUserId')); //ユーザーID
  const isDone = $(this).hasClass('done'); // 「読んだ！」かどうか
  const progressValue = isDone ? 100 : 0;

  try {
    // 既存のreadingsを取得
    const readings = await $.getJSON(`${API}/readings`);
    // すでに同じuserIdとbookIdの組み合わせが存在するかチェック
    const exists = readings.some(r => r.userId === userId && r.bookId === bookId);
    if (exists) {
      alert('この本はすでに登録されています');
      return;
    }

    // 最大idを取得して+1
    const maxId = readings.length > 0 ? Math.max(...readings.map(r => r.id || 0)) : 0;
    const newId = maxId + 1;

    const readingData = {
      id: newId,
      userId: userId,
      bookId: bookId,
      date: new Date().toISOString().split('T')[0],
      progress: progressValue
    };

    await $.ajax({
      url: `${API}/readings`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(readingData)
    });
    showToast(isDone ? '「読んだ本」に登録しました' : '「読んでいる本」に登録しました');
    // showPage('home'); // home画面に遷移
    // location.reload(); // ページをリロードして最新情報を表示
  } catch (e) {
    alert('登録に失敗しました');
    console.error(e);
  }
});
