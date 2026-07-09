// gl.js — WebGL2 helpers: shader programs, FBOs, ping-pong buffers, fullscreen quad

/**
 * Compiles and links a WebGL2 program from vertex/fragment shader source strings.
 * @param {WebGL2RenderingContext} gl
 * @param {string} vsSrc
 * @param {string} fsSrc
 * @returns {WebGLProgram}
 */
export function createProgram(gl, vsSrc, fsSrc) {
  const compile = (type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile error: ' + info);
    }
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Program link error: ' + info);
  }

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  return program;
}

/**
 * Creates a framebuffer object with an attached RGBA8 texture of size w x h.
 * @param {WebGL2RenderingContext} gl
 * @param {number} w
 * @param {number} h
 * @returns {{fbo: WebGLFramebuffer, tex: WebGLTexture, w: number, h: number}}
 */
export function createFBO(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return { fbo, tex, w, h };
}

/**
 * Double-buffered FBO pair for feedback-style rendering.
 */
export class PingPong {
  constructor(gl, w, h) {
    this.gl = gl;
    this.read = createFBO(gl, w, h);
    this.write = createFBO(gl, w, h);
  }

  swap() {
    const tmp = this.read;
    this.read = this.write;
    this.write = tmp;
  }
}

let quadVAO = null;

/**
 * Draws a fullscreen triangle (covers viewport, no vertex buffer needed beyond a VAO).
 * @param {WebGL2RenderingContext} gl
 */
export function drawQuad(gl) {
  if (!quadVAO) {
    quadVAO = gl.createVertexArray();
  }
  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}
