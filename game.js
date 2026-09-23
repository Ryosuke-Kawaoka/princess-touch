const AUDIO = { quiet: 0.28, game: 0.48, effect: 1, fadeMs: 700 };
const TIMING = { countdown: 650, feedback: 480, result: 250 };

const princesses = [
  { id: 'ariel', name: 'アリエル', img: 'assets/1000032634.webp', music: 'audio/ariel.mp3?v=20260923-4' },
  { id: 'rapunzel', name: 'ラプンツェル', img: 'assets/1000032637.webp', music: 'audio/rapunzel.mp3?v=20260923-4' },
  { id: 'jasmine', name: 'ジャスミン', img: 'assets/1000032644.webp', music: 'audio/jasmine.mp3?v=20260923-4' },
  { id: 'snow', name: 'しらゆきひめ', img: 'assets/1000032645.webp', music: 'audio/snow-white.mp3?v=20260923-4' },
];

const levels = {
  easy: { label: 'やさしい', goal: 3, slots: 10, spawnMs: 950, fallSeconds: [3.1, 3.4], lanes: 3, cardMax: 190 },
  normal: { label: 'ふつう', goal: 5, slots: 14, spawnMs: 600, fallSeconds: [2.3, 2.55], lanes: 3, cardMax: 190 },
  hard: { label: 'むずかしい', goal: 10, slots: 25, tailSlots: 4, spawnMs: 400, fallSeconds: [2, 2.2], lanes: 4, cardMax: 165 },
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  bgm: $('#bgm'),
  musicButton: $('#musicBtn'),
  choices: $('#choices'),
  difficultyImage: $('#difficultyImage'),
  targetImage: $('#targetImage'),
  targetName: $('#targetName'),
  miniTarget: $('#miniTarget'),
  miniName: $('#miniName'),
  goalText: $('#goalText'),
  score: $('#score'),
  time: $('#time'),
  feedback: $('#feedback'),
  resultBadge: $('#resultBadge'),
  resultImage: $('#resultImage'),
  finalScore: $('#finalScore'),
  perfectBurst: $('#perfectBurst'),
  playfield: $('#playfield'),
  countdown: $('#countdown'),
};
const effects = {
  correct: $('#correctSound'),
  perfect: $('#perfectSound'),
  almost: $('#almostSound'),
};
const state = {
  target: null,
  level: null,
  duration: 10,
  score: 0,
  time: 10,
  playing: false,
  perfectShown: false,
  spawnQueue: [],
  laneStep: 0,
};
const timers = {
  countdown: null,
  spawn: null,
  tick: null,
  feedback: null,
  volume: null,
  result: null,
};

elements.bgm.volume = AUDIO.quiet;
Object.values(effects).forEach((sound) => { sound.volume = AUDIO.effect; });

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === id);
  });
}

function goalCount() {
  return state.level.goal * (state.duration / 10);
}

function createPrincessChoices() {
  princesses.forEach((princess) => {
    const button = document.createElement('button');
    button.className = 'choice';
    button.innerHTML = `<img src="${princess.img}" alt="${princess.name}"><span>${princess.name}</span>`;
    button.addEventListener('click', () => choosePrincess(princess));
    elements.choices.append(button);
  });
}

function choosePrincess(princess) {
  state.target = princess;
  clearInterval(timers.volume);
  elements.bgm.pause();
  elements.bgm.src = princess.music;
  elements.bgm.load();
  elements.bgm.volume = AUDIO.quiet;

  elements.difficultyImage.src = princess.img;
  elements.difficultyImage.alt = princess.name;
  elements.targetImage.src = princess.img;
  elements.targetImage.alt = princess.name;
  elements.targetName.textContent = princess.name;
  elements.miniTarget.src = princess.img;
  elements.miniName.textContent = princess.name;

  showScreen('difficulty');
  playQuietBgm(true);
}

function updateDifficultyLabels() {
  document.querySelectorAll('.difficulty-btn').forEach((button) => {
    const selectedLevel = levels[button.dataset.level];
    const goal = selectedLevel.goal * (state.duration / 10);
    button.querySelector('span').textContent = `${goal}こで パーフェクト`;
  });
}

function selectDuration(button) {
  playQuietBgm(false);
  state.duration = Number(button.dataset.time);
  document.querySelectorAll('.time-btn').forEach((item) => {
    item.classList.toggle('active', item === button);
  });
  updateDifficultyLabels();
}

function selectDifficulty(button) {
  playQuietBgm(false);
  state.level = levels[button.dataset.level];
  elements.goalText.textContent = `${state.duration}びょう・${state.level.label}：${goalCount()}こで パーフェクト！`;
  showScreen('ready');
}

function startGame() {
  resetGameState();
  startGameBgm();
  showScreen('game');
  startCountdown();
}

function resetGameState() {
  state.score = 0;
  state.time = state.duration;
  state.playing = false;
  state.perfectShown = false;
  clearTimeout(timers.feedback);
  clearTimeout(timers.result);

  elements.score.textContent = state.score;
  elements.time.textContent = state.time;
  elements.feedback.textContent = '';
  elements.feedback.className = 'feedback';
  elements.resultBadge.textContent = '';
  elements.resultBadge.className = 'result-badge';
  elements.perfectBurst.className = 'perfect-burst';
  elements.playfield.replaceChildren();
}

function startGameBgm() {
  if (elements.bgm.paused) {
    elements.bgm.currentTime = 0;
    elements.bgm.volume = AUDIO.quiet;
  }
  const attempt = elements.bgm.play();
  if (attempt) {
    attempt.then(() => setMusicStatus(true)).catch(() => setMusicStatus(false));
  }
  fadeVolume(AUDIO.game, AUDIO.fadeMs);
}

function startCountdown() {
  let count = 3;
  elements.countdown.textContent = count;
  clearInterval(timers.countdown);
  timers.countdown = setInterval(() => {
    count -= 1;
    if (count > 0) {
      elements.countdown.textContent = count;
    } else if (count === 0) {
      elements.countdown.textContent = 'GO!';
    } else {
      clearInterval(timers.countdown);
      elements.countdown.textContent = '';
      beginPlay();
    }
  }, TIMING.countdown);
}

function beginPlay() {
  state.playing = true;
  state.laneStep = Math.floor(Math.random() * state.level.lanes);
  state.spawnQueue = makeSpawnQueue();
  spawnCard();
  timers.spawn = setInterval(spawnCard, state.level.spawnMs);
  timers.tick = setInterval(tickClock, 1000);
}

function tickClock() {
  state.time -= 1;
  elements.time.textContent = state.time;
  if (state.time <= 0) finishGame();
}

function makeSpawnQueue() {
  const others = princesses.filter((princess) => princess.id !== state.target.id);
  const goal = goalCount();
  const slotCount = state.level.slots * (state.duration / 10);
  const targetSpan = slotCount - (state.level.tailSlots || 0);
  const queue = Array.from({ length: slotCount }, (_, index) => others[index % others.length]);
  const usedPositions = new Set();

  for (let index = 0; index < goal; index += 1) {
    let position = Math.floor(((index + 0.5) * targetSpan) / goal);
    while (usedPositions.has(position) && position < targetSpan - 1) position += 1;
    usedPositions.add(position);
    queue[position] = state.target;
  }
  return queue;
}

function spawnCard() {
  if (!state.playing) return;

  const others = princesses.filter((princess) => princess.id !== state.target.id);
  const princess = state.spawnQueue.length
    ? state.spawnQueue.shift()
    : others[Math.floor(Math.random() * others.length)];
  const lane = state.laneStep % state.level.lanes;
  const laneWidth = elements.playfield.clientWidth / state.level.lanes;
  const cardWidth = Math.min(laneWidth - 10, state.level.cardMax);
  const [minimumFall, maximumFall] = state.level.fallSeconds;
  const card = document.createElement('img');
  state.laneStep += 1;

  card.className = 'falling';
  card.src = princess.img;
  card.alt = princess.name;
  card.dataset.id = princess.id;
  card.style.width = `${cardWidth}px`;
  card.style.maxWidth = 'none';
  card.style.left = `${lane * laneWidth + (laneWidth - cardWidth) / 2}px`;
  card.style.setProperty('--spin', `${Math.random() * 8 - 4}deg`);
  card.style.animationDuration = `${minimumFall + Math.random() * (maximumFall - minimumFall)}s`;
  card.addEventListener('pointerdown', (event) => handleCardTouch(event, card, princess));
  card.addEventListener('animationend', () => card.remove());
  elements.playfield.append(card);
}

function handleCardTouch(event, card, princess) {
  event.preventDefault();
  if (!state.playing || card.dataset.hit) return;
  card.dataset.hit = '1';

  if (princess.id === state.target.id) {
    handleCorrectTouch(card);
  } else {
    handleWrongTouch(card);
  }
}

function handleCorrectTouch(card) {
  state.score += 1;
  elements.score.textContent = state.score;
  playSound(effects.correct);
  showFeedback('せいかい！ ✨', true);

  if (state.score >= goalCount() && !state.perfectShown) {
    state.perfectShown = true;
    elements.perfectBurst.classList.remove('show');
    void elements.perfectBurst.offsetWidth;
    elements.perfectBurst.classList.add('show');
  }

  card.style.transition = '.25s';
  card.style.transform = 'scale(1.4)';
  card.style.opacity = '0';
  setTimeout(() => card.remove(), 220);
}

function handleWrongTouch(card) {
  showFeedback('ちがうよ', false);
  card.animate(
    [{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
    { duration: 220 },
  );
}

function showFeedback(message, isCorrect) {
  clearTimeout(timers.feedback);
  elements.feedback.textContent = message;
  elements.feedback.style.color = isCorrect ? '#ffe762' : '#fff';
  elements.feedback.classList.remove('pop');
  void elements.feedback.offsetWidth;
  elements.feedback.classList.add('pop');
  timers.feedback = setTimeout(() => {
    elements.feedback.textContent = '';
    elements.feedback.classList.remove('pop');
  }, TIMING.feedback);
}

function finishGame() {
  stopGame();
  const goal = goalCount();
  const isPerfect = state.score >= goal;

  elements.finalScore.textContent = state.score;
  elements.resultImage.src = state.target.img;
  elements.resultImage.alt = state.target.name;
  elements.resultBadge.textContent = '';
  elements.resultBadge.className = 'result-badge';
  if (isPerfect) {
    elements.resultBadge.classList.add('perfect');
  } else {
    elements.resultBadge.textContent = `あと ${goal - state.score}こで パーフェクト！`;
  }

  timers.result = setTimeout(() => {
    showScreen('result');
    playSound(isPerfect ? effects.perfect : effects.almost);
  }, TIMING.result);
}

function stopGame() {
  state.playing = false;
  clearInterval(timers.countdown);
  clearInterval(timers.spawn);
  clearInterval(timers.tick);
  clearInterval(timers.volume);
  elements.bgm.pause();
  setMusicStatus(false);
}

function playSound(sound) {
  sound.pause();
  sound.currentTime = 0;
  const attempt = sound.play();
  if (attempt) attempt.catch(() => {});
}

function fadeVolume(targetVolume, duration) {
  clearInterval(timers.volume);
  const startingVolume = elements.bgm.volume;
  const steps = 14;
  let step = 0;

  timers.volume = setInterval(() => {
    step += 1;
    const nextVolume = startingVolume + (targetVolume - startingVolume) * (step / steps);
    elements.bgm.volume = Math.min(1, Math.max(0, nextVolume));
    if (step >= steps) clearInterval(timers.volume);
  }, duration / steps);
}

function setMusicStatus(isPlaying) {
  elements.musicButton.hidden = isPlaying;
  elements.musicButton.textContent = '🔊 おんがくを きく';
  elements.musicButton.classList.toggle('playing', isPlaying);
}

function playQuietBgm(restart) {
  clearInterval(timers.volume);
  elements.bgm.volume = AUDIO.quiet;
  if (restart && elements.bgm.readyState > 0) elements.bgm.currentTime = 0;

  const attempt = elements.bgm.play();
  if (attempt) {
    attempt.then(() => setMusicStatus(true)).catch(() => setMusicStatus(false));
  } else {
    setMusicStatus(true);
  }
}

function bindControls() {
  document.querySelectorAll('.time-btn').forEach((button) => {
    button.addEventListener('click', () => selectDuration(button));
  });
  document.querySelectorAll('.difficulty-btn').forEach((button) => {
    button.addEventListener('click', () => selectDifficulty(button));
  });
  document.querySelectorAll('.back').forEach((button) => {
    button.addEventListener('click', () => {
      stopGame();
      showScreen('select');
    });
  });
  elements.musicButton.addEventListener('click', () => playQuietBgm(false));
  $('#startBtn').addEventListener('click', startGame);
  $('#againBtn').addEventListener('click', startGame);
}

createPrincessChoices();
bindControls();
