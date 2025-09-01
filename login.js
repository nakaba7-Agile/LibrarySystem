const API = "http://localhost:4000";
$('#loginForm').on('submit', async function(e) {
    e.preventDefault();
    const id = Number($('#employeeId').val());
    const password = $('#password').val();
    $('#loginError').text('');
    try {
    const users = await $.getJSON(`${API}/users?id=${id}`);
    if (users.length === 1 && users[0].password === password) {
        // ログイン成功: ユーザーIDをlocalStorageに保存
        localStorage.setItem('loginUserId', id);
        window.location.href = "home.html"; // home画面に遷移
    } else {
        $('#loginError').text('社員IDまたはパスワードが正しくありません');
    }
    } catch (err) {
    $('#loginError').text('通信エラーが発生しました');
    }
});