// localStorageからユーザー名・画像を取得して表示
$(async function() {
    const id = localStorage.getItem('loginUserId');
    if (id) {
        try {
            const API = "http://localhost:4000";
            const users = await $.getJSON(`${API}/users?id=${id}`);
            if (users.length > 0) {
                const user = users[0];
                
                // 名前を表示
                if (user.name) {
                    $('#userName').text(user.name);
                }

                // 画像を表示（存在すれば置き換え）
                if (user.avatarimage) {
                    $('#avatarIcon').attr('src', user.avatarimage);
                }
            }
        } catch (e) {
            console.error("ユーザー情報の取得に失敗:", e);
        }
    }
});
