// main.js — app entry point: owns state, drives the render loop, handles UI

import { initCamera } from './camera.js';
import { initSegmenter, updateMask } from './segment.js';
import { render } from './pipeline.js';

const landing = document.getElementById('landing');
const startBtn = document.getElementById('start-btn');
const canvas = document.getElementById('gl-canvas');
const performanceView = document.getElementById('performance-view');

const gl = canvas.getContext('webgl2');
if (!gl) {
  alert('WebGL2 is not supported on this device/browser.');
}

const state = {
  gl,
  canvas,
  time: 0,
  motion: 0,
  maskTex: null,
  videoTex: null,
  sceneIndex: 0,
  corners: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  recording: false,
};

let video = null;
let lastFrameTime = performance.now();
let fpsAccum = 0;
let fpsFrames = 0;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}

window.addEventListener('resize', resizeCanvas);

function ensureVideoTexture(gl) {
  if (!state.videoTex) {
    state.videoTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, state.videoTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
}

function loop(now) {
  requestAnimationFrame(loop);

  const dt = now - lastFrameTime;
  lastFrameTime = now;
  state.time = now / 1000;

  // fps tracking (logged to console every ~2s)
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 2000) {
    const fps = (fpsFrames / fpsAccum) * 1000;
    console.log(`[cosmic-pulses] fps: ${fps.toFixed(1)}`);
    fpsAccum = 0;
    fpsFrames = 0;
  }

  if (video && video.readyState >= 2) {
    ensureVideoTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, state.videoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, video);

    const { maskTex, motion } = updateMask(video, gl);
    state.maskTex = maskTex;
    state.motion = motion;
  }

  render(state);
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    console.warn('Wake lock request failed:', err);
  }
}

async function requestFullscreen() {
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    }
  } catch (err) {
    console.warn('Fullscreen request failed:', err);
  }
}

function handlePerformanceTap(e) {
  const x = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX);
  if (x == null) return;
  const third = window.innerWidth / 3;
  if (x > third * 2) {
    state.sceneIndex = (state.sceneIndex + 1) % 3;
  }
}

async function start() {
  startBtn.disabled = true;
  startBtn.textContent = 'Starting…';

  try {
    video = await initCamera();
    await initSegmenter();
  } catch (err) {
    console.error(err);
    alert('Could not start camera or segmentation: ' + err.message);
    startBtn.disabled = false;
    startBtn.textContent = 'Start';
    return;
  }

  await requestFullscreen();
  await requestWakeLock();

  landing.hidden = true;
  performanceView.hidden = false;
  resizeCanvas();

  requestAnimationFrame(loop);
}

startBtn.addEventListener('click', start);
performanceView.addEventListener('click', handlePerformanceTap);
performanceView.addEventListener('touchstart', handlePerformanceTap, { passive: true });

resizeCanvas();
