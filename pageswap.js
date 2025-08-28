function showPage(pageId) {
  document.querySelectorAll('.page').forEach(div => {
    div.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}