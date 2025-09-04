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

  // // ルームを探すボタンクリックで roomsearch ページへ
  // document.addEventListener("click", (e) => {
  //   if (e.target.classList.contains("roomSelect-btn")) {
  //     if (typeof showPage === "function") {
  //       showPage("roomselect");
  //     } else {
  //       console.warn("showPage 関数が見つかりません");
  //     }
  //   }
  // });
  document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("roomSelect-btn")) {
    const bookId = e.target.dataset.bookid;

    // ページ切り替え
    showPage("roomselect");

    // --- ここで roomselect のカードを描画 ---
    try {
      const rooms = await fetch(`${API_SEARCH}/rooms?bookId=${bookId}`).then(r => r.json());
      const roomList = document.getElementById("roomList");
      roomList.innerHTML = "";

      rooms.forEach(room => {
        const card = document.createElement("div");
        card.className = "room-card";
        card.innerHTML = `
          <span class="room-name">${room.name}</span>
          <button class="room-button" data-id="${room.id}">参加</button>
        `;
        roomList.appendChild(card);
      });

      // ▼▼▼ 新規ルーム作成ボタンを追加 ▼▼▼
      const createCard = document.createElement("div");
      createCard.className = "room-card";
      createCard.innerHTML = `
        <button class="room-button create-room-btn" style="width:100%;">＋ 新規ルーム作成</button>
      `;
      roomList.appendChild(createCard);

      // 新規ルーム作成ボタンのクリックイベント
      createCard.querySelector(".create-room-btn").addEventListener("click", () => {
        // ここで新規ルーム作成の処理を実装
        alert("新規ルーム作成ダイアログを表示します（実装してください）");
      });
      // ▲▲▲ ここまで ▲▲▲

    } catch (err) {
      console.error("ルーム取得エラー:", err);
    }
  }
});



  // ルームを探すボタンクリックで選択した本のタイルの枠色を変える
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("roomSelect-btn")) {
    const bookTile = e.target.closest(".book-tile");

    if (bookTile) {
      // すでに選ばれている枠をリセット
      document.querySelectorAll(".book-tile.selected")
              .forEach(el => el.classList.remove("selected"));

      // 今選んだタイルに選択スタイルを付与
      bookTile.classList.add("selected");
    }

    // ページ切り替え（必要なら）
    if (typeof showPage === "function") {
      showPage("roomselect");
    }
  }
});


// イベント委譲で動的要素にも対応
document.addEventListener("mouseover", (e) => {
  if (e.target.classList.contains("roomSelect-btn")) {
    e.target.classList.add("hovered"); // ボタン自身も色変更
    const bookTile = e.target.closest(".book-tile");
    if (bookTile) bookTile.classList.add("hovered"); // タイルも色変更
  }
});

document.addEventListener("mouseout", (e) => {
  if (e.target.classList.contains("roomSelect-btn")) {
    e.target.classList.remove("hovered"); // ボタン色を元に戻す
    const bookTile = e.target.closest(".book-tile");
    if (bookTile) bookTile.classList.remove("hovered"); // タイル枠も元に戻す
  }
});

});