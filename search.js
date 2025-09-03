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
  <div style="margin-bottom:18px;">
    <span style="font-size:1.1em;font-weight:bold;">
      「${keyword}」の検索結果（${results.length}件）
    </span>
  </div>
  <div class="book-tile-list">
    ${results.length === 0 ? "<div>該当する本がありません。</div>" : ""}
    ${results.map(book=>{
      const img = book.image || "images/noimage.png";
      const author = book.author || "";
      return html`
        <div class="book-tile">
          <img src="${img}" alt="${book.title}" class="book-tile-img">
          <div class="book-tile-info">
            <div class="book-tile-title">${book.title}</div>
            <div class="book-tile-author">${author}</div>
            <button class="roomSelect-btn" data-bookid="${book.id}">ルームを探す</button>
          </div>
        </div>
      `;
    }).join("")}
  </div>
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

  // ルームを探すボタンクリックで roomsearch ページへ
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("roomSelect-btn")) {
      if (typeof showPage === "function") {
        showPage("roomselect");
      } else {
        console.warn("showPage 関数が見つかりません");
      }
    }
  });

  // ルームを探すボタンクリックで選択した本のタイルの枠色を変える
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("roomSelect-btn")) {
    // すでに選ばれているボタンの選択状態をリセット
    document.querySelectorAll(".roomSelect-btn.selected")
            .forEach(btn => btn.classList.remove("selected"));

    // 今押したボタンに selected クラスを追加
    e.target.classList.add("selected");

    // （任意）本タイル枠も色を変える場合
    const bookTile = e.target.closest(".book-tile");
    if (bookTile) {
      document.querySelectorAll(".book-tile.selected")
              .forEach(el => el.classList.remove("selected"));
      bookTile.classList.add("selected");
    }

    // ページ切り替え（右カラム表示など）
    if (typeof showPage === "function") {
      showPage("roomselect");
    }
  }
});


});