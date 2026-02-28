/**
 * Shifter Prompt-to-Motion Parser
 * Converts natural language descriptions into motion effect definitions.
 * Uses keyword matching and parameterized templates.
 */

const PromptParser = (() => {

  // ===== Keyword -> Motion Mapping =====
  const MOTION_KEYWORDS = {
    // Zoom
    'zoom in':        { type: 'scaleUniform', params: { amount: { from: 0, to: 0.2 } } },
    'zoom out':       { type: 'scaleUniform', params: { amount: { from: 0.2, to: 0 } } },
    'scale up':       { type: 'scaleUniform', params: { amount: { from: 0, to: 0.25 } } },
    'scale down':     { type: 'scaleUniform', params: { amount: { from: 0.15, to: -0.05 } } },
    'zoom':           { type: 'scaleUniform', params: { amount: { from: 0, to: 0.15 } } },
    'grow':           { type: 'scaleUniform', params: { amount: { from: -0.1, to: 0.1 } } },
    'shrink':         { type: 'scaleUniform', params: { amount: { from: 0.1, to: -0.1 } } },
    'punch':          { type: 'scaleUniform', params: { amount: { from: 0, to: 0.3 } } },

    // Pan / Translate
    'pan left':       { type: 'translate', params: { x: { from: 0, to: -60 }, y: 0 } },
    'pan right':      { type: 'translate', params: { x: { from: 0, to: 60 }, y: 0 } },
    'pan up':         { type: 'translate', params: { x: 0, y: { from: 0, to: -40 } } },
    'pan down':       { type: 'translate', params: { x: 0, y: { from: 0, to: 40 } } },
    'slide left':     { type: 'translate', params: { x: { from: 40, to: -40 }, y: 0 } },
    'slide right':    { type: 'translate', params: { x: { from: -40, to: 40 }, y: 0 } },
    'slide':          { type: 'translate', params: { x: { from: -30, to: 30 }, y: 0 } },

    // Drift / Float
    'drift':          { type: 'translate', params: { x: { wave: 'sine', freq: 0.4, amp: 20 }, y: { wave: 'sine', freq: 0.25, amp: 12, phase: 1.2 } } },
    'float':          { type: 'translate', params: { x: { wave: 'sine', freq: 0.3, amp: 15 }, y: { wave: 'cosine', freq: 0.2, amp: 10 } } },
    'sway':           { type: 'translate', params: { x: { wave: 'sine', freq: 0.6, amp: 18 }, y: 0 } },
    'bob':            { type: 'translate', params: { x: 0, y: { wave: 'sine', freq: 0.8, amp: 12 } } },
    'hover':          { type: 'translate', params: { x: { wave: 'sine', freq: 0.3, amp: 8 }, y: { wave: 'sine', freq: 0.5, amp: 6, phase: 0.8 } } },
    'wander':         { type: 'translate', params: { x: { wave: 'noise', freq: 2, amp: 20, octaves: 3, seed: 42 }, y: { wave: 'noise', freq: 2, amp: 15, octaves: 3, seed: 99 } } },

    // Rotation
    'rotate':         { type: 'rotate', params: { angle: { from: 0, to: 15 } } },
    'spin':           { type: 'rotate', params: { angle: { from: 0, to: 360 } } },
    'tilt':           { type: 'rotate', params: { angle: { wave: 'sine', freq: 0.6, amp: 5 } } },
    'rock':           { type: 'rotate', params: { angle: { wave: 'sine', freq: 0.8, amp: 4 } } },
    'swing':          { type: 'rotate', params: { angle: { wave: 'sine', freq: 0.5, amp: 8 } } },
    'wobble':         { type: 'rotate', params: { angle: { wave: 'sine', freq: 2, amp: 3 } } },

    // Shake / Jitter
    'shake':          { type: 'shake', params: { intensityX: { wave: 'noise', freq: 10, amp: 8, octaves: 2, seed: 1 }, intensityY: { wave: 'noise', freq: 10, amp: 6, octaves: 2, seed: 2 } } },
    'jitter':         { type: 'shake', params: { intensityX: { wave: 'noise', freq: 14, amp: 6, octaves: 2, seed: 5 }, intensityY: { wave: 'noise', freq: 14, amp: 5, octaves: 2, seed: 6 } } },
    'tremble':        { type: 'shake', params: { intensityX: { wave: 'noise', freq: 18, amp: 3, octaves: 3, seed: 10 }, intensityY: { wave: 'noise', freq: 18, amp: 3, octaves: 3, seed: 11 } } },
    'vibrate':        { type: 'shake', params: { intensityX: { wave: 'sine', freq: 20, amp: 4 }, intensityY: { wave: 'sine', freq: 20, amp: 4, phase: 1 } } },
    'earthquake':     { type: 'shake', params: { intensityX: { wave: 'noise', freq: 8, amp: 20, octaves: 3, seed: 15 }, intensityY: { wave: 'noise', freq: 8, amp: 18, octaves: 3, seed: 16 } } },
    'handheld':       { type: 'shake', params: { intensityX: { wave: 'noise', freq: 4, amp: 5, octaves: 3, seed: 20 }, intensityY: { wave: 'noise', freq: 4, amp: 4, octaves: 3, seed: 21 } } },

    // Pulse / Beat
    'pulse':          { type: 'scaleUniform', params: { amount: { wave: 'sine', freq: 2, amp: 0.05 } } },
    'breathe':        { type: 'scaleUniform', params: { amount: { wave: 'sine', freq: 0.5, amp: 0.04 } } },
    'heartbeat':      { type: 'scaleUniform', params: { amount: { wave: 'sine', freq: 3.5, amp: 0.05 } } },
    'throb':          { type: 'scaleUniform', params: { amount: { wave: 'sine', freq: 2.5, amp: 0.06 } } },

    // Blur
    'blur':           { type: 'blur', params: { amount: { from: 0, to: 4 } } },
    'focus':          { type: 'blur', params: { amount: { from: 6, to: 0 } } },
    'defocus':        { type: 'blur', params: { amount: { from: 0, to: 6 } } },
    'soft':           { type: 'blur', params: { amount: { wave: 'sine', freq: 0.5, amp: 2, offset: 1 } } },

    // Color
    'flash':          { type: 'brightness', params: { amount: { wave: 'sine', freq: 3, amp: 30 } } },
    'flicker':        { type: 'brightness', params: { amount: { wave: 'noise', freq: 8, amp: 15, octaves: 2, seed: 50 } } },
    'fade in':        { type: 'opacity', params: { amount: { from: -1, to: 0 } } },
    'fade out':       { type: 'opacity', params: { amount: { from: 0, to: -1 } } },
    'color shift':    { type: 'hueRotate', params: { angle: { from: 0, to: 180 } } },
    'rainbow':        { type: 'hueRotate', params: { angle: { from: 0, to: 360 } } },
    'warm':           { type: 'hueRotate', params: { angle: { wave: 'sine', freq: 0.3, amp: 15, offset: 10 } } },
    'cool':           { type: 'hueRotate', params: { angle: { wave: 'sine', freq: 0.3, amp: 15, offset: -10 } } },
    'desaturate':     { type: 'saturate', params: { amount: { from: 0, to: -60 } } },
    'oversaturate':   { type: 'saturate', params: { amount: { from: 0, to: 60 } } },
    'brighten':       { type: 'brightness', params: { amount: { from: 0, to: 30 } } },
    'darken':         { type: 'brightness', params: { amount: { from: 0, to: -30 } } },

    // Skew / Distort
    'skew':           { type: 'skew', params: { x: { wave: 'sine', freq: 1, amp: 3 }, y: 0 } },
    'distort':        { type: 'skew', params: { x: { wave: 'noise', freq: 3, amp: 4, octaves: 2, seed: 70 }, y: { wave: 'noise', freq: 3, amp: 2, octaves: 2, seed: 71 } } },
    'warp':           { type: 'skew', params: { x: { wave: 'sine', freq: 0.8, amp: 5 }, y: { wave: 'cosine', freq: 0.6, amp: 3 } } },

    // Glitch
    'glitch':         { type: 'shake', params: { intensityX: { wave: 'square', freq: 6, amp: 12 }, intensityY: { wave: 'square', freq: 4, amp: 4, phase: 0.5 } } },

    // Post
    'vignette':       { type: 'vignette', params: { intensity: 0.5 } },
    'cinema':         { type: 'vignette', params: { intensity: 0.35 } },

    // Bounce
    'bounce':         { type: 'translate', params: { x: 0, y: { wave: 'sine', freq: 2, amp: 20 } } },
  };

  // Intensity modifiers
  const INTENSITY_MAP = {
    'very subtle': 0.3, 'barely': 0.2, 'slightly': 0.4, 'subtle': 0.5, 'gentle': 0.5, 'soft': 0.6, 'light': 0.6,
    'moderate': 1, 'normal': 1,
    'strong': 1.5, 'heavy': 1.6, 'intense': 1.8, 'aggressive': 2, 'extreme': 2.5, 'violent': 3,
    'slow': 0.5, 'fast': 1.8, 'rapid': 2.2, 'quick': 1.6
  };

  // Speed modifiers (affect frequency)
  const SPEED_MAP = {
    'very slow': 0.3, 'slow': 0.5, 'slowly': 0.5,
    'medium': 1, 'moderate': 1,
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

    for (const keyword of sortedKeywords) {
      if (text.includes(keyword) && !matched.has(keyword)) {
        // Avoid duplicate layer types for similar keywords
        const def = MOTION_KEYWORDS[keyword];
        const alreadyHasType = layers.some(l => l.type === def.type);

        // Allow multiple of same type only for specific combos
        if (alreadyHasType && !['translate', 'shake'].includes(def.type)) continue;

        matched.add(keyword);
        layers.push({
          type: def.type,
          params: scaleParams(deepClone(def.params), intensity, speed)
        });
      }
    }

    // If nothing matched, create a gentle default
    if (layers.length === 0) {
      layers.push(
        { type: 'scaleUniform', params: { amount: { from: 0, to: 0.08 * intensity } } },
        { type: 'translate', params: { x: { wave: 'sine', freq: 0.3 * speed, amp: 10 * intensity }, y: { wave: 'sine', freq: 0.2 * speed, amp: 6 * intensity, phase: 1 } } }
      );
    }

    // Detect easing suggestions
    let easing = 'easeInOut';
    if (text.includes('bounce') || text.includes('bouncy')) easing = 'bounce';
    else if (text.includes('elastic') || text.includes('spring')) easing = 'easeInOutElastic';
    else if (text.includes('smooth') || text.includes('gentle')) easing = 'easeInOut';
    else if (text.includes('sharp') || text.includes('hard') || text.includes('abrupt')) easing = 'easeIn';
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
