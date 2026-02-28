/**
 * Shifter WebGL Shader Engine
 * Per-pixel shader effects: displacement, ripple, chromatic aberration,
 * pixel stretching, liquify, wave distortion, RGB split, noise warp, etc.
 */

// ===== Easing Functions =====
const Easing = {
  linear: t => t,
  easeIn: t => t * t * t,
  easeOut: t => 1 - Math.pow(1 - t, 3),
  easeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeInOutBack: t => {
    const c1 = 1.70158, c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  easeInOutElastic: t => {
    const c = (2 * Math.PI) / 4.5;
    return t === 0 ? 0 : t === 1 ? 1
      : t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c)) / 2 + 1;
  },
  bounce: t => {
    const n = 7.5625, d = 2.75;
    t = 1 - t;
    let v;
    if (t < 1 / d) v = n * t * t;
    else if (t < 2 / d) v = n * (t -= 1.5 / d) * t + 0.75;
    else if (t < 2.5 / d) v = n * (t -= 2.25 / d) * t + 0.9375;
    else v = n * (t -= 2.625 / d) * t + 0.984375;
    return 1 - v;
  }
};

// ===== GLSL Shader Sources =====

const VERT_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_uv;
  void main() {
    v_uv = a_texCoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Master fragment shader with all effects as uniform-controlled passes
const FRAG_SHADER = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_image;
  uniform float u_time;        // 0-1 normalized progress
  uniform float u_timeSeconds;  // actual seconds elapsed
  uniform vec2 u_resolution;

  // === Displacement / Warp ===
  uniform float u_displaceX;     // horizontal pixel shift amount
  uniform float u_displaceY;     // vertical pixel shift amount
  uniform float u_noiseWarp;     // noise-driven UV warp strength
  uniform float u_noiseFreq;     // noise frequency
  uniform float u_noiseSpeed;    // noise animation speed

  // === Wave / Ripple ===
  uniform float u_waveAmpX;      // horizontal wave amplitude
  uniform float u_waveAmpY;      // vertical wave amplitude
  uniform float u_waveFreqX;     // horizontal wave frequency
  uniform float u_waveFreqY;     // vertical wave frequency
  uniform float u_rippleAmp;     // radial ripple amplitude
  uniform float u_rippleFreq;    // radial ripple frequency
  uniform float u_rippleCenter;  // ripple center offset

  // === Chromatic Aberration ===
  uniform float u_chromaR;       // red channel offset
  uniform float u_chromaG;       // green channel offset (usually 0)
  uniform float u_chromaB;       // blue channel offset

  // === Pixel Stretch ===
  uniform float u_stretchX;      // horizontal stretch zone
  uniform float u_stretchY;      // vertical stretch zone
  uniform float u_stretchPos;    // stretch position (0-1)

  // === Zoom / Scale ===
  uniform float u_zoom;          // zoom amount (0 = none)
  uniform vec2 u_zoomCenter;     // zoom focal point

  // === Rotation ===
  uniform float u_rotate;        // rotation in radians

  // === RGB Split / Shift ===
  uniform float u_rgbSplitAngle; // angle of RGB split
  uniform float u_rgbSplitAmt;   // amount of RGB channel separation

  // === Glitch ===
  uniform float u_glitchIntensity; // block glitch strength
  uniform float u_glitchSeed;      // randomization

  // === Pixelate ===
  uniform float u_pixelate;      // pixel block size (0 = off)

  // === Blur ===
  uniform float u_blur;          // directional blur amount
  uniform float u_blurAngle;     // blur direction angle

  // === Brightness / Color ===
  uniform float u_brightness;
  uniform float u_contrast;
  uniform float u_saturation;
  uniform float u_hueShift;

  // === Vignette ===
  uniform float u_vignette;

  // === Liquify ===
  uniform float u_liquifyAmt;
  uniform vec2 u_liquifyCenter;
  uniform float u_liquifyRadius;

  // === Smear ===
  uniform float u_smearAmt;
  uniform float u_smearAngle;

  // === Fracture ===
  uniform float u_fracture;      // tile/fracture amount

  // ---- Helpers ----

  // Hash for pseudo-random
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // 2D noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash2(i);
    float b = hash2(i + vec2(1.0, 0.0));
    float c = hash2(i + vec2(0.0, 1.0));
    float d = hash2(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Fractional Brownian Motion
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  // Rotation matrix
  vec2 rot(vec2 p, float angle) {
    float c = cos(angle), s = sin(angle);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }

  // HSV conversion
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = v_uv;
    vec2 pixel = 1.0 / u_resolution;

    // --- Fracture / Tile ---
    if (u_fracture > 0.0) {
      float tiles = floor(2.0 + u_fracture * 10.0);
      vec2 cell = floor(uv * tiles);
      vec2 cellUV = fract(uv * tiles);
      float rnd = hash2(cell + floor(u_timeSeconds * 2.0));
      cellUV += (rnd - 0.5) * u_fracture * 0.3;
      uv = (cell + cellUV) / tiles;
    }

    // --- Rotation ---
    if (abs(u_rotate) > 0.001) {
      uv -= 0.5;
      uv = rot(uv, u_rotate);
      uv += 0.5;
    }

    // --- Zoom ---
    if (abs(u_zoom) > 0.001) {
      vec2 center = u_zoomCenter;
      uv = center + (uv - center) / (1.0 + u_zoom);
    }

    // --- Noise Warp ---
    if (abs(u_noiseWarp) > 0.001) {
      float t = u_timeSeconds * u_noiseSpeed;
      float nx = fbm(uv * u_noiseFreq + vec2(t, 0.0)) - 0.5;
      float ny = fbm(uv * u_noiseFreq + vec2(0.0, t + 100.0)) - 0.5;
      uv += vec2(nx, ny) * u_noiseWarp;
    }

    // --- Displacement ---
    uv.x += u_displaceX * pixel.x;
    uv.y += u_displaceY * pixel.y;

    // --- Wave Distortion ---
    if (abs(u_waveAmpX) > 0.001 || abs(u_waveAmpY) > 0.001) {
      uv.x += sin(uv.y * u_waveFreqX + u_timeSeconds * 3.0) * u_waveAmpX * pixel.x;
      uv.y += sin(uv.x * u_waveFreqY + u_timeSeconds * 3.0) * u_waveAmpY * pixel.y;
    }

    // --- Ripple ---
    if (abs(u_rippleAmp) > 0.001) {
      vec2 center = vec2(0.5 + u_rippleCenter, 0.5);
      float dist = distance(uv, center);
      float wave = sin(dist * u_rippleFreq - u_timeSeconds * 5.0) * u_rippleAmp;
      vec2 dir = normalize(uv - center + 0.0001);
      uv += dir * wave * pixel * 10.0;
    }

    // --- Liquify ---
    if (abs(u_liquifyAmt) > 0.001) {
      vec2 center = u_liquifyCenter;
      vec2 diff = uv - center;
      float dist = length(diff);
      float radius = u_liquifyRadius;
      if (dist < radius) {
        float strength = (1.0 - dist / radius);
        strength = strength * strength;
        float angle = strength * u_liquifyAmt;
        diff = rot(diff, angle);
        uv = center + diff;
      }
    }

    // --- Pixel Stretch ---
    if (abs(u_stretchX) > 0.001) {
      float zone = u_stretchPos;
      float dist = abs(uv.x - zone);
      if (dist < abs(u_stretchX) * 0.1) {
        uv.x = zone;
      }
    }
    if (abs(u_stretchY) > 0.001) {
      float zone = u_stretchPos;
      float dist = abs(uv.y - zone);
      if (dist < abs(u_stretchY) * 0.1) {
        uv.y = zone;
      }
    }

    // --- Smear ---
    if (abs(u_smearAmt) > 0.001) {
      vec2 smearDir = vec2(cos(u_smearAngle), sin(u_smearAngle));
      float n = fbm(uv * 5.0 + u_timeSeconds) - 0.5;
      uv += smearDir * n * u_smearAmt * 0.1;
    }

    // --- Glitch ---
    if (u_glitchIntensity > 0.001) {
      float blockY = floor(uv.y * (10.0 + u_glitchIntensity * 20.0));
      float rnd = hash(blockY + floor(u_timeSeconds * 8.0) * 100.0 + u_glitchSeed);
      if (rnd > (1.0 - u_glitchIntensity * 0.3)) {
        float shift = (hash(blockY * 77.0 + u_glitchSeed) - 0.5) * u_glitchIntensity * 0.2;
        uv.x += shift;
      }
    }

    // --- Pixelate ---
    if (u_pixelate > 1.0) {
      vec2 blockSize = vec2(u_pixelate) * pixel;
      uv = floor(uv / blockSize) * blockSize + blockSize * 0.5;
    }

    // --- Blur (directional) ---
    vec4 color;
    if (u_blur > 0.5) {
      vec2 blurDir = vec2(cos(u_blurAngle), sin(u_blurAngle)) * pixel * u_blur;
      color = vec4(0.0);
      float total = 0.0;
      const int SAMPLES = 12;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float weight = 1.0 - abs(fi) / 7.0;
        color += texture2D(u_image, uv + blurDir * fi) * weight;
        total += weight;
      }
      color /= total;
    } else {
      color = texture2D(u_image, uv);
    }

    // --- Chromatic Aberration ---
    if (abs(u_chromaR) > 0.001 || abs(u_chromaB) > 0.001) {
      vec2 dir = (uv - 0.5);
      color.r = texture2D(u_image, uv + dir * u_chromaR * 0.02).r;
      color.g = texture2D(u_image, uv + dir * u_chromaG * 0.02).g;
      color.b = texture2D(u_image, uv + dir * u_chromaB * 0.02).b;
    }

    // --- RGB Split ---
    if (abs(u_rgbSplitAmt) > 0.001) {
      vec2 splitDir = vec2(cos(u_rgbSplitAngle), sin(u_rgbSplitAngle)) * u_rgbSplitAmt * pixel;
      color.r = texture2D(u_image, uv + splitDir).r;
      color.b = texture2D(u_image, uv - splitDir).b;
    }

    // --- Brightness ---
    color.rgb += u_brightness;

    // --- Contrast ---
    if (abs(u_contrast) > 0.001) {
      color.rgb = (color.rgb - 0.5) * (1.0 + u_contrast) + 0.5;
    }

    // --- Saturation ---
    if (abs(u_saturation) > 0.001) {
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(gray), color.rgb, 1.0 + u_saturation);
    }

    // --- Hue Shift ---
    if (abs(u_hueShift) > 0.001) {
      vec3 hsv = rgb2hsv(color.rgb);
      hsv.x = fract(hsv.x + u_hueShift);
      color.rgb = hsv2rgb(hsv);
    }

    // --- Vignette ---
    if (u_vignette > 0.001) {
      float dist = distance(v_uv, vec2(0.5));
      float vig = smoothstep(0.2, 0.85, dist);
      color.rgb *= 1.0 - vig * u_vignette;
    }

    color.a = 1.0;
    gl_FragColor = color;
  }
`;

// ===== WebGL Shader Engine =====
class ShaderEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
    if (!this.gl) {
      alert('WebGL not supported in this browser');
      return;
    }

    this.image = null;
    this.texture = null;
    this.effect = null;
    this.easing = 'easeInOut';
    this.duration = 3;
    this.playing = false;
    this.looping = true;
    this.startTime = 0;
    this.currentTime = 0;
    this.animFrame = null;
    this.onFrame = null;
    this.uniformCache = {};

    this._initGL();
  }

  _initGL() {
    const gl = this.gl;

    // Compile shaders
    const vs = this._compileShader(gl.VERTEX_SHADER, VERT_SHADER);
    const fs = this._compileShader(gl.FRAGMENT_SHADER, FRAG_SHADER);

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Shader link error:', gl.getProgramInfoLog(this.program));
      return;
    }

    gl.useProgram(this.program);

    // Fullscreen quad
    const positions = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    const texCoords = new Float32Array([0,1, 1,1, 0,0, 1,0]);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const texLoc = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // Texture
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  _getUniform(name) {
    if (!(name in this.uniformCache)) {
      this.uniformCache[name] = this.gl.getUniformLocation(this.program, name);
    }
    return this.uniformCache[name];
  }

  _setFloat(name, value) {
    const loc = this._getUniform(name);
    if (loc !== null) this.gl.uniform1f(loc, value);
  }

  _setVec2(name, x, y) {
    const loc = this._getUniform(name);
    if (loc !== null) this.gl.uniform2f(loc, x, y);
  }

  setImage(img) {
    this.image = img;
    const gl = this.gl;

    // Size canvas to image
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const maxDim = 1920;
    if (w > maxDim || h > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }

    this.canvas.width = w;
    this.canvas.height = h;
    gl.viewport(0, 0, w, h);

    // Upload texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    this.drawFrame(0);
  }

  setEffect(effect) {
    this.effect = effect;
    if (this.image) this.drawFrame(0);
  }

  // Resolve a param value: number, keyframe {from,to}, or oscillator {wave,freq,amp,...}
  resolveParam(paramDef, progress) {
    if (typeof paramDef === 'number') return paramDef;
    if (!paramDef || typeof paramDef !== 'object') return 0;

    // Keyframe
    if ('from' in paramDef && 'to' in paramDef) {
      const t = Easing[this.easing]?.(progress) ?? progress;
      return paramDef.from + (paramDef.to - paramDef.from) * t;
    }

    // Oscillator
    if (paramDef.wave) {
      const freq = paramDef.freq || 1;
      const phase = paramDef.phase || 0;
      const amp = paramDef.amp ?? 1;
      const offset = paramDef.offset || 0;
      const tSec = progress * this.duration;

      switch (paramDef.wave) {
        case 'sine':     return offset + amp * Math.sin(2 * Math.PI * freq * tSec + phase);
        case 'cosine':   return offset + amp * Math.cos(2 * Math.PI * freq * tSec + phase);
        case 'triangle': {
          const p = ((tSec * freq + phase / (2 * Math.PI)) % 1 + 1) % 1;
          return offset + amp * (4 * Math.abs(p - 0.5) - 1);
        }
        case 'sawtooth': {
          const p = ((tSec * freq + phase / (2 * Math.PI)) % 1 + 1) % 1;
          return offset + amp * (2 * p - 1);
        }
        case 'square':
          return offset + amp * (Math.sin(2 * Math.PI * freq * tSec + phase) >= 0 ? 1 : -1);
        case 'noise': {
          // Simple seeded noise approximation
          const seed = paramDef.seed || 0;
          const x = tSec * freq + seed;
          const n = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453;
          const v1 = (n - Math.floor(n)) * 2 - 1;
          // Smooth it with neighbor averaging
          const x2 = x + 0.01;
          const n2 = Math.sin(x2 * 12.9898 + seed * 78.233) * 43758.5453;
          const v2 = (n2 - Math.floor(n2)) * 2 - 1;
          return offset + amp * (v1 * 0.6 + v2 * 0.4);
        }
        default: return offset;
      }
    }

    return 0;
  }

  drawFrame(progress) {
    if (!this.image || !this.gl) return;

    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);

    // Time uniforms
    this._setFloat('u_time', progress);
    this._setFloat('u_timeSeconds', progress * this.duration);
    this._setVec2('u_resolution', this.canvas.width, this.canvas.height);

    // Reset all uniforms to 0
    const uniformNames = [
      'u_displaceX', 'u_displaceY', 'u_noiseWarp', 'u_noiseFreq', 'u_noiseSpeed',
      'u_waveAmpX', 'u_waveAmpY', 'u_waveFreqX', 'u_waveFreqY',
      'u_rippleAmp', 'u_rippleFreq', 'u_rippleCenter',
      'u_chromaR', 'u_chromaG', 'u_chromaB',
      'u_stretchX', 'u_stretchY', 'u_stretchPos',
      'u_zoom', 'u_rotate',
      'u_rgbSplitAngle', 'u_rgbSplitAmt',
      'u_glitchIntensity', 'u_glitchSeed',
      'u_pixelate', 'u_blur', 'u_blurAngle',
      'u_brightness', 'u_contrast', 'u_saturation', 'u_hueShift',
      'u_vignette', 'u_liquifyAmt', 'u_liquifyRadius',
      'u_smearAmt', 'u_smearAngle', 'u_fracture'
    ];
    for (const name of uniformNames) this._setFloat(name, 0);
    this._setVec2('u_zoomCenter', 0.5, 0.5);
    this._setVec2('u_liquifyCenter', 0.5, 0.5);

    // Apply effect layers
    if (this.effect && this.effect.layers) {
      for (const layer of this.effect.layers) {
        const p = (key) => this.resolveParam(layer.params?.[key], progress);

        switch (layer.type) {
          case 'displace':
            this._setFloat('u_displaceX', p('x'));
            this._setFloat('u_displaceY', p('y'));
            break;
          case 'noiseWarp':
            this._setFloat('u_noiseWarp', p('amount'));
            this._setFloat('u_noiseFreq', p('freq') || 4);
            this._setFloat('u_noiseSpeed', p('speed') || 1);
            break;
          case 'wave':
            this._setFloat('u_waveAmpX', p('ampX'));
            this._setFloat('u_waveAmpY', p('ampY'));
            this._setFloat('u_waveFreqX', p('freqX') || 20);
            this._setFloat('u_waveFreqY', p('freqY') || 20);
            break;
          case 'ripple':
            this._setFloat('u_rippleAmp', p('amp'));
            this._setFloat('u_rippleFreq', p('freq') || 30);
            this._setFloat('u_rippleCenter', p('center') || 0);
            break;
          case 'chromatic':
            this._setFloat('u_chromaR', p('r'));
            this._setFloat('u_chromaG', p('g') || 0);
            this._setFloat('u_chromaB', p('b'));
            break;
          case 'pixelStretch':
            this._setFloat('u_stretchX', p('x'));
            this._setFloat('u_stretchY', p('y'));
            this._setFloat('u_stretchPos', p('pos') || 0.5);
            break;
          case 'zoom':
            this._setFloat('u_zoom', p('amount'));
            this._setVec2('u_zoomCenter', p('centerX') || 0.5, p('centerY') || 0.5);
            break;
          case 'rotate':
            this._setFloat('u_rotate', p('angle') * Math.PI / 180);
            break;
          case 'rgbSplit':
            this._setFloat('u_rgbSplitAmt', p('amount'));
            this._setFloat('u_rgbSplitAngle', p('angle') || 0);
            break;
          case 'glitch':
            this._setFloat('u_glitchIntensity', p('intensity'));
            this._setFloat('u_glitchSeed', p('seed') || Math.floor(progress * 100));
            break;
          case 'pixelate':
            this._setFloat('u_pixelate', p('amount'));
            break;
          case 'blur':
            this._setFloat('u_blur', p('amount'));
            this._setFloat('u_blurAngle', (p('angle') || 0) * Math.PI / 180);
            break;
          case 'brightness':
            this._setFloat('u_brightness', p('amount'));
            break;
          case 'contrast':
            this._setFloat('u_contrast', p('amount'));
            break;
          case 'saturation':
            this._setFloat('u_saturation', p('amount'));
            break;
          case 'hueShift':
            this._setFloat('u_hueShift', p('amount'));
            break;
          case 'vignette':
            this._setFloat('u_vignette', p('intensity'));
            break;
          case 'liquify':
            this._setFloat('u_liquifyAmt', p('amount'));
            this._setVec2('u_liquifyCenter', p('centerX') || 0.5, p('centerY') || 0.5);
            this._setFloat('u_liquifyRadius', p('radius') || 0.4);
            break;
          case 'smear':
            this._setFloat('u_smearAmt', p('amount'));
            this._setFloat('u_smearAngle', (p('angle') || 0) * Math.PI / 180);
            break;
          case 'fracture':
            this._setFloat('u_fracture', p('amount'));
            break;
        }
      }
    }

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  play() {
    if (!this.image || !this.effect) return;
    this.playing = true;
    this.startTime = performance.now() - this.currentTime * this.duration * 1000;
    this._tick();
  }

  pause() {
    this.playing = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }

  stop() {
    this.playing = false;
    this.currentTime = 0;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.drawFrame(0);
    if (this.onFrame) this.onFrame(0);
  }

  seekTo(progress) {
    this.currentTime = Math.max(0, Math.min(1, progress));
    this.startTime = performance.now() - this.currentTime * this.duration * 1000;
    this.drawFrame(this.currentTime);
    if (this.onFrame) this.onFrame(this.currentTime);
  }

  _tick() {
    if (!this.playing) return;

    const elapsed = (performance.now() - this.startTime) / 1000;
    let progress = elapsed / this.duration;

    if (progress >= 1) {
      if (this.looping) {
        this.startTime = performance.now();
        progress = 0;
      } else {
        progress = 1;
        this.playing = false;
      }
    }

    this.currentTime = progress;
    this.drawFrame(progress);
    if (this.onFrame) this.onFrame(progress);

    if (this.playing) {
      this.animFrame = requestAnimationFrame(() => this._tick());
    }
  }
}
