const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("statusOverlay");
const statusText = document.getElementById("statusText");
const toggleButton = document.getElementById("toggleButton");
const settingsButton = document.getElementById("settingsButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const settingsModal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettings");
const restartButton = document.getElementById("restartButton");
const runStats = document.getElementById("runStats");

// HUD Elements
const scoreLabel = document.getElementById("scoreLabel");
const multiplierLabel = document.getElementById("multiplierLabel");
const timeLabel = document.getElementById("timeLabel");
const livesLabel = document.getElementById("livesLabel");
const bestLabel = document.getElementById("bestLabel");
const streakLabel = document.getElementById("streakLabel");
const shieldLabel = document.getElementById("shieldLabel");
const dashLabel = document.getElementById("dashLabel");
const narrativeLog = document.getElementById("narrativeLog");
const logContent = document.getElementById("logContent");
const questHud = document.getElementById("questHud");
const questText = document.getElementById("questText");
const questBar = document.getElementById("questBar");

// Mobile Controls
const mobileControls = document.getElementById("mobileControls");
const joystickArea = document.getElementById("joystickArea");
const joystickKnob = document.getElementById("joystickKnob");
const mobileDashBtn = document.getElementById("mobileDashBtn");
const tiltButton = document.getElementById("tiltButton");

// Settings & Modifiers
const settings = {
  colorblind: false,
  shake: true,
  particles: true,
  bloom: true,
  crt: false,
};

const modifiers = {
  hardcore: false,
  pacifist: false,
  tiny: false,
  doubleSpeed: false,
};

// Game Constants
const field = { width: 900, height: 540, dpr: window.devicePixelRatio || 1 };
const input = { up: false, down: false, left: false, right: false, mouseX: 0, mouseY: 0, mouseDown: false };
const DASH_COOLDOWN = 4.2;
const DASH_DURATION = 0.24;
const DASH_MULTIPLIER = 2.6;
const SHIELD_DURATION = 6;
const MAX_LIVES = 5;

// Game State
const player = { x: field.width / 2, y: field.height / 2, r: 15, speed: 320, trail: [], ghost: [] };
let orbs = [];
let hazards = [];
let powerups = [];
let particles = [];
let textPopups = [];

let lastTick = 0;
let orbTimer = 0;
let hazardTimer = 0;
let powerTimer = 0;
let questTimer = 0;
let nextShieldSpawn = 6 + Math.random() * 6;
let camera = { x: 0, y: 0, zoom: 1, shake: 0 };
let slowMoFactor = 1.0;
let slowMoTimer = 0;
let pseudoFullscreen = false;
const tiltState = { enabled: false, x: 0, y: 0, targetX: 0, targetY: 0 };

// Glitch / Creative Mode State
let glitchTimer = 0;
let nextGlitchTime = 15; // First glitch at 15s
let activeGlitch = null; // { type: 'invert' | 'wind' | 'zoom' | 'disco', time: 0 }
let currentPalette = {
  bg1: "rgba(138,245,255,0.08)",
  bg2: "rgba(255,109,214,0.08)",
  player: "#8af5ff",
  hazard: "#ff6dd6",
  orb: "#ffd166"
};

const state = {
  mode: "idle", // idle | running | paused | over
  score: 0,
  multiplier: 1,
  lives: 3,
  time: 0,
  streak: 0,
  shieldTime: 0,
  dashTime: 0,
  dashCooldown: 0,
  best: Number(localStorage.getItem("neonDriftBest") || 0),
  quest: null, // { type, target, current, time, reward }
  stats: {
    accuracy: 0, // hits / (hits + misses) - simplified to just "time alive vs hits" maybe?
    nearMisses: 0,
    damageBlocked: 0,
    orbsCollected: 0,
  }
};

// --- Initialization & Events ---

canvas.tabIndex = 0;
canvas.setAttribute("role", "application");

// Input Handling
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" || e.key === "w") input.up = true;
  if (e.key === "ArrowDown" || e.key === "s") input.down = true;
  if (e.key === "ArrowLeft" || e.key === "a") input.left = true;
  if (e.key === "ArrowRight" || e.key === "d") input.right = true;
  if (e.key === " " || e.key === "Shift") triggerDash();
  if (e.key === "Enter") togglePlay();
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp" || e.key === "w") input.up = false;
  if (e.key === "ArrowDown" || e.key === "s") input.down = false;
  if (e.key === "ArrowLeft" || e.key === "a") input.left = false;
  if (e.key === "ArrowRight" || e.key === "d") input.right = false;
});

function updatePointerPosition(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  input.mouseX = (clientX - rect.left) * (field.width / rect.width);
  input.mouseY = (clientY - rect.top) * (field.height / rect.height);
}

canvas.addEventListener("mousemove", (e) => {
  updatePointerPosition(e.clientX, e.clientY);
});
canvas.addEventListener("mousedown", () => input.mouseDown = true);
canvas.addEventListener("mouseup", () => input.mouseDown = false);

const handleTouch = (e) => {
  const touch = e.touches[0] || e.changedTouches[0];
  if (!touch) return;
  updatePointerPosition(touch.clientX, touch.clientY);
};

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  handleTouch(e);
  input.mouseDown = true;
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  handleTouch(e);
}, { passive: false });

const endTouch = (e) => {
  e.preventDefault();
  handleTouch(e);
  input.mouseDown = false;
};

canvas.addEventListener("touchend", endTouch, { passive: false });
canvas.addEventListener("touchcancel", endTouch, { passive: false });

toggleButton.addEventListener("click", togglePlay);
restartButton.addEventListener("click", () => {
  resetGame();
  state.mode = "running";
  hideOverlay();
});

settingsButton.addEventListener("click", () => settingsModal.classList.remove("hidden"));
fullscreenButton.addEventListener("click", toggleFullscreen);
closeSettings.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
  updateSettings();
});

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
}

function supportsNativeFullscreen() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.documentElement.webkitRequestFullscreen);
}

function requestNativeFullscreen() {
  const elem = document.documentElement;
  const request = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
  if (request) return request.call(elem);
  return Promise.reject(new Error("Fullscreen API unavailable"));
}

function exitNativeFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (exit) return exit.call(document);
  return Promise.reject(new Error("Fullscreen exit unavailable"));
}

function togglePseudoFullscreenMode(force) {
  if (typeof force === "boolean") {
    pseudoFullscreen = force;
  } else {
    pseudoFullscreen = !pseudoFullscreen;
  }
  document.body.classList.toggle("pseudo-fullscreen", pseudoFullscreen);
}

function toggleFullscreen() {
  if (supportsNativeFullscreen()) {
    if (getFullscreenElement()) {
      exitNativeFullscreen().catch(() => togglePseudoFullscreenMode(false));
    } else {
      requestNativeFullscreen().catch(() => togglePseudoFullscreenMode(true));
    }
  } else {
    togglePseudoFullscreenMode();
  }
}

// --- Touch / Mobile Controls ---

let isTouch = false;
let joystickData = { active: false, originX: 0, originY: 0, currentX: 0, currentY: 0, id: null };

function detectTouch() {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    isTouch = true;
    mobileControls.classList.remove("hidden");
    if (tiltButton && supportsTiltSensors()) {
      tiltButton.classList.remove("hidden");
      joystickArea?.classList.add("hidden");
    } else {
      joystickArea?.classList.remove("hidden");
    }
  }
}
detectTouch();

// Joystick Logic
joystickArea.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  joystickData.id = touch.identifier;
  joystickData.active = true;
  
  const rect = joystickArea.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  joystickData.originX = centerX;
  joystickData.originY = centerY;
  
  updateJoystick(touch.clientX, touch.clientY);
}, { passive: false });

joystickArea.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (!joystickData.active) return;
  
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickData.id) {
      updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
      break;
    }
  }
}, { passive: false });

const endJoystick = (e) => {
  e.preventDefault();
  if (!joystickData.active) return;
  
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickData.id) {
      joystickData.active = false;
      joystickData.id = null;
      resetJoystickUI();
      input.up = input.down = input.left = input.right = false;
      break;
    }
  }
};

joystickArea.addEventListener("touchend", endJoystick);
joystickArea.addEventListener("touchcancel", endJoystick);

function updateJoystick(x, y) {
  const maxDist = 35; // Max distance knob can move
  const dx = x - joystickData.originX;
  const dy = y - joystickData.originY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  const moveDist = Math.min(dist, maxDist);
  const moveX = Math.cos(angle) * moveDist;
  const moveY = Math.sin(angle) * moveDist;
  
  joystickKnob.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
  
  // Map to input
  const threshold = 10;
  input.right = dx > threshold;
  input.left = dx < -threshold;
  input.down = dy > threshold;
  input.up = dy < -threshold;
}

function resetJoystickUI() {
  joystickKnob.style.transform = `translate(-50%, -50%)`;
}

// Mobile Dash
mobileDashBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  triggerDash();
  mobileDashBtn.style.transform = "scale(0.9)";
}, { passive: false });

mobileDashBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  mobileDashBtn.style.transform = "scale(1)";
});

tiltButton?.addEventListener("click", (e) => {
  e.preventDefault();
  enableTiltControls();
});

function supportsTiltSensors() {
  return typeof DeviceOrientationEvent !== "undefined";
}

function enableTiltControls() {
  if (!supportsTiltSensors()) {
    showJoystickFallback("Tilt not supported on this device.");
    return;
  }

  const beginTilt = () => {
    if (tiltState.enabled) return;
    window.addEventListener("deviceorientation", handleDeviceOrientation, true);
    tiltState.enabled = true;
    document.body.classList.add("tilt-enabled");
    joystickArea?.classList.add("hidden");
    tiltButton?.classList.add("hidden");
    showNarrative("Tilt controls ready. Steer by leaning your phone.");
  };

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then((result) => {
        if (result === "granted") {
          beginTilt();
        } else {
          showJoystickFallback("Motion access denied. Using joystick.");
        }
      })
      .catch(() => showJoystickFallback("Motion access denied. Using joystick."));
  } else {
    beginTilt();
  }
}

function handleDeviceOrientation(event) {
  const gamma = event.gamma ?? 0; // left/right tilt
  const beta = event.beta ?? 0; // forward/back tilt
  const clamp = (val, max) => Math.max(-1, Math.min(1, val / max));
  tiltState.targetX = clamp(gamma, 25);
  tiltState.targetY = clamp(beta, 30);
}

function updateTiltInput(dt) {
  if (!tiltState.enabled) return;
  const smoothing = Math.min(1, dt * 8);
  tiltState.x += (tiltState.targetX - tiltState.x) * smoothing;
  tiltState.y += (tiltState.targetY - tiltState.y) * smoothing;
}

function showJoystickFallback(message) {
  tiltState.enabled = false;
  tiltState.x = tiltState.y = 0;
  tiltState.targetX = tiltState.targetY = 0;
  window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
  document.body.classList.remove("tilt-enabled");
  tiltButton?.classList.remove("hidden");
  joystickArea?.classList.remove("hidden");
  if (message) {
    showNarrative(message);
  }
}

// Settings Toggles
document.getElementById("optColorblind").addEventListener("change", (e) => settings.colorblind = e.target.checked);
document.getElementById("optShake").addEventListener("change", (e) => settings.shake = e.target.checked);
document.getElementById("optParticles").addEventListener("change", (e) => settings.particles = e.target.checked);
document.getElementById("optBloom").addEventListener("change", (e) => settings.bloom = e.target.checked);
document.getElementById("optCRT").addEventListener("change", (e) => settings.crt = e.target.checked);

// Modifiers
document.getElementById("modHardcore").addEventListener("change", (e) => modifiers.hardcore = e.target.checked);
document.getElementById("modPacifist").addEventListener("change", (e) => modifiers.pacifist = e.target.checked);
document.getElementById("modTiny").addEventListener("change", (e) => modifiers.tiny = e.target.checked);
document.getElementById("modDoubleSpeed").addEventListener("change", (e) => modifiers.doubleSpeed = e.target.checked);

function updateSettings() {
  document.body.classList.toggle("colorblind", settings.colorblind);
  document.body.classList.toggle("crt", settings.crt);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const prev = { w: field.width, h: field.height };
  field.width = rect.width;
  field.height = rect.height;
  field.dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * field.dpr;
  canvas.height = rect.height * field.dpr;
  ctx.setTransform(field.dpr, 0, 0, field.dpr, 0, 0);

  if (prev.w && prev.h) {
    const scaleX = field.width / prev.w;
    const scaleY = field.height / prev.h;
    player.x *= scaleX;
    player.y *= scaleY;
  } else {
    player.x = field.width / 2;
    player.y = field.height / 2;
  }
}

function resetGame() {
  state.score = 0;
  state.multiplier = 1;
  state.lives = modifiers.hardcore ? 1 : 3;
  state.time = 0;
  state.streak = 0;
  state.shieldTime = 0;
  state.dashTime = 0;
  state.dashCooldown = 0;
  state.quest = null;
  
  // Reset Stats
  state.stats = { accuracy: 0, nearMisses: 0, damageBlocked: 0, orbsCollected: 0 };

  orbs = [];
  hazards = [];
  powerups = [];
  particles = [];
  textPopups = [];
  
  orbTimer = 0;
  hazardTimer = 0;
  powerTimer = 0;
  questTimer = 0;
  slowMoFactor = 1.0;
  
  // Reset Glitch
  glitchTimer = 0;
  nextGlitchTime = 15;
  activeGlitch = null;
  
  player.x = field.width / 2;
  player.y = field.height / 2;
  player.trail = [];
  player.r = modifiers.tiny ? 8 : 15;
  
  hideOverlay();
  runStats.classList.add("hidden");
  updateLabels();
  generateQuest();
  showNarrative("System Online. Good luck, Pilot.");
}

function togglePlay() {
  if (state.mode === "running") {
    state.mode = "paused";
    showOverlay("Paused");
  } else if (state.mode === "paused") {
    state.mode = "running";
    hideOverlay();
  } else {
    resetGame();
    state.mode = "running";
    hideOverlay();
  }
  setButtonLabel();
}

function showOverlay(text) {
  statusText.textContent = text;
  overlay.classList.add("visible");
  statusText.style.display = "block";
}

function hideOverlay() {
  overlay.classList.remove("visible");
  statusText.style.display = "none";
}

function setButtonLabel() {
  toggleButton.textContent = state.mode === "running" ? "Pause" : "Play";
}

// --- Spawning Logic ---

function spawnOrb(type = "normal") {
  const padding = 26;
  orbs.push({
    x: padding + Math.random() * (field.width - padding * 2),
    y: padding + Math.random() * (field.height - padding * 2),
    r: 10 + Math.random() * 8,
    pulse: Math.random() * Math.PI * 2,
    type: type, // normal, time-freeze, magnet
    life: 10 // Despawn after 10s
  });
}

function spawnHazard() {
  if (modifiers.pacifist) return;
  
  const baseSpeed = modifiers.doubleSpeed ? 240 : 120;
  const speed = baseSpeed + Math.random() * 180 + state.time * 3;
  const spawnEdge = Math.random();
  const fromSide = spawnEdge > 0.7;
  
  // 20% chance for Elite Hazard (Homing or ZigZag)
  const isElite = Math.random() < 0.2;
  const type = isElite ? (Math.random() > 0.5 ? "homing" : "zigzag") : "normal";

  hazards.push({
    x: fromSide ? (spawnEdge > 0.85 ? -20 : field.width + 20) : Math.random() * field.width,
    y: fromSide ? Math.random() * field.height : -20,
    size: 12 + Math.random() * 10,
    speed,
    spin: Math.random() * Math.PI * 2,
    drift: (Math.random() - 0.5) * 90,
    type: type,
    telegraph: 1.0 // 1s warning before becoming active
  });
}

function spawnShield() {
  const padding = 30;
  powerups.push({
    x: padding + Math.random() * (field.width - padding * 2),
    y: padding + Math.random() * (field.height - padding * 2),
    r: 13,
    pulse: Math.random() * Math.PI * 2,
    type: "shield",
  });
}

function spawnPowerup() {
  const types = ["size-down", "magnet", "freeze"];
  const type = types[Math.floor(Math.random() * types.length)];
  const padding = 30;
  powerups.push({
    x: padding + Math.random() * (field.width - padding * 2),
    y: padding + Math.random() * (field.height - padding * 2),
    r: 13,
    pulse: Math.random() * Math.PI * 2,
    type: type,
  });
}

// --- Game Logic ---

function triggerDash() {
  if (state.mode !== "running") return;
  if (state.dashCooldown > 0.05) return;
  state.dashTime = DASH_DURATION;
  state.dashCooldown = DASH_COOLDOWN;
  
  // Ghost Effect
  player.ghost.push({ x: player.x, y: player.y, alpha: 1.0 });
  
  flashOverlay("Dash!");
  spawnParticles(player.x, player.y, 10, "#fff");
}

function generateQuest() {
  const quests = [
    { type: "collect", target: 5, text: "Collect 5 Orbs", reward: 500 },
    { type: "survive", target: 10, text: "Survive 10s", reward: 300 },
    { type: "streak", target: 10, text: "Reach 10 Streak", reward: 1000 }
  ];
  const q = quests[Math.floor(Math.random() * quests.length)];
  state.quest = { ...q, current: 0, time: 0 };
  questHud.classList.remove("hidden");
  questText.textContent = q.text;
  questBar.style.width = "0%";
}

function updateQuest(dt) {
  if (!state.quest) return;
  
  if (state.quest.type === "survive") {
    state.quest.current += dt;
    questBar.style.width = `${(state.quest.current / state.quest.target) * 100}%`;
    if (state.quest.current >= state.quest.target) completeQuest();
  }
}

function completeQuest() {
  state.score += state.quest.reward;
  spawnTextPopup(player.x, player.y - 20, `Quest Complete! +${state.quest.reward}`);
  state.quest = null;
  questHud.classList.add("hidden");
  setTimeout(generateQuest, 5000); // New quest in 5s
}

function showNarrative(text) {
  logContent.textContent = text;
  narrativeLog.classList.remove("hidden");
  // Reset animation
  narrativeLog.style.animation = 'none';
  narrativeLog.offsetHeight; /* trigger reflow */
  narrativeLog.style.animation = null; 
  
  setTimeout(() => narrativeLog.classList.add("hidden"), 4000);
}

function updateGame(dt) {
  // Slow Mo Logic
  if (slowMoTimer > 0) {
    slowMoTimer -= dt;
    slowMoFactor = 0.3;
  } else {
    slowMoFactor = Math.min(1, slowMoFactor + dt * 2); // Recover speed
  }
  
  const gameDt = dt * slowMoFactor;
  updateTiltInput(gameDt);
  
  state.time += gameDt;
  state.score += gameDt * 12 * state.multiplier;
  state.shieldTime = Math.max(0, state.shieldTime - gameDt);
  state.dashCooldown = Math.max(0, state.dashCooldown - gameDt);
  state.dashTime = Math.max(0, state.dashTime - gameDt);

  // --- Glitch System ---
  glitchTimer += gameDt;
  if (activeGlitch) {
    activeGlitch.time -= gameDt;
    if (activeGlitch.time <= 0) {
      activeGlitch = null;
      flashOverlay("System Stabilized");
      camera.zoom = 1;
    }
  } else if (glitchTimer > nextGlitchTime) {
    triggerGlitch();
    glitchTimer = 0;
    nextGlitchTime = 20 + Math.random() * 10;
  }

  // Update Palette based on Multiplier
  updatePalette(gameDt);

  // Player Movement
  const speedBoost = state.dashTime > 0 ? DASH_MULTIPLIER : 1;
  const step = player.speed * gameDt * speedBoost;
  
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  let analogScale = Math.hypot(dx, dy) > 0 ? 1 : 0;
  
  // Mouse/Touch Movement (Virtual Joystick-ish)
  if (input.mouseDown && !tiltState.enabled) {
    const angle = Math.atan2(input.mouseY - player.y, input.mouseX - player.x);
    const dist = Math.hypot(input.mouseX - player.x, input.mouseY - player.y);
    if (dist > 10) {
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      analogScale = 1;
    }
  }

  if (tiltState.enabled) {
    const analogLen = Math.min(1, Math.hypot(tiltState.x, tiltState.y));
    if (analogLen > 0.12) {
      dx = tiltState.x / (analogLen || 1);
      dy = tiltState.y / (analogLen || 1);
      analogScale = analogLen;
    } else {
      dx = 0;
      dy = 0;
      analogScale = 0;
    }
  }

  // Apply Glitch Effects to Input
  if (activeGlitch) {
    if (activeGlitch.type === "invert") {
      dx = -dx;
      dy = -dy;
    } else if (activeGlitch.type === "wind") {
      player.x += 150 * gameDt; // Wind blows right
    }
  }

  const norm = Math.hypot(dx, dy) || 1;
  if (analogScale > 0) {
    player.x += (dx / norm) * step * analogScale;
    player.y += (dy / norm) * step * analogScale;
  }

  player.x = Math.max(player.r, Math.min(field.width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(field.height - player.r, player.y));
  
  // Trail
  const trailLife = state.dashTime > 0 ? 0.18 : 0.42;
  player.trail.push({ x: player.x, y: player.y, life: trailLife });
  if (player.trail.length > 100) player.trail.shift();
  
  // Ghost Trail Update
  player.ghost.forEach(g => g.alpha -= dt * 2);
  player.ghost = player.ghost.filter(g => g.alpha > 0);

  // Spawning
  orbTimer += gameDt;
  if (orbTimer > 0.9) {
    orbTimer = 0;
    if (orbs.length < 6) spawnOrb();
  }

  hazardTimer += gameDt;
  // Glitch: Hyper Speed spawns faster
  let spawnRateMod = activeGlitch && activeGlitch.type === "hyper" ? 0.5 : 1.0;
  const hazardInterval = Math.max(0.35, 1.05 - state.time * 0.015) * spawnRateMod;
  
  if (hazardTimer > hazardInterval) {
    hazardTimer = 0;
    spawnHazard();
  }

  powerTimer += gameDt;
  if (powerTimer > nextShieldSpawn) {
    powerTimer = 0;
    nextShieldSpawn = 15 + Math.random() * 15;
    if (Math.random() > 0.5) spawnShield();
    else spawnPowerup();
  }

  // Entity Updates
  hazards.forEach((h) => {
    if (h.telegraph > 0) {
      h.telegraph -= gameDt;
      return;
    }
    
    let moveSpeed = h.speed;
    if (activeGlitch && activeGlitch.type === "hyper") moveSpeed *= 1.5;
    if (activeGlitch && activeGlitch.type === "slow") moveSpeed *= 0.5;

    // Homing Logic
    if (h.type === "homing") {
      const angle = Math.atan2(player.y - h.y, player.x - h.x);
      h.x += Math.cos(angle) * moveSpeed * 0.6 * gameDt;
      h.y += Math.sin(angle) * moveSpeed * 0.6 * gameDt;
    } else if (h.type === "zigzag") {
      h.y += moveSpeed * gameDt;
      h.x += Math.sin(state.time * 5) * 100 * gameDt;
    } else {
      h.y += moveSpeed * gameDt;
      h.x += h.drift * gameDt;
    }
    h.spin += gameDt * 3;
  });
  
  hazards = hazards.filter((h) => h.y < field.height + 40 && h.y > -40 && h.x > -60 && h.x < field.width + 60);

  orbs.forEach((o) => {
    o.pulse += gameDt * 3;
    o.life -= gameDt;
    
    // Magnet Effect
    if (state.magnetTime > 0) {
      const angle = Math.atan2(player.y - o.y, player.x - o.x);
      o.x += Math.cos(angle) * 300 * gameDt;
      o.y += Math.sin(angle) * 300 * gameDt;
    }
  });
  orbs = orbs.filter(o => o.life > 0);
  
  powerups.forEach((p) => {
    p.pulse += gameDt * 2;
  });

  // Particles
  particles.forEach(p => {
    p.x += p.vx * gameDt;
    p.y += p.vy * gameDt;
    p.life -= gameDt;
  });
  particles = particles.filter(p => p.life > 0);
  
  // Text Popups
  textPopups.forEach(t => {
    t.y -= 20 * gameDt;
    t.life -= gameDt;
  });
  textPopups = textPopups.filter(t => t.life > 0);

  // Camera Shake Decay
  if (camera.shake > 0) camera.shake = Math.max(0, camera.shake - dt * 5);

  checkOrbCollisions();
  checkPowerupCollisions();
  checkHazardCollisions();
  updateQuest(gameDt);
  updateLabels();
}

function triggerGlitch() {
  const types = ["invert", "wind", "zoom", "hyper", "disco"];
  const type = types[Math.floor(Math.random() * types.length)];
  activeGlitch = { type, time: 8 }; // Lasts 8 seconds
  
  let msg = "GLITCH: ";
  if (type === "invert") msg += "CONTROLS FLIPPED";
  if (type === "wind") msg += "HIGH WINDS";
  if (type === "zoom") { msg += "OPTICAL ZOOM"; camera.zoom = 1.5; }
  if (type === "hyper") msg += "HYPER SPEED";
  if (type === "disco") msg += "PARTY MODE";
  
  flashOverlay(msg);
  spawnTextPopup(field.width/2, field.height/2, "⚠ ANOMALY DETECTED ⚠");
}

function updatePalette(dt) {
  // Base colors
  let target = {
    bg1: "rgba(138,245,255,0.08)",
    bg2: "rgba(255,109,214,0.08)",
    player: "#8af5ff",
    hazard: "#ff6dd6",
    orb: "#ffd166"
  };

  // Multiplier Tiers
  if (state.multiplier > 3) {
    target.player = "#ff0055"; // Red/Hot
    target.bg1 = "rgba(255,0,85,0.1)";
    target.orb = "#00ffcc";
  } else if (state.multiplier > 2) {
    target.player = "#cc00ff"; // Purple
    target.bg1 = "rgba(204,0,255,0.1)";
  }

  // Disco Glitch Override
  if (activeGlitch && activeGlitch.type === "disco") {
    const hue = (state.time * 200) % 360;
    target.player = `hsl(${hue}, 100%, 60%)`;
    target.hazard = `hsl(${(hue + 180) % 360}, 100%, 60%)`;
    target.bg1 = `hsla(${hue}, 100%, 50%, 0.1)`;
  }

  // Smooth transition (lerp-ish)
  currentPalette = target; // Direct assignment for now, lerp is expensive to write out fully
}

function checkOrbCollisions() {
  orbs = orbs.filter((o) => {
    const dist = Math.hypot(o.x - player.x, o.y - player.y);
    if (dist <= o.r + player.r) {
      state.multiplier = Math.min(4, state.multiplier + 0.2);
      state.score += 60 * state.multiplier;
      state.streak += 1;
      state.stats.orbsCollected++;
      
      spawnParticles(o.x, o.y, 5, "#8af5ff");
      
      if (state.quest && state.quest.type === "collect") {
        state.quest.current++;
        questBar.style.width = `${(state.quest.current / state.quest.target) * 100}%`;
        if (state.quest.current >= state.quest.target) completeQuest();
      }
      
      if (state.quest && state.quest.type === "streak" && state.streak >= state.quest.target) {
        completeQuest();
      }

      if (state.streak % 10 === 0 && state.lives < MAX_LIVES) {
        state.lives += 1;
        flashOverlay("+1 life streak");
      }
      return false;
    }
    return true;
  });
}

function checkPowerupCollisions() {
  powerups = powerups.filter((p) => {
    const dist = Math.hypot(p.x - player.x, p.y - player.y);
    if (dist <= p.r + player.r + 4) {
      if (p.type === "shield") {
        state.shieldTime = SHIELD_DURATION;
        flashOverlay("Shielded");
      } else if (p.type === "size-down") {
        player.r = 8;
        setTimeout(() => player.r = modifiers.tiny ? 8 : 15, 10000);
        flashOverlay("Tiny Mode");
      } else if (p.type === "magnet") {
        state.magnetTime = 8; // Custom prop
        flashOverlay("Magnet Active");
      } else if (p.type === "freeze") {
        slowMoTimer = 3;
        flashOverlay("Time Freeze");
      }
      return false;
    }
    return true;
  });
  
  if (state.magnetTime > 0) state.magnetTime -= 0.016; // Hacky decrement
}

function checkHazardCollisions() {
  hazards = hazards.filter((h) => {
    if (h.telegraph > 0) return true; // Don't hit if telegraphing
    
    const dist = Math.hypot(h.x - player.x, h.y - player.y);
    
    // Near Miss
    if (dist < h.size + player.r + 20 && dist > h.size + player.r) {
      state.stats.nearMisses++;
    }

    if (dist < h.size + player.r - 4) {
      // Dash Ghost Damage (Feature 8)
      if (state.dashTime > 0) {
        spawnParticles(h.x, h.y, 8, "#ff6dd6");
        state.score += 100;
        spawnTextPopup(h.x, h.y, "Ghost Kill!");
        return false; // Destroy hazard
      }
      
      if (state.shieldTime > 0) {
        state.shieldTime = 0;
        state.streak = 0;
        state.multiplier = Math.max(1, state.multiplier - 0.4);
        state.stats.damageBlocked++;
        
        // Reflect (Feature 7)
        spawnParticles(h.x, h.y, 10, "#fff");
        flashOverlay("Shield Reflect!");
        return false; // Destroy hazard
      } else {
        // Last Chance Slow Mo (Feature 48)
        if (state.lives === 1 && slowMoFactor > 0.5) {
           slowMoTimer = 1.5;
           flashOverlay("LAST CHANCE!");
        }
        
        state.lives -= 1;
        
        // Combo Breaker Slow Mo (Feature 1)
        if (state.streak > 5) {
          slowMoTimer = 1.0;
          flashOverlay("Combo Broken...");
        }
        
        state.streak = 0;
        state.multiplier = 1;
        
        if (settings.shake) camera.shake = 10;
        
        if (state.lives <= 0) {
          endGame();
        } else {
           flashOverlay("Ouch!");
        }
      }
      return false;
    }
    return true;
  });
}

function spawnParticles(x, y, count, color) {
  if (!settings.particles) return;
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      life: 0.5 + Math.random() * 0.5,
      color
    });
  }
}

function spawnTextPopup(x, y, text) {
  textPopups.push({ x, y, text, life: 1.5 });
}

function endGame() {
  state.mode = "over";
  state.time = Math.max(state.time, 0);
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem("neonDriftBest", String(Math.floor(state.best)));
  
  // Show Stats Card
  document.getElementById("endScore").textContent = Math.floor(state.score);
  document.getElementById("endBest").textContent = Math.floor(state.best);
  document.getElementById("endAccuracy").textContent = state.stats.orbsCollected; // Simplified
  document.getElementById("endNearMiss").textContent = state.stats.nearMisses;
  document.getElementById("endBlocked").textContent = state.stats.damageBlocked;
  
  runStats.classList.remove("hidden");
  showOverlay(""); // Clear text, keep overlay
}

// --- Rendering ---

function draw() {
  // Clear
  ctx.setTransform(field.dpr, 0, 0, field.dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Dynamic Background
  const gradient = ctx.createLinearGradient(0, 0, field.width, field.height);
  gradient.addColorStop(0, currentPalette.bg1);
  gradient.addColorStop(1, currentPalette.bg2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, field.width, field.height);
  
  // Camera Shake
  let shakeX = 0, shakeY = 0;
  if (camera.shake > 0) {
    shakeX = (Math.random() - 0.5) * camera.shake;
    shakeY = (Math.random() - 0.5) * camera.shake;
  }
  ctx.translate(shakeX, shakeY);

  // Draw Player Trail
  if (player.trail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(player.trail[0].x, player.trail[0].y);
    for (let i = 1; i < player.trail.length; i++) {
      ctx.lineTo(player.trail[i].x, player.trail[i].y);
    }
    ctx.strokeStyle = currentPalette.bg1.replace("0.08", "0.3");
    ctx.lineWidth = player.r * 0.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  
  // Draw Ghost
  player.ghost.forEach(g => {
    ctx.beginPath();
    ctx.arc(g.x, g.y, player.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${g.alpha * 0.5})`;
    ctx.fill();
  });

  // Draw Player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = state.shieldTime > 0 ? "#fff" : currentPalette.player;
  ctx.shadowBlur = settings.bloom ? 20 : 0;
  ctx.shadowColor = currentPalette.player;
  ctx.fill();
  ctx.shadowBlur = 0;
  
  if (state.shieldTime > 0) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(state.time * 10) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw Orbs
  orbs.forEach((o) => {
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r + Math.sin(o.pulse) * 2, 0, Math.PI * 2);
    ctx.fillStyle = o.type === "magnet" ? "#ff00ff" : (o.type === "freeze" ? "#00ffff" : currentPalette.orb);
    ctx.shadowBlur = settings.bloom ? 15 : 0;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // Draw Hazards
  hazards.forEach((h) => {
    if (h.telegraph > 0) {
      // Telegraph
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.size, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 109, 214, ${1 - h.telegraph})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }
    
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.spin);
    
    if (h.type === "homing") {
      // Triangle for homing
      ctx.beginPath();
      ctx.moveTo(h.size, 0);
      ctx.lineTo(-h.size/2, h.size/2);
      ctx.lineTo(-h.size/2, -h.size/2);
      ctx.closePath();
    } else {
      // Square for normal
      ctx.fillStyle = currentPalette.hazard;
      ctx.fillRect(-h.size, -h.size, h.size * 2, h.size * 2);
    }
    
    ctx.fillStyle = currentPalette.hazard;
    ctx.shadowBlur = settings.bloom ? 15 : 0;
    ctx.shadowColor = currentPalette.hazard;
    ctx.fill();
    ctx.restore();
  });

  // Draw Powerups
  powerups.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fill();
    
    // Icon
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let icon = "S";
    if (p.type === "magnet") icon = "M";
    if (p.type === "freeze") icon = "F";
    if (p.type === "size-down") icon = "T";
    ctx.fillText(icon, p.x, p.y);
  });
  
  // Draw Particles
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  
  // Draw Text Popups
  textPopups.forEach(t => {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px 'Space Grotesk'";
    ctx.textAlign = "center";
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1;
  });
  
  // Glitch Overlay Effect
  if (activeGlitch && activeGlitch.type === "disco") {
    ctx.fillStyle = `rgba(${Math.random()*255}, ${Math.random()*255}, ${Math.random()*255}, 0.1)`;
    ctx.fillRect(-shakeX, -shakeY, field.width, field.height); // Counter shake for full screen
  }
}

function updateLabels() {
  scoreLabel.textContent = Math.floor(state.score);
  multiplierLabel.textContent = "x" + state.multiplier.toFixed(1);
  timeLabel.textContent = state.time.toFixed(1) + "s";
  livesLabel.textContent = state.lives;
  streakLabel.textContent = state.streak;
  shieldLabel.textContent = state.shieldTime > 0 ? state.shieldTime.toFixed(1) + "s" : "--";
  dashLabel.textContent = state.dashCooldown > 0 ? state.dashCooldown.toFixed(1) + "s" : "Ready";
  bestLabel.textContent = state.best;
}

function flashOverlay(text) {
  statusText.textContent = text;
  statusText.style.display = "block";
  statusText.style.animation = "none";
  statusText.offsetHeight; /* trigger reflow */
  statusText.style.animation = "pop 0.3s ease-out";
  setTimeout(() => {
    if (state.mode === "running") statusText.style.display = "none";
  }, 800);
}

// Loop
let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  if (state.mode === "running") {
    updateGame(dt);
  }
  draw();
  requestAnimationFrame(loop);
}

// Start
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
requestAnimationFrame(loop);
