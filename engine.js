/**
 * Shifter Motion Engine
 * Core animation engine with oscillators, easing, noise, and compositing.
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

// ===== Noise (Simplex-ish Perlin) =====
class PerlinNoise {
  constructor(seed = Math.random() * 65536) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates with seed
    let s = seed | 0;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  _lerp(a, b, t) { return a + t * (b - a); }
  _grad(hash, x) {
    return (hash & 1) === 0 ? x : -x;
  }

  noise1D(x) {
    const xi = Math.floor(x) & 255;
    const xf = x - Math.floor(x);
    const u = this._fade(xf);
    return this._lerp(
      this._grad(this.perm[xi], xf),
      this._grad(this.perm[xi + 1], xf - 1),
      u
    );
  }

  // Fractal Brownian Motion
  fbm(x, octaves = 3, lacunarity = 2, gain = 0.5) {
    let value = 0, amplitude = 1, frequency = 1, maxVal = 0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise1D(x * frequency);
      maxVal += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return value / maxVal;
  }
}

// ===== Oscillators =====
const Oscillators = {
  sine:     (t, freq, phase) => Math.sin(2 * Math.PI * freq * t + phase),
  cosine:   (t, freq, phase) => Math.cos(2 * Math.PI * freq * t + phase),
  triangle: (t, freq, phase) => {
    const p = ((t * freq + phase / (2 * Math.PI)) % 1 + 1) % 1;
    return 4 * Math.abs(p - 0.5) - 1;
  },
  sawtooth: (t, freq, phase) => {
    const p = ((t * freq + phase / (2 * Math.PI)) % 1 + 1) % 1;
    return 2 * p - 1;
  },
  square: (t, freq, phase) => {
    return Math.sin(2 * Math.PI * freq * t + phase) >= 0 ? 1 : -1;
  },
  noise: null // handled via PerlinNoise
};

// ===== Motion Effect Definition =====
// An effect is an array of "layers", each layer transforms the canvas.
// Layer types: translate, scale, rotate, blur, brightness, hue, skew, crop, shake
//
// Each layer has:
//   type: string
//   params: object with numeric values or oscillator configs
//
// An oscillator config: { wave: 'sine', freq: 2, phase: 0, amp: 1 }
// A noise config:       { wave: 'noise', freq: 2, amp: 1, octaves: 3, seed: 42 }
// A keyframe config:    { from: 0, to: 100 } (animated from->to over duration)
// A static value:       just a number

class MotionEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = null;
    this.effect = null;
    this.easing = 'easeInOut';
    this.duration = 3; // seconds
    this.fps = 30;
    this.playing = false;
    this.looping = true;
    this.startTime = 0;
    this.currentTime = 0;
    this.animFrame = null;
    this.noiseGenerators = new Map();
    this.onFrame = null; // callback(progress)
  }

  setImage(img) {
    this.image = img;
    this.canvas.width = img.naturalWidth;
    this.canvas.height = img.naturalHeight;
    this.drawFrame(0);
  }

  setEffect(effect) {
    this.effect = effect;
    this.noiseGenerators.clear();
    // Pre-create noise generators for deterministic results
    if (effect && effect.layers) {
      effect.layers.forEach((layer, li) => {
        Object.entries(layer.params || {}).forEach(([key, val]) => {
          if (val && typeof val === 'object' && val.wave === 'noise') {
            this.noiseGenerators.set(`${li}_${key}`, new PerlinNoise(val.seed || li * 1000 + key.charCodeAt(0)));
          }
        });
      });
    }
    if (this.image) this.drawFrame(0);
  }

  // Resolve a parameter value at time t (0-1 normalized progress)
  resolveParam(layerIndex, key, paramDef, t) {
    if (typeof paramDef === 'number') return paramDef;
    if (!paramDef || typeof paramDef !== 'object') return 0;

    // Keyframe interpolation
    if ('from' in paramDef && 'to' in paramDef) {
      const easedT = Easing[this.easing]?.(t) ?? t;
      return paramDef.from + (paramDef.to - paramDef.from) * easedT;
    }

    // Oscillator / noise
    if (paramDef.wave) {
      const freq = paramDef.freq || 1;
      const phase = paramDef.phase || 0;
      const amp = paramDef.amp ?? 1;
      const offset = paramDef.offset || 0;

      if (paramDef.wave === 'noise') {
        const gen = this.noiseGenerators.get(`${layerIndex}_${key}`);
        if (gen) {
          return offset + amp * gen.fbm(t * this.duration * freq, paramDef.octaves || 3);
        }
        return offset;
      }

      const oscFn = Oscillators[paramDef.wave];
      if (oscFn) {
        return offset + amp * oscFn(t * this.duration, freq, phase);
      }
    }

    // Eased value
    if ('value' in paramDef) {
      if (paramDef.easeIn) {
        return paramDef.value * Easing.easeIn(t);
      }
      return paramDef.value;
    }

    return 0;
  }

  drawFrame(progress) {
    const ctx = this.ctx;
    const img = this.image;
    if (!img) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Default transform state
    let tx = 0, ty = 0;
    let sx = 1, sy = 1;
    let rot = 0;
    let skewX = 0, skewY = 0;
    let filterStr = '';
    let opacity = 1;
    let cropX = 0, cropY = 0, cropW = w, cropH = h;

    if (this.effect && this.effect.layers) {
      for (let li = 0; li < this.effect.layers.length; li++) {
        const layer = this.effect.layers[li];
        const p = (param) => this.resolveParam(li, param, layer.params?.[param], progress);

        switch (layer.type) {
          case 'translate':
            tx += p('x');
            ty += p('y');
            break;
          case 'scale':
            sx *= (1 + p('x'));
            sy *= (1 + p('y'));
            break;
          case 'scaleUniform':
            const s = 1 + p('amount');
            sx *= s;
            sy *= s;
            break;
          case 'rotate':
            rot += p('angle') * Math.PI / 180;
            break;
          case 'skew':
            skewX += p('x');
            skewY += p('y');
            break;
          case 'blur':
            const blurVal = Math.max(0, p('amount'));
            if (blurVal > 0) filterStr += `blur(${blurVal}px) `;
            break;
          case 'brightness':
            const bright = p('amount');
            filterStr += `brightness(${100 + bright}%) `;
            break;
          case 'contrast':
            const contrast = p('amount');
            filterStr += `contrast(${100 + contrast}%) `;
            break;
          case 'saturate':
            const sat = p('amount');
            filterStr += `saturate(${100 + sat}%) `;
            break;
          case 'hueRotate':
            filterStr += `hue-rotate(${p('angle')}deg) `;
            break;
          case 'opacity':
            opacity *= Math.max(0, Math.min(1, 1 + p('amount')));
            break;
          case 'crop':
            cropX = p('x') || 0;
            cropY = p('y') || 0;
            cropW = p('w') || w;
            cropH = p('h') || h;
            break;
          case 'shake':
            tx += p('intensityX');
            ty += p('intensityY');
            break;
          case 'vignette':
            // handled after draw
            break;
        }
      }
    }

    // Apply transforms
    ctx.translate(w / 2 + tx, h / 2 + ty);
    ctx.rotate(rot);
    ctx.transform(1, Math.tan(skewY * Math.PI / 180), Math.tan(skewX * Math.PI / 180), 1, 0, 0);
    ctx.scale(sx, sy);

    if (filterStr) ctx.filter = filterStr.trim();
    ctx.globalAlpha = opacity;

    // Draw image centered
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    ctx.restore();

    // Post-effects (vignette etc.)
    if (this.effect && this.effect.layers) {
      for (let li = 0; li < this.effect.layers.length; li++) {
        const layer = this.effect.layers[li];
        if (layer.type === 'vignette') {
          const intensity = this.resolveParam(li, 'intensity', layer.params?.intensity, progress);
          const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
          gradient.addColorStop(0, `rgba(0,0,0,0)`);
          gradient.addColorStop(1, `rgba(0,0,0,${Math.min(1, Math.abs(intensity))})`);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, w, h);
        }
      }
    }
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

  // Render all frames for export
  async renderFrames(fps, onProgress) {
    const totalFrames = Math.ceil(this.duration * fps);
    const frames = [];

    for (let i = 0; i <= totalFrames; i++) {
      const progress = i / totalFrames;
      this.drawFrame(progress);

      const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'));
      frames.push(blob);

      if (onProgress) onProgress(i / totalFrames);
    }

    return frames;
  }
}

// ===== GIF Encoder (simple LZW-based) =====
class SimpleGifEncoder {
  constructor(width, height, fps = 30) {
    this.width = width;
    this.height = height;
    this.delay = Math.round(100 / fps); // centiseconds
    this.frames = [];
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  addFrame(imageData) {
    this.ctx.drawImage(imageData, 0, 0, this.width, this.height);
    const data = this.ctx.getImageData(0, 0, this.width, this.height);
    this.frames.push(data);
  }

  async encode(onProgress) {
    // Use a quantized approach - create GIF manually
    // For simplicity, we'll render to WebM via MediaRecorder if available
    // and fall back to frame-by-frame download
    return null; // handled by app.js MediaRecorder approach
  }
}
