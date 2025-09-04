const API = "http://localhost:4000";

// URLパラメータから bookId を取得
const params = new URLSearchParams(window.location.search);
const bookId = params.get("bookId");

$(async function() {
  try {
    // bookId に対応する rooms だけ取得
    const rooms = await $.getJSON(`${API}/rooms?bookId=${bookId}`);

    const $roomList = $("#roomList");
    $roomList.empty();

    rooms.forEach(room => {
      const $card = $(`
        <div class="room-card">
          <span class="room-name">${room.name}</span>
          <button class="room-button" data-id="${room.id}">選択</button>
        </div>
      `);
      $roomList.append($card);
    });

    $roomList.on("click", ".room-button", function() {
      const roomId = $(this).data("id");
      alert(`ルームID ${roomId} が選択されました！`);
    });

  } catch (err) {
    console.error("ルーム取得エラー:", err);
  }
});

