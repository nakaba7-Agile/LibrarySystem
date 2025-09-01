// iframe の高さを中身に合わせて自動調整 + 初回の冊数送信を依頼
function resizeIframe() {
const iframe = document.getElementById('rankingFrame');
if (iframe?.contentWindow?.document?.body) {
    const height = iframe.contentWindow.document.body.scrollHeight;
    iframe.style.height = (height + 30) + 'px';
}
}
document.getElementById('rankingFrame').addEventListener('load', () => {
resizeIframe();
try {
    document.getElementById('rankingFrame')
    .contentWindow?.postMessage({ type: 'request-monthly-count' }, '*');
} catch (_) {}
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
