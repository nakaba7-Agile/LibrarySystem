// iframeの高さ調整処理だけ
function resizeIframe() {
  const iframe = document.getElementById('graphFrame');
  if (iframe?.contentWindow?.document?.body) {
    const height = iframe.contentWindow.document.body.scrollHeight;
    iframe.style.height = (height + 30) + 'px';
  }
}

document.getElementById('graphFrame').addEventListener('load', () => {
  resizeIframe();
});


document.addEventListener('DOMContentLoaded', () => {
const buttons = document.querySelectorAll('.tab-button');
const iframe = document.getElementById('rankingFrame');

buttons.forEach(btn => {
    btn.addEventListener('click', () => {
    // タブの active クラスを切り替え
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // iframe の src を切り替え
    const src = btn.getAttribute('data-src');
    iframe.src = src;
    });
});
});

window.addEventListener('message', (e) => {
  if (e.data?.type === 'show-mypage') {
    showPage('mypage');
  }
});
