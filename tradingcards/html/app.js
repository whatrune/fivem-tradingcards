
let drag = { active:false, opened:false };

function hardResetPack() {
  const layer = document.getElementById('packLayer');
  layer.classList.add('hidden');

  const top = document.getElementById('packTop');
  top.style.transform = 'translateY(0px)';
  top.style.opacity = '1';

  const launch = document.getElementById('cardLaunchLayer');
  launch.classList.add('hidden');

  const reward = document.getElementById('reward');
  reward.classList.add('hidden');

  drag.active = false;
  drag.opened = false;
}

function openPack() {
  document.getElementById('packLayer').classList.remove('hidden');
}

function launchCardAnimation(imageUrl){
  const layer = document.getElementById('cardLaunchLayer');
  const img = document.getElementById('launchCard');

  img.src = imageUrl || '';
  layer.classList.remove('hidden');

  img.classList.add('launch-up');

  setTimeout(() => {
    img.classList.remove('launch-up');
    img.classList.add('fall-down');
  }, 350);

  setTimeout(() => {
    img.classList.remove('fall-down');
    layer.classList.add('hidden');
    showReward(imageUrl);
  }, 800);
}

function showReward(imageUrl){
  const reward = document.getElementById('reward');
  const img = document.getElementById('rewardCard');
  img.src = imageUrl || '';
  reward.classList.remove('hidden');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hardResetPack();
  }
});

// Demo trigger
setTimeout(() => {
  openPack();
  setTimeout(() => {
    launchCardAnimation('');
  }, 1000);
}, 500);
