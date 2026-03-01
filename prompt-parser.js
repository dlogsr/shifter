/**
 * Shifter Prompt-to-Shader Parser
 * Converts natural language into shader-based motion effect definitions.
 * Maps keywords to WebGL uniform-driven per-pixel transformations.
 */

const PromptParser = (() => {

  // ===== Keyword -> Shader Layer Mapping =====
  const MOTION_KEYWORDS = {

    // --- Noise / Warp ---
    'noise warp':    { type: 'noiseWarp', params: { amount: 0.08, freq: 4, speed: 1 } },
    'warp':          { type: 'noiseWarp', params: { amount: 0.06, freq: 3.5, speed: 1 } },
    'organic':       { type: 'noiseWarp', params: { amount: 0.05, freq: 3, speed: 0.8 } },
    'liquid':        { type: 'noiseWarp', params: { amount: 0.1, freq: 3, speed: 1.2 } },
    'melt':          { type: 'noiseWarp', params: { amount: { from: 0, to: 0.15 }, freq: 3, speed: 0.8 } },
    'flow':          { type: 'noiseWarp', params: { amount: 0.06, freq: 2.5, speed: 1.5 } },
    'morph':         { type: 'noiseWarp', params: { amount: { wave: 'sine', freq: 0.3, amp: 0.06, offset: 0.04 }, freq: 4, speed: 1 } },
    'breathe':       { type: 'noiseWarp', params: { amount: { wave: 'sine', freq: 0.4, amp: 0.04, offset: 0.02 }, freq: 2, speed: 0.5 } },

    // --- Wave Distortion ---
    'wave':          { type: 'wave', params: { ampX: 25, ampY: 15, freqX: 15, freqY: 12 } },
    'wave distort':  { type: 'wave', params: { ampX: 35, ampY: 25, freqX: 12, freqY: 10 } },
    'undulate':      { type: 'wave', params: { ampX: 20, ampY: 30, freqX: 8, freqY: 6 } },
    'sine wave':     { type: 'wave', params: { ampX: { wave: 'sine', freq: 0.5, amp: 20 }, ampY: 0, freqX: 20, freqY: 1 } },
    'wobble':        { type: 'wave', params: { ampX: { wave: 'sine', freq: 1.5, amp: 15 }, ampY: { wave: 'cosine', freq: 1, amp: 10 }, freqX: 10, freqY: 8 } },

    // --- Ripple ---
    'ripple':        { type: 'ripple', params: { amp: 0.04, freq: 35, center: 0 } },
    'pond':          { type: 'ripple', params: { amp: 0.05, freq: 30, center: 0 } },
    'shockwave':     { type: 'ripple', params: { amp: { from: 0.08, to: 0 }, freq: 50, center: 0 } },
    'pulse':         { type: 'ripple', params: { amp: { wave: 'sine', freq: 2, amp: 0.03 }, freq: 25 } },
    'radial':        { type: 'ripple', params: { amp: 0.03, freq: 20, center: 0 } },

    // --- Displacement ---
    'displace':      { type: 'displace', params: { x: { wave: 'noise', freq: 6, amp: 20, seed: 1 }, y: { wave: 'noise', freq: 5, amp: 15, seed: 2 } } },
    'shift':         { type: 'displace', params: { x: { wave: 'sine', freq: 1, amp: 25 }, y: { wave: 'cosine', freq: 0.8, amp: 15 } } },
    'drift':         { type: 'displace', params: { x: { wave: 'sine', freq: 0.3, amp: 15 }, y: { wave: 'sine', freq: 0.2, amp: 10, phase: 1.2 } } },
    'pan left':      { type: 'displace', params: { x: { from: 0, to: -60 }, y: 0 } },
    'pan right':     { type: 'displace', params: { x: { from: 0, to: 60 }, y: 0 } },
    'pan up':        { type: 'displace', params: { x: 0, y: { from: 0, to: -40 } } },
    'pan down':      { type: 'displace', params: { x: 0, y: { from: 0, to: 40 } } },
    'slide':         { type: 'displace', params: { x: { from: -30, to: 30 }, y: 0 } },
    'float':         { type: 'displace', params: { x: { wave: 'sine', freq: 0.25, amp: 12 }, y: { wave: 'cosine', freq: 0.2, amp: 8 } } },
    'shake':         { type: 'displace', params: { x: { wave: 'noise', freq: 10, amp: 15, seed: 1 }, y: { wave: 'noise', freq: 10, amp: 12, seed: 2 } } },
    'jitter':        { type: 'displace', params: { x: { wave: 'noise', freq: 14, amp: 10, seed: 5 }, y: { wave: 'noise', freq: 14, amp: 8, seed: 6 } } },
    'earthquake':    { type: 'displace', params: { x: { wave: 'noise', freq: 8, amp: 40, seed: 1 }, y: { wave: 'noise', freq: 8, amp: 35, seed: 2 } } },
    'vibrate':       { type: 'displace', params: { x: { wave: 'sine', freq: 20, amp: 5 }, y: { wave: 'sine', freq: 20, amp: 5, phase: 1 } } },
    'handheld':      { type: 'displace', params: { x: { wave: 'noise', freq: 4, amp: 6, seed: 10 }, y: { wave: 'noise', freq: 4, amp: 5, seed: 11 } } },

    // --- Chromatic Aberration ---
    'chromatic':         { type: 'chromatic', params: { r: 2, b: -2 } },
    'chromatic aberration': { type: 'chromatic', params: { r: 3, b: -3 } },
    'color fringe':      { type: 'chromatic', params: { r: 2.5, b: -2.5 } },
    'prism':             { type: 'chromatic', params: { r: { wave: 'sine', freq: 1, amp: 3 }, b: { wave: 'sine', freq: 1, amp: -3 } } },

    // --- RGB Split ---
    'rgb split':     { type: 'rgbSplit', params: { amount: 10, angle: 0 } },
    'color split':   { type: 'rgbSplit', params: { amount: 12, angle: 0 } },
    'channel shift': { type: 'rgbSplit', params: { amount: { wave: 'sine', freq: 1.5, amp: 8 }, angle: { wave: 'sawtooth', freq: 0.3, amp: 180 } } },
    'rgb':           { type: 'rgbSplit', params: { amount: 8, angle: 0 } },

    // --- Glitch ---
    'glitch':        { type: 'glitch', params: { intensity: { wave: 'noise', freq: 5, amp: 0.8, seed: 42 }, seed: { wave: 'sawtooth', freq: 10, amp: 200 } } },
    'corrupt':       { type: 'glitch', params: { intensity: { wave: 'noise', freq: 3, amp: 1.2, seed: 10 }, seed: { wave: 'sawtooth', freq: 8, amp: 150 } } },
    'digital':       { type: 'glitch', params: { intensity: { wave: 'square', freq: 4, amp: 0.6, offset: 0.2 }, seed: { wave: 'sawtooth', freq: 12, amp: 200 } } },
    'data':          { type: 'glitch', params: { intensity: 0.7, seed: { wave: 'sawtooth', freq: 10, amp: 200 } } },
    'broken':        { type: 'glitch', params: { intensity: { from: 0, to: 1.5 }, seed: { wave: 'sawtooth', freq: 15, amp: 300 } } },
    'vhs':           { type: 'glitch', params: { intensity: { wave: 'noise', freq: 2, amp: 0.4, offset: 0.2, seed: 5 }, seed: { wave: 'sawtooth', freq: 6, amp: 100 } } },

    // --- Pixelate ---
    'pixelate':      { type: 'pixelate', params: { amount: { from: 1, to: 15 } } },
    'mosaic':        { type: 'pixelate', params: { amount: { wave: 'sine', freq: 0.5, amp: 8, offset: 4 } } },
    'pixel':         { type: 'pixelate', params: { amount: { from: 1, to: 10 } } },
    'blocky':        { type: 'pixelate', params: { amount: { wave: 'square', freq: 2, amp: 6, offset: 3 } } },
    'low res':       { type: 'pixelate', params: { amount: 8 } },

    // --- Pixel Stretch ---
    'pixel stretch': { type: 'pixelStretch', params: { x: 2.5, y: 0, pos: 0.5 } },
    'stretch':       { type: 'pixelStretch', params: { x: { from: 0, to: 3 }, y: 0, pos: { wave: 'sine', freq: 0.4, amp: 0.3, offset: 0.5 } } },
    'smear':         { type: 'smear', params: { amount: { wave: 'sine', freq: 0.4, amp: 1.2, offset: 0.5 }, angle: 0 } },
    'drag':          { type: 'smear', params: { amount: 1.0, angle: { from: 0, to: 90 } } },

    // --- Liquify ---
    'liquify':       { type: 'liquify', params: { amount: { wave: 'sine', freq: 0.4, amp: 4 }, centerX: 0.5, centerY: 0.5, radius: 0.45 } },
    'swirl':         { type: 'liquify', params: { amount: { from: 0, to: 6 }, centerX: 0.5, centerY: 0.5, radius: 0.5 } },
    'twist':         { type: 'liquify', params: { amount: { wave: 'sine', freq: 0.5, amp: 5 }, centerX: 0.5, centerY: 0.5, radius: 0.4 } },
    'vortex':        { type: 'liquify', params: { amount: { from: 0, to: 8 }, centerX: 0.5, centerY: 0.5, radius: 0.6 } },

    // --- Fracture ---
    'fracture':      { type: 'fracture', params: { amount: { from: 0, to: 0.8 } } },
    'shatter':       { type: 'fracture', params: { amount: { from: 0, to: 1.0 } } },
    'tile':          { type: 'fracture', params: { amount: { wave: 'sine', freq: 0.5, amp: 0.4, offset: 0.3 } } },
    'fragment':      { type: 'fracture', params: { amount: { from: 0, to: 0.6 } } },

    // --- Zoom ---
    'zoom in':       { type: 'zoom', params: { amount: { from: 0, to: 0.25 } } },
    'zoom out':      { type: 'zoom', params: { amount: { from: 0.25, to: 0 } } },
    'zoom':          { type: 'zoom', params: { amount: { from: 0, to: 0.15 } } },
    'punch':         { type: 'zoom', params: { amount: { from: 0, to: 0.35 } } },
    'grow':          { type: 'zoom', params: { amount: { from: 0, to: 0.1 } } },

    // --- Rotate ---
    'rotate':        { type: 'rotate', params: { angle: { from: 0, to: 15 } } },
    'spin':          { type: 'rotate', params: { angle: { from: 0, to: 360 } } },
    'tilt':          { type: 'rotate', params: { angle: { wave: 'sine', freq: 0.6, amp: 5 } } },
    'rock':          { type: 'rotate', params: { angle: { wave: 'sine', freq: 0.8, amp: 4 } } },

    // --- Blur ---
    'blur':          { type: 'blur', params: { amount: { from: 0, to: 5 }, angle: 0 } },
    'motion blur':   { type: 'blur', params: { amount: { wave: 'sine', freq: 1, amp: 4 }, angle: 0 } },
    'radial blur':   { type: 'blur', params: { amount: { from: 0, to: 6 }, angle: { from: 0, to: 360 } } },
    'defocus':       { type: 'blur', params: { amount: { from: 6, to: 0 }, angle: 0 } },
    'focus':         { type: 'blur', params: { amount: { from: 6, to: 0 }, angle: 0 } },

    // --- Color ---
    'flash':         { type: 'brightness', params: { amount: { wave: 'sine', freq: 3, amp: 0.3 } } },
    'flicker':       { type: 'brightness', params: { amount: { wave: 'noise', freq: 8, amp: 0.15, seed: 50 } } },
    'brighten':      { type: 'brightness', params: { amount: { from: 0, to: 0.3 } } },
    'darken':        { type: 'brightness', params: { amount: { from: 0, to: -0.3 } } },
    'color shift':   { type: 'hueShift', params: { amount: { from: 0, to: 0.5 } } },
    'rainbow':       { type: 'hueShift', params: { amount: { from: 0, to: 1 } } },
    'hue':           { type: 'hueShift', params: { amount: { wave: 'sine', freq: 0.3, amp: 0.15 } } },
    'desaturate':    { type: 'saturation', params: { amount: { from: 0, to: -0.8 } } },
    'oversaturate':  { type: 'saturation', params: { amount: { from: 0, to: 0.6 } } },

    // --- Glow ---
    'glow':          { type: 'glow', params: { amount: { wave: 'sine', freq: 0.5, amp: 0.8, offset: 0.5 }, radius: 4 } },
    'bloom':         { type: 'glow', params: { amount: { from: 0, to: 1.5 }, radius: 6 } },
    'radiance':      { type: 'glow', params: { amount: { wave: 'sine', freq: 0.3, amp: 0.6, offset: 0.4 }, radius: 5 } },
    'neon':          { type: 'glow', params: { amount: 1.2, radius: 3 } },

    // --- Edge Detect ---
    'edge':          { type: 'edgeDetect', params: { amount: { from: 0, to: 0.8 } } },
    'outline':       { type: 'edgeDetect', params: { amount: 0.6 } },
    'sketch':        { type: 'edgeDetect', params: { amount: { wave: 'sine', freq: 0.4, amp: 0.4, offset: 0.3 } } },

    // --- Post ---
    'vignette':      { type: 'vignette', params: { intensity: 0.5 } },
    'cinema':        { type: 'vignette', params: { intensity: 0.35 } },
    'cinematic':     { type: 'vignette', params: { intensity: 0.3 } },
  };

  // Intensity modifiers
  const INTENSITY_MAP = {
    'very subtle': 0.25, 'barely': 0.2, 'slightly': 0.4, 'subtle': 0.5, 'gentle': 0.5,
    'soft': 0.6, 'light': 0.6, 'moderate': 1, 'normal': 1,
    'strong': 1.6, 'heavy': 1.8, 'intense': 2, 'aggressive': 2.5, 'extreme': 3, 'violent': 3.5,
    'massive': 3, 'crazy': 2.5, 'wild': 2.5
  };

  // Speed modifiers
  const SPEED_MAP = {
    'very slow': 0.3, 'slow': 0.5, 'slowly': 0.5,
    'medium': 1, 'moderate speed': 1,
    'fast': 2, 'quick': 1.8, 'rapid': 2.5, 'very fast': 3
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function scaleParams(params, intensityMult, speedMult) {
    const result = {};
    for (const [key, val] of Object.entries(params)) {
      if (typeof val === 'number') {
        result[key] = val * intensityMult;
      } else if (val && typeof val === 'object') {
        const scaled = { ...val };
        if ('amp' in scaled) scaled.amp *= intensityMult;
        if ('freq' in scaled) scaled.freq *= speedMult;
        if ('from' in scaled && 'to' in scaled) {
          scaled.from *= intensityMult;
          scaled.to *= intensityMult;
        }
        if ('offset' in scaled) scaled.offset *= intensityMult;
        result[key] = scaled;
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  function parse(prompt) {
    const text = prompt.toLowerCase().trim();
    const layers = [];
    const matched = new Set();

    // Detect intensity modifier
    let intensity = 1;
    for (const [word, mult] of Object.entries(INTENSITY_MAP)) {
      if (text.includes(word)) {
        intensity = mult;
        break;
      }
    }

    // Detect speed modifier
    let speed = 1;
    for (const [word, mult] of Object.entries(SPEED_MAP)) {
      if (text.includes(word)) {
        speed = mult;
        break;
      }
    }

    // Sort keywords by length (longer first for better matching)
    const sortedKeywords = Object.keys(MOTION_KEYWORDS).sort((a, b) => b.length - a.length);

    const usedTypes = new Set();

    for (const keyword of sortedKeywords) {
      if (text.includes(keyword) && !matched.has(keyword)) {
        const def = MOTION_KEYWORDS[keyword];

        // Avoid duplicate types unless it's displace (can layer)
        if (usedTypes.has(def.type) && def.type !== 'displace') continue;

        matched.add(keyword);
        usedTypes.add(def.type);

        layers.push({
          type: def.type,
          params: scaleParams(deepClone(def.params), intensity, speed)
        });
      }
    }

    // If nothing matched, create a gentle noise warp + chromatic default
    if (layers.length === 0) {
      layers.push(
        {
          type: 'noiseWarp',
          params: {
            amount: { wave: 'sine', freq: 0.3 * speed, amp: 0.05 * intensity, offset: 0.03 * intensity },
            freq: 3,
            speed: 0.8 * speed
          }
        },
        {
          type: 'displace',
          params: {
            x: { wave: 'sine', freq: 0.3 * speed, amp: 10 * intensity },
            y: { wave: 'cosine', freq: 0.2 * speed, amp: 6 * intensity }
          }
        },
        {
          type: 'chromatic',
          params: {
            r: intensity * 1.0,
            b: intensity * -1.0
          }
        }
      );
    }

    // Auto-add chromatic aberration for glitch/destructive effects if not present
    if (!usedTypes.has('chromatic') && !usedTypes.has('rgbSplit')) {
      const hasDestructive = usedTypes.has('glitch') || usedTypes.has('fracture') ||
                             usedTypes.has('pixelate') || usedTypes.has('displace');
      if (hasDestructive) {
        layers.push({
          type: 'chromatic',
          params: { r: intensity * 1.5, b: intensity * -1.5 }
        });
      }
    }

    // Detect easing
    let easing = 'easeInOut';
    if (text.includes('bounce') || text.includes('bouncy')) easing = 'bounce';
    else if (text.includes('elastic') || text.includes('spring')) easing = 'easeInOutElastic';
    else if (text.includes('smooth') || text.includes('gentle')) easing = 'easeInOut';
    else if (text.includes('sharp') || text.includes('hard') || text.includes('abrupt') || text.includes('sudden')) easing = 'easeIn';
    else if (text.includes('linear') || text.includes('constant') || text.includes('steady')) easing = 'linear';

    return {
      name: 'Custom Effect',
      icon: '✨',
      description: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
      layers,
      defaultEasing: easing,
      _matchedKeywords: [...matched]
    };
  }

  return { parse };
})();
