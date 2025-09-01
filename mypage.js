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
    // let certHtml = "";
    // if (Array.isArray(user.certs)) {
    //     certHtml = user.certs.map(c => `<span class="chip">${c}</span>`).join('');
    // }

    $('#profileName').text(user.name || "");
    $('#profileMail').text(user.email || "");
    $('#profileDept').text(dept ? dept.name : "");
    $('#profileYears').text(years);
    $('#profilePosition').text(pos ? pos.name : "");
    // $('#profileCerts').html(certHtml);
});