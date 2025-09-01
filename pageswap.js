function showPage(pageId) {
  if (pageId === 'logout') {
    localStorage.removeItem('loginUserId');
    location.reload();
    window.location.href = "login.html";
  }
  document.querySelectorAll('.page').forEach(div => {
    div.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}