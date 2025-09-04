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
          <span class="room-name">${room.name}</span>
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
document.getElementById("submitCreateBtn").onclick = function() {
  // 入力値取得
  const name = document.getElementById("roomNameInput").value;
  const start = document.getElementById("startDateInput").value;
  const end = document.getElementById("endDateInput").value;
  // バリデーションやAPI送信処理をここに実装
  hideCreateRoomModal();
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

