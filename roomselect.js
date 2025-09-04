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
          <button class="room-button" data-id="${room.id}" data-bookid="${room.bookId}">参加</button>
        `;
        roomList.appendChild(card);
      });
    } catch (err) {
      console.error("ルーム取得エラー:", err);
    }
  }

  // 参加ボタン処理
  if (e.target.classList.contains("room-button")) {
    const roomId = Number(e.target.dataset.id);
    const bookId = Number(e.target.dataset.bookid);
    const userId = parseInt(localStorage.getItem('loginUserId'));
    const today = new Date().toISOString().slice(0, 10);

    // 1. reading新規作成
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
    const readingId = created.id;

    // 2. room.readingsに追加
    // まずroom取得
    const roomRes = await fetch(`${API_SEARCH}/rooms/${roomId}`);
    const roomObj = await roomRes.json();
    const updatedReadings = Array.isArray(roomObj.readings) ? [...roomObj.readings, readingId] : [readingId];

    await fetch(`${API_SEARCH}/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readings: updatedReadings })
    });

    // 3. トップページへ遷移
    location.href = "home.html";
  }
});

