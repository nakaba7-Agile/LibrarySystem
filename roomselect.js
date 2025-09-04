document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("roomSelect-btn")) {
    const bookId = e.target.dataset.bookid;

    showPage("roomselect");

    try {
      const rooms = await fetch(`${API_SEARCH}/rooms?bookId=${bookId}`).then(r => r.json());
      const readings = await fetch(`${API_SEARCH}/readings`).then(r => r.json());
      const users = await fetch(`${API_SEARCH}/users`).then(r => r.json());

      const roomList = document.getElementById("roomList");
      roomList.innerHTML = "";

      rooms.forEach(room => {
        const card = document.createElement("div");
        card.className = "room-card";

        // このルームの読み取りデータを取得
        const roomReadings = readings.filter(r => room.readings.includes(r.id));

        // userId → user 情報に変換
        const members = roomReadings.map(r => users.find(u => u.id === r.userId));

        const membersHTML = members.map(u => `
          <div class="member">
            <img src="${u.avatarimage}" alt="${u.name}" class="avatar">
            <div class="member-name">${u.name}</div>
          </div>
        `).join("");

        card.innerHTML = `
      <div class="room-header">
    <span class="room-name">${room.name}</span>
  </div>
  <div class="room-members">${membersHTML}</div>
  <button class="room-button" data-id="${room.id}">選択</button>
`;
        roomList.appendChild(card);
      });

      // 既存のルーム一覧描画の後に追加
      const createCard = document.createElement("div");
      createCard.className = "room-card";
      createCard.innerHTML = `
        <button class="room-button create-room-btn" style="width:100%;">＋ 新規ルーム作成</button>
      `;
      roomList.appendChild(createCard);

      roomList.addEventListener("click", function (e) {
        if (e.target.classList.contains("create-room-btn")) {
          // ここでモーダルを表示する処理を実装
          // 例: showCreateRoomModal(book情報);
        }
      });
    } catch (err) {
      console.error("ルーム取得エラー:", err);
    }
  }
});

// モーダル表示
function showCreateRoomModal(book) {
  document.getElementById("modalBookImg").src = book?.image || "images/noimage.png";
  document.getElementById("modalBookTitle").textContent = book?.title || "";
  document.getElementById("modalBookAuthor").textContent = book?.author || "";
  document.getElementById("roomNameInput").value = "";
  document.getElementById("startDateInput").value = "";
  document.getElementById("endDateInput").value = "";
  document.getElementById("createRoomModal").style.display = "flex";
}

// モーダル非表示
function hideCreateRoomModal() {
  document.getElementById("createRoomModal").style.display = "none";
}

// ボタンイベント
document.getElementById("cancelCreateBtn").onclick = hideCreateRoomModal;
document.getElementById("submitCreateBtn").onclick = async function() {
  const name = document.getElementById("roomNameInput").value;
  const start = document.getElementById("startDateInput").value;
  const end = document.getElementById("endDateInput").value;

  // 入力チェック
  if (!name || !start || !end) {
    alert("すべて入力してください");
    return;
  }

  // 必要なデータを取得
  const bookTitle = document.getElementById("modalBookTitle").textContent;
  const bookAuthor = document.getElementById("modalBookAuthor").textContent;
  const bookImg = document.getElementById("modalBookImg").src;

  // 既存のrooms, readingsを取得
  const [rooms, readings] = await Promise.all([
    fetch("http://localhost:4000/rooms").then(r=>r.json()),
    fetch("http://localhost:4000/readings").then(r=>r.json())
  ]);

  // 新しいidを決定
  const newRoomId = rooms.length ? Math.max(...rooms.map(r=>r.id)) + 1 : 1;
  const newReadingId = readings.length ? Math.max(...readings.map(r=>r.id)) + 1 : 1;

  // bookIdを取得（bookTitleから検索）
  const books = await fetch("http://localhost:4000/books").then(r=>r.json());
  const book = books.find(b => b.title === bookTitle && b.author === bookAuthor);
  if (!book) {
    alert("本の情報が見つかりません");
    return;
  }

  // 新しいreadingを追加（自分自身のreadingを仮登録）
  const loginUserId = parseInt(localStorage.getItem('loginUserId'));
  const newReading = {
    id: newReadingId,
    userId: loginUserId,
    bookId: book.id,
    date: start,
    progress: 0
  };
  await fetch("http://localhost:4000/readings", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(newReading)
  });

  // 新しいroomを追加
  const newRoom = {
    id: newRoomId,
    name: name,
    bookId: book.id,
    startDate: start,
    endDate: end,
    readings: [newReadingId]
  };
  await fetch("http://localhost:4000/rooms", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(newRoom)
  });

  hideCreateRoomModal();

  // ルーム一覧を再取得・再描画（必要ならリロードや関数呼び出し）
  location.reload();
};

// ルーム作成ボタンからモーダルを開く
document.getElementById("roomList").addEventListener("click", function(e) {
  if (e.target.classList.contains("create-room-btn")) {
    // 選択中の本の情報を取得（必要に応じて修正）
    const book = {
      image: document.querySelector(".book-tile-img")?.src,
      title: document.querySelector(".book-tile-title")?.textContent,
      author: document.querySelector(".book-tile-author")?.textContent
    };
    showCreateRoomModal(book);
  }
});

