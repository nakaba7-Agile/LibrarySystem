// localStorageからユーザー名を取得して表示
$(async function() {
    const id = localStorage.getItem('loginUserId');
    if (id) {
        try {
            const API = "http://localhost:4000";
            const users = await $.getJSON(`${API}/users?id=${id}`);
            if (users.length > 0 && users[0].name) {
                $('#userName').text(users[0].name);
            }
        } catch (e) {
            // 取得失敗時はデフォルト名のまま
        }
    }
});