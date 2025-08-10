const startButton = document.getElementById('start-button');
const container = document.getElementById('container');
const scene = document.querySelector('a-scene');

startButton.addEventListener('click', () => {
  container.style.display = 'none';
  scene.style.display = 'block';
});
