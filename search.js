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
              <button class="register-btn" data-bookid="${book.id}">読んでいるに登録</button>
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