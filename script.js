const scene = document.getElementById("scene");
const sceneDepth = document.querySelector(".scene-depth");
const gyroButton = document.getElementById("gyroButton");
const statusText = document.getElementById("statusText");
const fullscreenOverlay = document.getElementById("fullscreenOverlay");
const fullscreenButton = document.getElementById("fullscreenButton");
const gyroPad = document.getElementById("gyroPad");
const gyroBall = document.getElementById("gyroBall");

const drops = [];
const pointer = {
  x: window.innerWidth * 0.5,
  y: window.innerHeight * 0.5,
  radius: 140,
  active: false,
  strength: 1,
};

const tilt = {
  currentX: 0,
  currentY: 0,
  targetX: 0,
  targetY: 0,
};

const gyroBallState = {
  currentX: 0,
  currentY: 0,
  targetX: 0,
  targetY: 0,
};

let sceneWidth = 0;
let sceneHeight = 0;
let lastTime = performance.now();
let gyroEnabled = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeScene() {
  const rect = scene.getBoundingClientRect();
  sceneWidth = rect.width;
  sceneHeight = rect.height;
  pointer.radius = Math.max(100, Math.min(180, sceneWidth * 0.18));
  updateGyroBall();
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function isPhoneLikeView() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function canUseFullscreen() {
  return Boolean(
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen ||
    document.documentElement.msRequestFullscreen
  );
}

async function requestFullscreenMode() {
  const element = document.documentElement;

  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
      return true;
    }

    if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
      return true;
    }

    if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
      return true;
    }
  } catch (error) {
    return false;
  }

  return false;
}

function syncFullscreenUi() {
  const fullscreenActive = Boolean(getFullscreenElement());
  document.body.classList.toggle("fullscreen-active", fullscreenActive);

  if (!isPhoneLikeView()) {
    if (fullscreenOverlay) {
      fullscreenOverlay.setAttribute("aria-hidden", "true");
    }
    return;
  }

  if (!canUseFullscreen()) {
    document.body.classList.add("fullscreen-unavailable");
    if (fullscreenButton) {
      fullscreenButton.textContent = "Fullscreen Not Supported";
      fullscreenButton.disabled = true;
      fullscreenButton.style.opacity = "0.65";
      fullscreenButton.style.cursor = "default";
    }
    if (fullscreenOverlay) {
      fullscreenOverlay.setAttribute("aria-hidden", "false");
    }
    return;
  }

  document.body.classList.remove("fullscreen-unavailable");
  if (fullscreenButton) {
    fullscreenButton.textContent = fullscreenActive ? "Fullscreen Active" : "Enter Fullscreen";
    fullscreenButton.disabled = fullscreenActive;
    fullscreenButton.style.opacity = fullscreenActive ? "0.65" : "1";
    fullscreenButton.style.cursor = fullscreenActive ? "default" : "pointer";
  }

  if (fullscreenOverlay) {
    fullscreenOverlay.setAttribute("aria-hidden", fullscreenActive ? "true" : "false");
  }
}

async function tryAutoFullscreen() {
  if (!isPhoneLikeView() || !canUseFullscreen() || getFullscreenElement()) {
    syncFullscreenUi();
    return;
  }

  const entered = await requestFullscreenMode();

  if (!entered && isPhoneLikeView()) {
    statusText.textContent = "Your browser blocked automatic fullscreen on open.";
  }

  syncFullscreenUi();
}

function createDrop(index) {
  const element = document.createElement("div");
  element.className = "love-drop";
  element.innerHTML = 'I LOVE YOU <span class="heart">&#10084;&#65039;</span>';
  sceneDepth.appendChild(element);

  const depth = randomBetween(0.35, 1.05);
  const size = randomBetween(14, 34) * depth;

  const drop = {
    element,
    x: randomBetween(-60, sceneWidth + 60),
    y: randomBetween(-sceneHeight, sceneHeight),
    baseX: randomBetween(-60, sceneWidth + 60),
    speed: randomBetween(42, 110) * (0.65 + depth * 0.8),
    drift: randomBetween(10, 32) * (Math.random() > 0.5 ? 1 : -1),
    swing: randomBetween(0.8, 2.4),
    swingOffset: randomBetween(0, Math.PI * 2),
    depth,
    size,
    rotation: randomBetween(-22, 22),
    repelX: 0,
    repelY: 0,
    opacity: randomBetween(0.42, 0.94),
    delay: index * 0.04,
  };

  element.style.fontSize = `${size}px`;
  element.style.opacity = drop.opacity.toFixed(3);
  return drop;
}

function populateDrops() {
  const count = Math.max(34, Math.min(70, Math.round((sceneWidth * sceneHeight) / 28000)));
  for (let i = 0; i < count; i += 1) {
    drops.push(createDrop(i));
  }
}

function resetDrop(drop, fromTop = true) {
  drop.baseX = randomBetween(-80, sceneWidth + 80);
  drop.x = drop.baseX;
  drop.y = fromTop ? randomBetween(-sceneHeight * 0.7, -80) : randomBetween(-30, sceneHeight);
  drop.speed = randomBetween(42, 110) * (0.65 + drop.depth * 0.8);
  drop.drift = randomBetween(10, 32) * (Math.random() > 0.5 ? 1 : -1);
  drop.swing = randomBetween(0.8, 2.4);
  drop.swingOffset = randomBetween(0, Math.PI * 2);
  drop.rotation = randomBetween(-22, 22);
  drop.opacity = randomBetween(0.42, 0.94);
  drop.element.style.opacity = drop.opacity.toFixed(3);
}

function updatePointer(clientX, clientY, active = true) {
  const rect = scene.getBoundingClientRect();
  pointer.x = clientX - rect.left;
  pointer.y = clientY - rect.top;
  pointer.active = active;
}

function clearPointer() {
  pointer.active = false;
}

function updateGyroBall() {
  if (!gyroPad || !gyroBall) {
    return;
  }

  const maxX = Math.max(0, (gyroPad.clientWidth - gyroBall.clientWidth) * 0.5);
  const maxY = Math.max(0, (gyroPad.clientHeight - gyroBall.clientHeight) * 0.5);
  const x = gyroBallState.currentX * maxX;
  const y = gyroBallState.currentY * maxY;

  gyroBall.style.transform = `translate(${x}px, ${y}px)`;
}

function applyGyroTilt(gamma, beta) {
  tilt.targetX = gamma / 3;
  tilt.targetY = beta / 5;
  gyroBallState.targetX = clamp(gamma / 20, -1, 1);
  gyroBallState.targetY = clamp(beta / 20, -1, 1);
}

function handleDeviceOrientation(event) {
  const gamma = clamp(event.gamma ?? 0, -30, 30);
  const beta = clamp(event.beta ?? 0, -30, 30);
  applyGyroTilt(gamma, beta);
}

function animate(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  tilt.currentX += (tilt.targetX - tilt.currentX) * 0.055;
  tilt.currentY += (tilt.targetY - tilt.currentY) * 0.055;
  gyroBallState.currentX += (gyroBallState.targetX - gyroBallState.currentX) * 0.11;
  gyroBallState.currentY += (gyroBallState.targetY - gyroBallState.currentY) * 0.11;

  sceneDepth.style.transform = `
    rotateX(${tilt.currentY * -0.65}deg)
    rotateY(${tilt.currentX * 0.75}deg)
    translateZ(0)
  `;
  updateGyroBall();

  for (const drop of drops) {
    drop.y += drop.speed * delta;

    const timeWave = now * 0.0011 * drop.swing + drop.swingOffset + drop.delay;
    const waveX = Math.sin(timeWave) * 18 * drop.depth;
    const waveY = Math.cos(timeWave * 1.35) * 9 * drop.depth;

    let repelTargetX = 0;
    let repelTargetY = 0;

    if (pointer.active) {
      const dx = drop.x - pointer.x;
      const dy = drop.y - pointer.y;
      const distance = Math.hypot(dx, dy) || 1;

      if (distance < pointer.radius) {
        const force = (1 - distance / pointer.radius) * 140 * drop.depth * pointer.strength;
        repelTargetX = (dx / distance) * force;
        repelTargetY = (dy / distance) * force;
      }
    }

    drop.repelX += (repelTargetX - drop.repelX) * 0.12;
    drop.repelY += (repelTargetY - drop.repelY) * 0.12;

    const driftX = drop.baseX + Math.sin(timeWave * 0.6) * drop.drift;
    drop.x += (driftX - drop.x) * 0.015;

    const x = drop.x + waveX + drop.repelX + tilt.currentX * 9 * drop.depth;
    const y = drop.y + waveY + drop.repelY + tilt.currentY * 6 * drop.depth;
    const z = (drop.depth - 0.5) * 240;
    const rotate = drop.rotation + Math.sin(timeWave) * 12;
    const scale = 0.72 + drop.depth * 0.58;

    drop.element.style.transform = `
      translate3d(${x}px, ${y}px, ${z}px)
      rotateZ(${rotate}deg)
      scale(${scale})
    `;

    if (drop.y - 80 > sceneHeight) {
      resetDrop(drop);
    }
  }

  requestAnimationFrame(animate);
}

function setMouseTilt(event) {
  const rect = scene.getBoundingClientRect();
  const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
  const relativeY = (event.clientY - rect.top) / rect.height - 0.5;
  tilt.targetX = clamp(relativeX * 18, -10, 10);
  tilt.targetY = clamp(relativeY * 18, -10, 10);
}

function bindPointerEvents() {
  scene.addEventListener("pointermove", (event) => {
    updatePointer(event.clientX, event.clientY, true);
    setMouseTilt(event);
  });

  scene.addEventListener("pointerdown", (event) => {
    updatePointer(event.clientX, event.clientY, true);
    pointer.strength = 1.25;
  });

  scene.addEventListener("pointerup", () => {
    pointer.strength = 1;
  });

  scene.addEventListener("pointerleave", () => {
    clearPointer();
    tilt.targetX *= 0.75;
    tilt.targetY *= 0.75;
  });

  scene.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    updatePointer(touch.clientX, touch.clientY, true);
    pointer.strength = 1.45;
  }, { passive: true });

  scene.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    updatePointer(touch.clientX, touch.clientY, true);
    const rect = scene.getBoundingClientRect();
    const relativeX = (touch.clientX - rect.left) / rect.width - 0.5;
    const relativeY = (touch.clientY - rect.top) / rect.height - 0.5;
    tilt.targetX = clamp(relativeX * 15, -9, 9);
    tilt.targetY = clamp(relativeY * 15, -9, 9);
  }, { passive: true });

  scene.addEventListener("touchend", () => {
    pointer.strength = 1;
    clearPointer();
  });
}

async function enableGyro() {
  try {
    if (!window.isSecureContext) {
      statusText.textContent = "Gyro needs HTTPS or localhost. http://192.168... is blocked by your browser.";
      return;
    }

    const permissionAPI = typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function";

    if (permissionAPI) {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response !== "granted") {
        statusText.textContent = "Gyro access was not granted.";
        return;
      }
    }

    if (!gyroEnabled) {
      window.addEventListener("deviceorientation", handleDeviceOrientation);
      gyroEnabled = true;
    }

    statusText.textContent = "Gyro 3D is active. Tilt your phone and watch the ball move.";
    gyroButton.textContent = "Gyro Enabled";
    gyroButton.disabled = true;
    gyroButton.style.opacity = "0.7";
    gyroButton.style.cursor = "default";
  } catch (error) {
    statusText.textContent = "Gyro is not available on this device/browser.";
  }
}

function init() {
  resizeScene();
  populateDrops();
  bindPointerEvents();
  syncFullscreenUi();
  updateGyroBall();
  requestAnimationFrame(animate);
  window.setTimeout(() => {
    tryAutoFullscreen();
  }, 120);
}

window.addEventListener("resize", () => {
  resizeScene();
  syncFullscreenUi();
  for (const drop of drops) {
    if (drop.x > sceneWidth + 120) {
      resetDrop(drop, false);
    }
  }
});

gyroButton.addEventListener("click", enableGyro);
fullscreenButton.addEventListener("click", async () => {
  await requestFullscreenMode();
  syncFullscreenUi();
});
window.addEventListener("load", () => {
  tryAutoFullscreen();
});
document.addEventListener("fullscreenchange", syncFullscreenUi);
document.addEventListener("webkitfullscreenchange", syncFullscreenUi);

init();
