// pipeline.js — stub render pipeline. Task 2 replaces this with the real art pipeline.

import { createProgram, drawQuad } from './gl.js';

const vsSrc = `#version 300 es
void main() {
  vec2 pos[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0);
}
`;

const fsSrc = `#version 300 es
precision highp float;
uniform sampler2D uMask;
uniform vec2 uResolution;
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // mask texture is captured from a rear camera image which is not y-flipped
  // to match screen space; flip v to orient the silhouette upright.
  uv.y = 1.0 - uv.y;
  vec4 mask = texture(uMask, uv);
  fragColor = vec4(mask.rgb, 1.0);
}
`;

let program = null;
let uMaskLoc = null;
let uResolutionLoc = null;

/**
 * Stub render: draws the mask texture directly to the screen as a white
 * silhouette on black. Later tasks replace this with the full art pipeline.
 * @param {object} state
 */
export function render(state) {
  const { gl, canvas, maskTex } = state;

  if (!program) {
    program = createProgram(gl, vsSrc, fsSrc);
    uMaskLoc = gl.getUniformLocation(program, 'uMask');
    uResolutionLoc = gl.getUniformLocation(program, 'uResolution');
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (!maskTex) return;

  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, maskTex);
  gl.uniform1i(uMaskLoc, 0);
  gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);

  drawQuad(gl);
}
