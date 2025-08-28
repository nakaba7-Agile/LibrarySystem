const slider = document.getElementById('progressSlider');
const percentLabel = document.getElementById('progressPercent');

slider.addEventListener('input', () => {
    percentLabel.textContent = slider.value + '%';
});