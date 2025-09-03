const sections = {
        header: 'header.html',
        //   sidebar: 'sidebar.html',
        //   ranking: 'ranking.html',
        //   recommendation: 'recommendation.html',
        //   popular: 'popular.html',
        kensaku: 'search.html',
        roomselect: 'roomselect.html',
        mypage: 'mypage.html'
        };

        for (const [id, file] of Object.entries(sections)) {
        fetch(file)
                .then(res => res.text())
                .then(html => {
                document.getElementById(id).innerHTML = html;
                // 必要なJSを動的に読み込む
                if (id === 'header') {
                        const script = document.createElement('script');
                        script.src = './header.js';
                        document.body.appendChild(script);
                }
                if (id === 'mypage') {
                        const script = document.createElement('script');
                        script.src = './mypage.js';
                        document.body.appendChild(script);
                }
                if (id === 'search') {
                        const script = document.createElement('script');
                        script.src = './search.js';
                        document.body.appendChild(script);
                }
                if (id === 'roomselect') {
                        const script = document.createElement('script');
                        script.src = './roomselect.js';
                        document.body.appendChild(script);
                }
        });
}