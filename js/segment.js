// segment.js — MediaPipe person segmentation -> mask texture + motion energy

import { FilesetResolver, ImageSegmenter } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

let segmenter = null;
let maskTex = null;
let maskCanvas = null;
let maskCtx = null;

// motion tracking state
let prevMaskData = null;
let smoothedMotion = 0;

/**
 * Loads the MediaPipe ImageSegmenter (selfie segmenter model) via CDN.
 * @returns {Promise<void>}
 */
export async function initSegmenter() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );

  segmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
}

function ensureTexture(gl) {
  if (!maskTex) {
    maskTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
}

/**
 * Runs segmentation on the current video frame, uploads the mask as a texture,
 * and computes a smoothed 0..1 motion-energy value from frame-to-frame mask difference.
 * @param {HTMLVideoElement} video
 * @param {WebGL2RenderingContext} gl
 * @returns {{maskTex: WebGLTexture, motion: number}}
 */
export function updateMask(video, gl) {
  ensureTexture(gl);

  if (!segmenter || video.readyState < 2) {
    return { maskTex, motion: smoothedMotion };
  }

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    return { maskTex, motion: smoothedMotion };
  }

  const result = segmenter.segmentForVideo(video, performance.now());
  const categoryMask = result.categoryMask;
  if (!categoryMask) {
    return { maskTex, motion: smoothedMotion };
  }

  const maskW = categoryMask.width;
  const maskH = categoryMask.height;
  const maskData = categoryMask.getAsUint8Array();

  if (!maskCanvas) {
    maskCanvas = document.createElement('canvas');
    maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  }
  maskCanvas.width = maskW;
  maskCanvas.height = maskH;

  const rgba = new Uint8ClampedArray(maskW * maskH * 4);
  let diffSum = 0;

  for (let i = 0; i < maskW * maskH; i++) {
    // category 0 = background, >0 = person, for the selfie segmenter
    const isPerson = maskData[i] === 0 ? 0 : 255;
    rgba[i * 4 + 0] = isPerson;
    rgba[i * 4 + 1] = isPerson;
    rgba[i * 4 + 2] = isPerson;
    rgba[i * 4 + 3] = 255;

    if (prevMaskData) {
      diffSum += Math.abs(isPerson - prevMaskData[i]);
    }
  }

  const maxDiff = maskW * maskH * 255;
  const frameMotion = maxDiff > 0 ? diffSum / maxDiff : 0;

  // exponential smoothing
  const smoothing = 0.8;
  smoothedMotion = smoothedMotion * smoothing + frameMotion * (1 - smoothing);

  prevMaskData = isPersonArray(maskData, maskW, maskH);

  const imageData = new ImageData(rgba, maskW, maskH);
  maskCtx.putImageData(imageData, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, maskTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);

  categoryMask.close();

  return { maskTex, motion: Math.min(1, Math.max(0, smoothedMotion)) };
}

function isPersonArray(maskData, w, h) {
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    out[i] = maskData[i] === 0 ? 0 : 255;
  }
  return out;
}
