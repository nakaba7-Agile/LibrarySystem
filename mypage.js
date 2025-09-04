// ====== settings ======
const API_MYPAGE = "http://localhost:4000";

// ====== 便利関数 ======
function ymdToday() {
  var d = new Date();
  var pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function requestMonthlyCountFromRanking() {
  try {
    var f = document.getElementById("rankingFrame");
    f?.contentWindow?.postMessage({ type: "request-monthly-count" }, "*");
  } catch (_) {}
}
function showToast(msg) {
  var container = document.getElementById("toastContainer");
  if (!container) { alert(msg); return; }
  var toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => container.removeChild(toast), 400);
  }, 2400);
}

// ========== プロフィール ==========
$(async function () {
  var userId = localStorage.getItem("mypageUserId");
  if (!userId) return;

  var users = await $.getJSON(`${ API_MYPAGE}/users?id=${encodeURIComponent(userId)}`);
  if (!users.length) return;
  var user = users[0];

  var [departments, positions] = await Promise.all([
    $.getJSON(`${ API_MYPAGE}/departments`),
    $.getJSON(`${ API_MYPAGE}/positions`),
  ]);
  var dept = departments.find((d) => String(d.id) === String(user.departmentId));
  var pos  = positions.find((p) => String(p.id) === String(user.positionId));

  let years = "";
  if (user.joinYear) {
    var now = new Date();
    years = now.getFullYear() - user.joinYear + 1 + "年目";
  }

  let certHtml = "";
  if (Array.isArray(user.certs)) {
    certHtml = user.certs.map((c) => `<span class="chip">${c}</span>`).join("");
  }

  $("#avatarimage").html(`<img src="${user.avatarimage}" alt="avatar" />`);
  $("#profileName").text(user.name || "");
  $("#profileDept").text(dept ? dept.name : "");
  $("#profileYears").text(years);
  $("#profilePosition").text(pos ? pos.name : "");
  $("#profileCerts").html(certHtml);
});

// ========== 読んでいる本 ==========
$(async function () {
  var userId = localStorage.getItem("mypageUserId");
  if (!userId) return;

  var readings = await $.getJSON(`${ API_MYPAGE}/readings?userId=${encodeURIComponent(userId)}`);
  if (!readings.length) {
    $("#readingBooks").html(`<div class="muted">（読書履歴はありません）</div>`);
    return;
  }

  var bookIds = readings.map((r) => r.bookId);
  var books = await $.getJSON(
    `${ API_MYPAGE}/books?id=${bookIds.map(encodeURIComponent).join("&id=")}`
  );

  var merged = readings
    .map((r) => {
      var book = books.find((b) => String(b.id) === String(r.bookId));
      if (!book) return null;
      return {
        ...r,
        title:  book.title,
        author: book.author || "",
        image:  book.image || "images/noimage.png",
        comment: (r.comment ?? "")
      };
    })
    .filter(Boolean);

  merged.sort((a, b) => new Date(b.date) - new Date(a.date));

  var groups = {};
  merged.forEach((r) => {
    var d = new Date(r.date);
    var key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    (groups[key] ||= []).push(r);
  });

  let out = "";
  for (var [month, items] of Object.entries(groups)) {
    out += `<div class="month-block"><h2>${month}</h2>`;
    items.forEach((r) => {
      var d = new Date(r.date);
      var day = `${d.getDate()}日`;

      var progressUi =
        Number(r.progress ?? 0) < 100
          ? `
          <div class="progress-control" data-readingid="${r.id}">
            <input type="range" min="0" max="100" step="1" value="${Number(r.progress ?? 0)}"
                   class="progress-slider" data-readingid="${r.id}">
            <span class="progress-value">${Number(r.progress ?? 0)}%</span>
            <span class="save-status" aria-live="polite"></span>
          </div>
        `
          : `<div class="progress-done">読了！</div>`;

      // ★ ここを変更：テキストエリア → ボタンの順／ボタン名を「コメント登録」に
      out += `
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
              <textarea class="comment" placeholder="コメントを入力" data-readingid="${r.id}">${(r.comment || "")}</textarea>
              <button class="comment-save-btn" data-readingid="${r.id}">コメント登録</button>
              <span class="comment-status"></span>
            </div>
          </div>
        </div>
      `;
    });
    out += `</div>`;
  }
  $("#readingBooks").html(out);

  // ===== スライダー：表示更新（ドラッグ中）
  $(document).on("input", ".progress-slider", function () {
    var val = $(this).val();
    var box = $(this).closest(".progress-control");
    box.find(".progress-value").text(`${val}%`);
    var st = box.find(".save-status");
    st.text(val === $(this).data("_lastSaved") ? "" : "未保存の変更…");
  });

  // ===== スライダー：離したら保存
  $(document).on("change", ".progress-slider", async function () {
    var readingId = String($(this).data("readingid"));
    var newVal = Number($(this).val());
    await saveProgress(readingId, newVal);
  });

  // ===== コメント登録ボタン
  $(document).on("click", ".comment-save-btn", async function () {
    var readingId = String($(this).data("readingid"));
    var wrap = $(this).closest(".actions");
    var ta = wrap.find(`.comment[data-readingid="${readingId}"]`);
    var status = wrap.find(".comment-status");
    var text = (ta.val() || "").toString();

    try {
      $(this).prop("disabled", true);
      ta.prop("disabled", true);
      status.text("保存中…");

      await $.ajax({
        url: `${ API_MYPAGE}/readings/${encodeURIComponent(readingId)}`,
        method: "PATCH",
        contentType: "application/json",
        data: JSON.stringify({ comment: text }),
      });

      status.text("保存しました ✔");
      showToast("コメントを保存しました");
    } catch (e) {
      console.error(e);
      status.text("保存失敗");
      alert("コメントの保存に失敗しました");
    } finally {
      $(this).prop("disabled", false);
      ta.prop("disabled", false);
      setTimeout(() => status.text(""), 1200);
    }
  });

  // Ctrl+Enter でコメント保存
  $(document).on("keydown", ".comment", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      var readingId = String($(this).data("readingid"));
      $(this).closest(".actions").find(`.comment-save-btn[data-readingid="${readingId}"]`).trigger("click");
    }
  });

  // ====== 進捗保存処理 ======
  async function saveProgress(readingId, value) {
    var box = $(`.progress-control[data-readingid="${readingId}"]`);
    var slider = box.find(".progress-slider");
    var status = box.find(".save-status");
    var valueEl = box.find(".progress-value");

    slider.prop("disabled", true);
    status.text("保存中…");

    var payload = value >= 100 ? { progress: 100, date: ymdToday() } : { progress: value };

    try {
      await $.ajax({
        url: `${ API_MYPAGE}/readings/${encodeURIComponent(readingId)}`,
        method: "PATCH",
        contentType: "application/json",
        data: JSON.stringify(payload),
      });

      slider.data("_lastSaved", value);
      status.text("保存済み ✔");

      if (value >= 100) {
        box.replaceWith(`<div class="progress-done">読了！</div>`);
        showToast("「読んだ本」に登録しました");
        requestMonthlyCountFromRanking();
      } else {
        valueEl.text(`${value}%`);
      }
    } catch (e) {
      console.error(e);
      status.text("保存失敗。再試行してください");
      var last = Number(slider.data("_lastSaved"));
      if (!Number.isNaN(last)) {
        slider.val(String(last));
        valueEl.text(`${last}%`);
      }
    } finally {
      slider.prop("disabled", false);
      setTimeout(() => status.text(""), 1200);
    }
  }
});


// ====== 他タブで userId が変わったら再描画 ======
window.addEventListener("storage", (e) => {
    if (e.key === "mypageUserId") {
        renderMypage(e.newValue);  // ユーザーIDを渡して再描画
    }
});


// ====== 再描画関数 ======
async function renderMypage(userId) {
  // 今の $(async function () { ... }) の中身を関数化して呼び出す
  userId = localStorage.getItem("mypageUserId");
  if (!userId) return;

  var users = await $.getJSON(`${ API_MYPAGE}/users?id=${encodeURIComponent(userId)}`);
  if (!users.length) return;
  var user = users[0];

  var [departments, positions] = await Promise.all([
    $.getJSON(`${ API_MYPAGE}/departments`),
    $.getJSON(`${ API_MYPAGE}/positions`),
  ]);
  var dept = departments.find((d) => String(d.id) === String(user.departmentId));
  var pos  = positions.find((p) => String(p.id) === String(user.positionId));

  let years = "";
  if (user.joinYear) {
    var now = new Date();
    years = now.getFullYear() - user.joinYear + 1 + "年目";
  }

  let certHtml = "";
  if (Array.isArray(user.certs)) {
    certHtml = user.certs.map((c) => `<span class="chip">${c}</span>`).join("");
  }

  $("#avatarimage").html(`<img src="${user.avatarimage}" alt="avatar" />`);
  $("#profileName").text(user.name || "");
  $("#profileDept").text(dept ? dept.name : "");
  $("#profileYears").text(years);
  $("#profilePosition").text(pos ? pos.name : "");
  $("#profileCerts").html(certHtml);

  var readings = await $.getJSON(`${ API_MYPAGE}/readings?userId=${encodeURIComponent(userId)}`);
  if (!readings.length) {
    $("#readingBooks").html(`<div class="muted">（読書履歴はありません）</div>`);
    return;
  }

  var bookIds = readings.map((r) => r.bookId);
  var books = await $.getJSON(
    `${ API_MYPAGE}/books?id=${bookIds.map(encodeURIComponent).join("&id=")}`
  );

  var merged = readings
    .map((r) => {
      var book = books.find((b) => String(b.id) === String(r.bookId));
      if (!book) return null;
      return {
        ...r,
        title:  book.title,
        author: book.author || "",
        image:  book.image || "images/noimage.png",
        comment: (r.comment ?? "")
      };
    })
    .filter(Boolean);

  merged.sort((a, b) => new Date(b.date) - new Date(a.date));

  var groups = {};
  merged.forEach((r) => {
    var d = new Date(r.date);
    var key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    (groups[key] ||= []).push(r);
  });

  let out = "";
  for (var [month, items] of Object.entries(groups)) {
    out += `<div class="month-block"><h2>${month}</h2>`;
    items.forEach((r) => {
      var d = new Date(r.date);
      var day = `${d.getDate()}日`;

      var progressUi =
        Number(r.progress ?? 0) < 100
          ? `
          <div class="progress-control" data-readingid="${r.id}">
            <input type="range" min="0" max="100" step="1" value="${Number(r.progress ?? 0)}"
                   class="progress-slider" data-readingid="${r.id}">
            <span class="progress-value">${Number(r.progress ?? 0)}%</span>
            <span class="save-status" aria-live="polite"></span>
          </div>
        `
          : `<div class="progress-done">読了！</div>`;

      // ★ ここを変更：テキストエリア → ボタンの順／ボタン名を「コメント登録」に
      out += `
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
              <textarea class="comment" placeholder="コメントを入力" data-readingid="${r.id}">${(r.comment || "")}</textarea>
              <button class="comment-save-btn" data-readingid="${r.id}">コメント登録</button>
              <span class="comment-status"></span>
            </div>
          </div>
        </div>
      `;
    });
    out += `</div>`;
  }
  $("#readingBooks").html(out);

  // ===== スライダー：表示更新（ドラッグ中）
  $(document).on("input", ".progress-slider", function () {
    var val = $(this).val();
    var box = $(this).closest(".progress-control");
    box.find(".progress-value").text(`${val}%`);
    var st = box.find(".save-status");
    st.text(val === $(this).data("_lastSaved") ? "" : "未保存の変更…");
  });

  // ===== スライダー：離したら保存
  $(document).on("change", ".progress-slider", async function () {
    var readingId = String($(this).data("readingid"));
    var newVal = Number($(this).val());
    await saveProgress(readingId, newVal);
  });

  // ===== コメント登録ボタン
  $(document).on("click", ".comment-save-btn", async function () {
    var readingId = String($(this).data("readingid"));
    var wrap = $(this).closest(".actions");
    var ta = wrap.find(`.comment[data-readingid="${readingId}"]`);
    var status = wrap.find(".comment-status");
    var text = (ta.val() || "").toString();

    try {
      $(this).prop("disabled", true);
      ta.prop("disabled", true);
      status.text("保存中…");

      await $.ajax({
        url: `${ API_MYPAGE}/readings/${encodeURIComponent(readingId)}`,
        method: "PATCH",
        contentType: "application/json",
        data: JSON.stringify({ comment: text }),
      });

      status.text("保存しました ✔");
      showToast("コメントを保存しました");
    } catch (e) {
      console.error(e);
      status.text("保存失敗");
      alert("コメントの保存に失敗しました");
    } finally {
      $(this).prop("disabled", false);
      ta.prop("disabled", false);
      setTimeout(() => status.text(""), 1200);
    }
  });

  // Ctrl+Enter でコメント保存
  $(document).on("keydown", ".comment", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      var readingId = String($(this).data("readingid"));
      $(this).closest(".actions").find(`.comment-save-btn[data-readingid="${readingId}"]`).trigger("click");
    }
  });

  // ====== 進捗保存処理 ======
  async function saveProgress(readingId, value) {
    var box = $(`.progress-control[data-readingid="${readingId}"]`);
    var slider = box.find(".progress-slider");
    var status = box.find(".save-status");
    var valueEl = box.find(".progress-value");

    slider.prop("disabled", true);
    status.text("保存中…");

    var payload = value >= 100 ? { progress: 100, date: ymdToday() } : { progress: value };

    try {
      await $.ajax({
        url: `${ API_MYPAGE}/readings/${encodeURIComponent(readingId)}`,
        method: "PATCH",
        contentType: "application/json",
        data: JSON.stringify(payload),
      });

      slider.data("_lastSaved", value);
      status.text("保存済み ✔");

      if (value >= 100) {
        box.replaceWith(`<div class="progress-done">読了！</div>`);
        showToast("「読んだ本」に登録しました");
        requestMonthlyCountFromRanking();
      } else {
        valueEl.text(`${value}%`);
      }
    } catch (e) {
      console.error(e);
      status.text("保存失敗。再試行してください");
      var last = Number(slider.data("_lastSaved"));
      if (!Number.isNaN(last)) {
        slider.val(String(last));
        valueEl.text(`${last}%`);
      }
    } finally {
      slider.prop("disabled", false);
      setTimeout(() => status.text(""), 1200);
    }
  }
}

