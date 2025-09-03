// ✅ ログインユーザーID（仮に1とする）
const loginUserId = 1;

// 🔗 APIエンドポイント
const BASE_URL = 'http://localhost:4000';

const roomTabsContainer = document.getElementById('room-tabs');
const graphFrame = document.getElementById('graph-frame');
const radioButtons = document.querySelectorAll('input[name="type"]');

let selectedRoomId = null;
let selectedType = 'progress'; // 初期値

// 🚀 初期化
async function init() {
  const [rooms, readings] = await Promise.all([
    fetch(`${BASE_URL}/rooms`).then(res => res.json()),
    fetch(`${BASE_URL}/readings`).then(res => res.json())
  ]);

  // ログインユーザーが参加しているルームを抽出
  const userRoomList = rooms.filter(room => {
    if (!Array.isArray(room.readings)) return false;

    return room.readings.some(readingId => {
      const reading = readings.find(r => r.id === readingId);
      return reading && reading.userId === loginUserId;
    });
  });

  // タブ作成
  userRoomList.forEach((room, index) => {
    const btn = document.createElement('button');
    btn.textContent = room.name;
    btn.dataset.roomId = room.id;

    btn.addEventListener('click', () => {
      selectRoom(room.id);
    });

    roomTabsContainer.appendChild(btn);

    // 最初のルームを初期表示
    if (index === 0) {
      selectRoom(room.id);
    }
  });

  // ラジオボタンの変更イベント
  radioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
      selectedType = document.querySelector('input[name="type"]:checked').value;
      updateIframe();
    });
  });
}

// ✅ ルーム選択時の処理
function selectRoom(roomId) {
  selectedRoomId = roomId;

  // タブの見た目更新
  document.querySelectorAll('#room-tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.roomId == roomId);
  });

  updateIframe();
}

// ✅ iframeのsrc更新
function updateIframe() {
  if (selectedRoomId && selectedType) {
    graphFrame.src = `ranking.html?roomId=${selectedRoomId}&type=${selectedType}`;
  }
}

// ▶️ 実行
init();
