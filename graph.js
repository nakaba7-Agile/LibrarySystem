// ログインユーザーID（仮に1とする）
const loginUserId = parseInt(localStorage.getItem('loginUserId'));

// APIエンドポイント
const BASE_URL = 'http://localhost:4000';

const roomTabsContainer = document.getElementById('room-tabs');
const graphFrame = document.getElementById('graph-frame');
const radioButtons = document.querySelectorAll('input[name="type"]');

let selectedRoomId = null;
let selectedType = 'progress'; // 初期値
let userRooms = []; // ← 追加

// 初期化
async function init() {
  const [rooms, readings] = await Promise.all([
    fetch(`${BASE_URL}/rooms`).then(res => res.json()),
    fetch(`${BASE_URL}/readings`).then(res => res.json())
  ]);

  // ログインユーザーのreading一覧（idのみ）
  const userReadingIds = new Set(
    readings
      .filter(r => r.userId === loginUserId)
      .map(r => r.id)
  );

  console.log('読書している本ID',userReadingIds);

  // ユーザーが参加しているルームだけ抽出
  userRooms = rooms.filter(room => // ← ここを代入に
    Array.isArray(room.readings) &&
    room.readings.some(rid => userReadingIds.has(rid))
  );

  console.log('参加中の部屋',userRooms);

  // タブ表示のためにルームが一件もない場合対策
  if (userRooms.length === 0) {
    handleNoRooms(); // ルームがない場合の処理を追加
    return;
  } else {
    handleHasRooms(); // ルームがある場合の処理
  }

  // タブ作成
  userRooms.forEach((room, index) => {
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

// ルーム選択時の処理
function selectRoom(roomId) {
  selectedRoomId = roomId;

  // タブの見た目更新
  document.querySelectorAll('#room-tabs button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.roomId == roomId);
  });

    // ルーム情報から期間を取得して表示
  const room = userRooms.find(r => r.id == roomId);
  const titleEl = document.getElementById('graph-title');
  if (room && titleEl) {
    titleEl.textContent = `${room.startDate} ~ ${room.endDate}`;
  }

  updateIframe();
}

// iframeのsrc更新
function updateIframe() {
  if (selectedRoomId && selectedType) {
    graphFrame.src = `roomprogress.html?roomId=${selectedRoomId}&type=${selectedType}`;
  }
}

// ルームがない場合の制御例
function handleNoRooms() {
  document.getElementById('graph-type').style.display = 'none';
  document.getElementById('period-wrap').style.display = 'none'; // ← 追加
  document.getElementById('no-room-message').style.display = 'block';
  document.getElementById('graph-frame').style.display = 'none';
}

// ルームがある場合は以下のように戻す
function handleHasRooms() {
  document.getElementById('graph-type').style.display = '';
  document.getElementById('period-wrap').style.display = ''; // ← 追加
  document.getElementById('no-room-message').style.display = 'none';
  document.getElementById('graph-frame').style.display = '';
}

// 例：ルームがない場合に呼び出す
// handleNoRooms();

init();
