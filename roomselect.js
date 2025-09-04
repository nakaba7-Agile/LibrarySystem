document.addEventListener("click", async (e) => {
  // 新規ルーム作成ボタン
  if (e.target.classList.contains("create-room-btn")) {
    // bookIdをdata属性で渡しておく
    const bookId = e.target.dataset.bookid;
    // 本情報取得
    const book = bookId
      ? await fetch(`http://localhost:4000/books/${bookId}`).then(r => r.json())
      : null;
    showCreateRoomModal(book);
    return; // 以降の処理を止める
  }

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
        const members = roomReadings.map(r => users.find(u => u.id === r.userId));
        const membersHTML = members.map(u => `
          <div class="member">
            <img src="${u.avatarimage}" alt="${u.name}" class="avatar">
            <div class="member-name">${u.name}</div>
          </div>
        `).join("");

        
  // 平均進捗率を計算
  let avgProgress = 0;
  if (roomReadings.length > 0) {
    const totalProgress = roomReadings.reduce((sum, r) => sum + r.progress, 0);
    avgProgress = Math.round(totalProgress / roomReadings.length);
  }

        card.innerHTML = `
          <span class="room-name">${room.name}</span>
           <div class="room-progress">平均進捗率：${avgProgress}%</div>
          <div class="room-members">${membersHTML}</div>
          <button class="room-button" data-id="${room.id}" data-bookid="${room.bookId}">参加</button>
        `;
        roomList.appendChild(card);
      });

      // 既存のルーム一覧描画の後に追加
      const createCard = document.createElement("div");
      createCard.className = "room-card";
      createCard.innerHTML = `
  <button class="room-button create-room-btn" data-bookid="${bookId}" style="width:100%;">＋ 新規ルーム作成</button>
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

  // 参加ボタン処理
  if (e.target.classList.contains("room-button") && !e.target.classList.contains("create-room-btn")) {
  const roomId = Number(e.target.dataset.id);
  const bookId = Number(e.target.dataset.bookid);
  const userId = parseInt(localStorage.getItem('loginUserId'));
  const today = new Date().toISOString().slice(0, 10);

  // まずroom取得
  const roomRes = await fetch(`${API_SEARCH}/rooms/${roomId}`);
  const roomObj = await roomRes.json();

  // readings取得
  const readingsRes = await fetch(`${API_SEARCH}/readings`).then(r => r.json());

  // 既にこのルームに参加しているか判定
  const alreadyJoined = readingsRes.some(r =>
    r.userId === userId &&
    r.bookId === bookId &&
    roomObj.readings.includes(r.id)
  );
  if (alreadyJoined) {
    alert("すでにこのルームに参加しています。");
    return;
  }

  // 既存の未完了reading（進捗欄にあるreading）を探す
  const existingReading = readingsRes.find(r =>
    r.userId === userId &&
    r.bookId === bookId &&
    Number(r.progress ?? 0) < 100
  );

  let readingId;
  if (existingReading) {
    // 既存のreadingを使う
    readingId = existingReading.id;
  } else {
    // 新規readingを作成
    const newReading = {
      userId,
      bookId,
      date: today,
      progress: 0,
      comment: ""
    };
    const res = await fetch(`${API_SEARCH}/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newReading)
    });
    const created = await res.json();
    readingId = created.id;
  }

  // room.readingsに追加
  const updatedReadings = Array.isArray(roomObj.readings) ? [...roomObj.readings, readingId] : [readingId];

  await fetch(`${API_SEARCH}/rooms/${roomId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ readings: updatedReadings })
  });

  // トップページへ遷移
  location.href = "home.html";
}
});


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

  // activeな本の情報を取得
  const book = getActiveBookInfo();
  if (!book) {
    alert("本を選択してください");
    return;
  }

  // bookIdを取得
  const books = await fetch("http://localhost:4000/books").then(r=>r.json());
  const bookData = books.find(b => b.title === book.title && b.author === book.author);
  if (!bookData) {
    alert("本の情報が見つかりません");
    return;
  }

  // 既存のrooms, readingsを取得
  const [rooms, readings] = await Promise.all([
    fetch("http://localhost:4000/rooms").then(r=>r.json()),
    fetch("http://localhost:4000/readings").then(r=>r.json())
  ]);

  // 新しいidを決定
  const newRoomId = rooms.length ? Math.max(...rooms.map(r=>r.id)) + 1 : 1;
  const newReadingId = readings.length ? Math.max(...readings.map(r=>r.id)) + 1 : 1;

  // 新しいreadingを追加（自分自身のreadingを仮登録）
  const loginUserId = parseInt(localStorage.getItem('loginUserId'));
  const newReading = {
    id: newReadingId,
    userId: loginUserId,
    bookId: bookData.id,
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
    bookId: bookData.id,
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
    const book = getActiveBookInfo();
    if (!book) {
      alert("本を選択してください");
      return;
    }
    showCreateRoomModal(book);
  }
});

function getActiveBookInfo() {
  const selected = document.querySelector('.book-tile.selected');
  if (!selected) return null;
  return {
    image: selected.querySelector('.book-tile-img')?.src,
    title: selected.querySelector('.book-tile-title')?.textContent,
    author: selected.querySelector('.book-tile-author')?.textContent
  };
}

