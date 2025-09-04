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
    } catch (err) {
      console.error("ルーム取得エラー:", err);
    }
  }
});

