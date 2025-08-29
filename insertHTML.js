const sections = {
        header: 'header.html',
        //   sidebar: 'sidebar.html',
        // ranking: 'ranking.html',
        //   recommendation: 'recommendation.html',
        //   popular: 'popular.html'
        mypage: 'mypage.html',
        };

        for (const [id, file] of Object.entries(sections)) {
        fetch(file)
                .then(res => res.text())
                .then(html => {
                document.getElementById(id).innerHTML = html;
                });
        }