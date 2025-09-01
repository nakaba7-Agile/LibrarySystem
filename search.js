// ==== 設定 ====
// json-server のポートに合わせてください
const API = "http://localhost:4000";

// 本のタイトル検索機能（db.jsonのbooksを利用）
async function searchBooksByTitle() {
  const keyword = $('#bookTitleInput').val().trim();
  if (!keyword) {
    $('#bookSearchResults').empty();
    return;
  }
  try {
    const books = await $.getJSON(`${API}/books`);
    const results = books.filter(book => book.title.includes(keyword));
    // 検索結果ページへ遷移
    showPage('kensaku');
    const $results = $('#bookSearchResults');
    $results.empty();
    // 検索結果の見出しを追加
    $results.append(`<h2>「${keyword}」の検索結果（${results.length}件）</h2>`);
    if (results.length === 0) {
      $results.append('<div>該当する本がありません。</div>');
    } else {
      results.forEach(book => {
        // サムネ画像がなければダミー画像
        const img = book.image ? book.image : 'images/noimage.png';
        // 著者名がなければ空欄
        const author = book.author ? book.author : '';
        $results.append(`
          <div class="book-result" style="display:flex;align-items:flex-start;gap:16px;margin-bottom:32px;">
            <img src="${img}" alt="${book.title}" style="width:80px;height:110px;object-fit:cover;border-radius:8px;background:#eee;">
            <div>
              <div style="font-size:1.1em;font-weight:bold;margin-bottom:4px;">${book.title}</div>
              <div style="color:#555;margin-bottom:10px;">${author}</div>
              <div style="display:flex; gap:8px;">
                <!-- 左に読んでいる、右に読んだ！ -->
                <button class="register-btn reading" data-bookid="${book.id}">読んでいる</button>
                <button class="register-btn done"    data-bookid="${book.id}">読んだ！</button>
              </div>
            </div>
          </div>
        `);
      });
    }
  } catch (e) {
    $('#bookSearchResults').html('<div>本データの取得に失敗しました。</div>');
    console.error(e);
  }
}

$('#searchBookBtn').on('click', searchBooksByTitle);

// ボタンクリック処理（読んでいる=progress0, 読んだ=progress100）
$('#bookSearchResults').on('click', '.register-btn', async function() {
  const bookId = $(this).data('bookid');
  const userId = parseInt(localStorage.getItem('loginUserId')); //ユーザーID
  const isDone = $(this).hasClass('done'); // 「読んだ！」かどうか
  const progressValue = isDone ? 100 : 0;

  try {
    // 既存のreadingsを取得
    const readings = await $.getJSON(`${API}/readings`);
    // すでに同じuserIdとbookIdの組み合わせが存在するかチェック
    const exists = readings.some(r => r.userId === userId && r.bookId === bookId);
    if (exists) {
      alert('この本はすでに登録されています');
      return;
    }

    // 最大idを取得して+1
    const maxId = readings.length > 0 ? Math.max(...readings.map(r => r.id || 0)) : 0;
    const newId = maxId + 1;

    const readingData = {
      id: newId,
      userId: userId,
      bookId: bookId,
      date: new Date().toISOString().split('T')[0],
      progress: progressValue
    };

    await $.ajax({
      url: `${API}/readings`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(readingData)
    });
    showToast(isDone ? '「読んだ本」に登録しました' : '「読んでいる本」に登録しました');
    showPage('home'); // home画面に遷移
    location.reload(); // ページをリロードして最新情報を表示
  } catch (e) {
    alert('登録に失敗しました');
    console.error(e);
  }
});

function showToast(message) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  container.appendChild(toast);

  // 少し遅れて .show を付与 → アニメーションでフェードイン
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // 3秒後に削除
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      container.removeChild(toast);
    }, 500); // アニメーションが終わるのを待って削除
  }, 3000);
}
