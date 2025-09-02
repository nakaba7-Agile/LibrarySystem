const API = "http://localhost:4000";
$(async function() {
    const userId = localStorage.getItem('loginUserId');
    if (!userId) return;

    // ユーザー情報取得
    const users = await $.getJSON(`${API}/users?id=${userId}`);
    if (!users.length) return;
    const user = users[0];

    // 部署・役職名取得
    const [departments, positions] = await Promise.all([
        $.getJSON(`${API}/departments`),
        $.getJSON(`${API}/positions`)
    ]);
    const dept = departments.find(d => d.id === user.departmentId);
    const pos = positions.find(p => p.id === user.positionId);

    // 年数（例: 入社年があれば計算、なければ空欄）
    let years = "";
    if (user.joinYear) {
        const now = new Date();
        years = (now.getFullYear() - user.joinYear + 1) + "年目";
    }

    // 資格（例: user.certsが配列なら表示）
    let certHtml = "";
    if (Array.isArray(user.certs)) {
        certHtml = user.certs.map(c => `<span class="chip">${c}</span>`).join('');
    }

    $('#profileName').text(user.name || "");
    $('#profileDept').text(dept ? dept.name : "");
    $('#profileYears').text(years);
    $('#profilePosition').text(pos ? pos.name : "");
    $('#profileCerts').html(certHtml);
});

// 読んでいる本の表示
$(async function() {
    const userId = localStorage.getItem('loginUserId');
    if (!userId) return;

    // 読んでいる本の取得
    const readings = await $.getJSON(`${API}/readings?userId=${userId}`);
    if (!readings.length) return;

    // 本の情報をまとめて取得
    const bookIds = readings.map(r => r.bookId);
    const books = await $.getJSON(`${API}/books?id=${bookIds.join('&id=')}`);

    // 読書データに本情報をマージ
    const merged = readings.map(r => {
        const book = books.find(b => b.id === r.bookId);
        if (!book) return null;
        return {
            ...r,
            title: book.title,
            author: book.author || "",
            image: book.image || "images/noimage.png"
        };
    }).filter(Boolean);

    // 日付でソート（新しい順）
    merged.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 月ごとにグループ化
    const groups = {};
    merged.forEach(r => {
        const d = new Date(r.date);
        const key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
    });

    // HTML生成
    let html = "";
    for (const [month, items] of Object.entries(groups)) {
        html += `<div class="month-block"><h2>${month}</h2>`;

        items.forEach(r => {
            const d = new Date(r.date);
            const day = `${d.getDate()}日`;

            // 進捗 UI
            let progressUi = "";
            if (r.progress < 100) {
                progressUi = `
                <div class="progress-control">
                    <input type="range" min="0" max="100" step="5" value="${r.progress}"
                        class="progress-slider" data-readingid="${r.id}">
                    <button class="progress-update-btn" data-readingid="${r.id}">更新</button>
                    <span class="progress-value">${r.progress}%</span>
                </div>
                `;
            } else {
                progressUi = `<div class="progress-done">読了！</div>`;
            }

            html += `
              <div class="reading-entry">
                <div class="date">${day}</div>
                <div class="book-card">
                  <img src="${r.image}" alt="${r.title}" class="thumbnail">
                  <div class="book-info">
                    <div class="title">${r.title}</div>
                    <div class="author">${r.author}</div>
                    ${progressUi}
                  </div>
                  <div class="actions">
                    <button class="recommend-btn">おすすめリストに登録</button>
                    <textarea class="comment" placeholder="コメントを入力"></textarea>
                  </div>
                </div>
              </div>
            `;
        });

        html += `</div>`; // month-block
    }

    $('#readingBooks').html(html);

    // スライダーの値をリアルタイム表示
    $(document).on("input", ".progress-slider", function () {
        const val = $(this).val();
        $(this).siblings(".progress-value").text(val + "%");
    });

    // 更新ボタンクリックで progress を更新
    $(document).on("click", ".progress-update-btn", async function () {
        const readingId = $(this).data("readingid");
        const slider = $(`.progress-slider[data-readingid=${readingId}]`);
        const newProgress = slider.val();

        try {
        await $.ajax({
            url: `${API}/readings/${readingId}`,
            method: "PATCH", // API が PATCH に対応している場合
            contentType: "application/json",
            data: JSON.stringify({ progress: Number(newProgress) }),
        });
        alert("進捗を更新しました！");
        location.reload();
        } catch (e) {
        console.error(e);
        alert("進捗の更新に失敗しました");
        }
    });
});