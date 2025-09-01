// const slider = document.getElementById('progressSlider');
// const percentLabel = document.getElementById('progressPercent');

// slider.addEventListener('input', () => {
//     percentLabel.textContent = slider.value + '%';
// });


const slider = document.getElementById('progressSlider');
const percentLabel = document.getElementById('progressPercent');
const wrap = document.querySelector('.progress-wrap');
const id = wrap.dataset.id; 
const readBtn = wrap.querySelector(".readBtn");

slider.addEventListener('input', () => {
    percentLabel.textContent = slider.value + '%';
});

// 読んだ！ボタン → 強制的に100%にする
readBtn.addEventListener("click", async () => {
    try {
        const res = await fetch(`http://localhost:4000/readings/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ progress: 100 })
        });
        if (!res.ok) throw new Error("更新失敗");

        // UIも即反映
        slider.value = 100;
        text.textContent = "100%";
        bar.style.width = "100%";
        alert("読了に更新しました！");
    } catch (err) {
        console.error(err);
        alert("エラーが発生しました");
    }
});