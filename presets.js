/**
 * Shifter Shader Presets
 * 15 transformative pixel-level motion effects using WebGL shaders.
 * Each preset drives GPU uniforms for per-pixel displacement, warping, etc.
 */

const PRESETS = [
  {
    id: 'liquid-drift',
    name: 'Liquid Drift',
    icon: '🌊',
    description: 'Organic noise-driven pixel warping',
    category: 'organic',
    layers: [
      {
        type: 'noiseWarp',
        params: {
          amount: { wave: 'sine', freq: 0.3, amp: 0.08, offset: 0.05 },
          freq: 4,
          speed: 1.2
        }
      },
      {
        type: 'chromatic',
        params: {
          r: { wave: 'sine', freq: 0.4, amp: 1.5 },
          b: { wave: 'sine', freq: 0.4, amp: -1.5, phase: 0.5 }
        }
      },
      { type: 'zoom', params: { amount: { from: 0, to: 0.08 } } }
    ]
  },
  {
    id: 'pixel-melt',
    name: 'Pixel Melt',
    icon: '🫠',
    description: 'Pixels dripping and melting downward',
    category: 'destructive',
    layers: [
      {
        type: 'noiseWarp',
        params: {
          amount: { from: 0, to: 0.15 },
          freq: 3,
          speed: 0.8
        }
      },
      {
        type: 'wave',
        params: {
          ampX: { from: 0, to: 40 },
          ampY: { from: 0, to: 60 },
          freqX: 8,
          freqY: 5
        }
      },
      {
        type: 'blur',
        params: { amount: { from: 0, to: 3 }, angle: 90 }
      },
      { type: 'vignette', params: { intensity: 0.4 } }
    ]
  },
  {
    id: 'rgb-shatter',
    name: 'RGB Shatter',
    icon: '🔴',
    description: 'Aggressive chromatic splitting',
    category: 'glitch',
    layers: [
      {
        type: 'rgbSplit',
        params: {
          amount: { wave: 'sine', freq: 2, amp: 15, offset: 5 },
          angle: { wave: 'sawtooth', freq: 0.5, amp: 180 }
        }
      },
      {
        type: 'chromatic',
        params: {
          r: { wave: 'noise', freq: 4, amp: 4, seed: 1 },
          b: { wave: 'noise', freq: 4, amp: -4, seed: 2 }
        }
      },
      {
        type: 'glitch',
        params: {
          intensity: { wave: 'square', freq: 3, amp: 0.5, offset: 0.3 },
          seed: { wave: 'sawtooth', freq: 8, amp: 100 }
        }
      }
    ]
  },
  {
    id: 'ripple-pond',
    name: 'Ripple Pond',
    icon: '💧',
    description: 'Concentric ripples from center',
    category: 'organic',
    layers: [
      {
        type: 'ripple',
        params: {
          amp: { wave: 'sine', freq: 0.6, amp: 0.04, offset: 0.03 },
          freq: 40,
          center: 0
        }
      },
      {
        type: 'chromatic',
        params: {
          r: { wave: 'sine', freq: 0.6, amp: 0.8 },
          b: { wave: 'sine', freq: 0.6, amp: -0.8, phase: 0.3 }
        }
      }
    ]
  },
  {
    id: 'data-corrupt',
    name: 'Data Corrupt',
    icon: '👾',
    description: 'Digital corruption with block glitch',
    category: 'glitch',
    layers: [
      {
        type: 'glitch',
        params: {
          intensity: { wave: 'noise', freq: 5, amp: 1.0, seed: 42 },
          seed: { wave: 'sawtooth', freq: 12, amp: 200 }
        }
      },
      {
        type: 'rgbSplit',
        params: {
          amount: { wave: 'square', freq: 4, amp: 20 },
          angle: { wave: 'noise', freq: 3, amp: 90, seed: 10 }
        }
      },
      {
        type: 'pixelate',
        params: {
          amount: { wave: 'square', freq: 2, amp: 6, offset: 2 }
        }
      },
      {
        type: 'displace',
        params: {
          x: { wave: 'square', freq: 6, amp: 30 },
          y: { wave: 'square', freq: 4, amp: 10, phase: 1 }
        }
      }
    ]
  },
  {
    id: 'liquify-swirl',
    name: 'Liquify Swirl',
    icon: '🌀',
    description: 'Swirling liquify distortion',
    category: 'organic',
    layers: [
      {
        type: 'liquify',
        params: {
          amount: { wave: 'sine', freq: 0.4, amp: 4, offset: 0 },
          centerX: { wave: 'sine', freq: 0.2, amp: 0.15, offset: 0.5 },
          centerY: { wave: 'cosine', freq: 0.15, amp: 0.1, offset: 0.5 },
          radius: 0.5
        }
      },
      {
        type: 'noiseWarp',
        params: { amount: 0.03, freq: 3, speed: 0.8 }
      }
    ]
  },
  {
    id: 'wave-distort',
    name: 'Wave Distort',
    icon: '〰️',
    description: 'Horizontal and vertical pixel waves',
    category: 'transform',
    layers: [
      {
        type: 'wave',
        params: {
          ampX: { wave: 'sine', freq: 0.5, amp: 30, offset: 15 },
          ampY: { wave: 'cosine', freq: 0.3, amp: 20, offset: 10 },
          freqX: 15,
          freqY: 12
        }
      },
      {
        type: 'chromatic',
        params: {
          r: { wave: 'sine', freq: 0.5, amp: 1.0 },
          b: { wave: 'sine', freq: 0.5, amp: -1.0 }
        }
      }
    ]
  },
  {
    id: 'pixel-sort',
    name: 'Pixel Stretch',
    icon: '📊',
    description: 'Directional pixel smearing',
    category: 'destructive',
    layers: [
      {
        type: 'pixelStretch',
        params: {
          x: { from: 0, to: 3 },
          y: 0,
          pos: { wave: 'sine', freq: 0.4, amp: 0.3, offset: 0.5 }
        }
      },
      {
        type: 'smear',
        params: {
          amount: { from: 0, to: 1.5 },
          angle: 0
        }
      },
      {
        type: 'blur',
        params: { amount: { from: 0, to: 2 }, angle: 0 }
      }
    ]
  },
  {
    id: 'dream-shift',
    name: 'Dream Shift',
    icon: '✨',
    description: 'Ethereal warping with glow',
    category: 'cinematic',
    layers: [
      {
        type: 'noiseWarp',
        params: {
          amount: { wave: 'sine', freq: 0.25, amp: 0.05, offset: 0.03 },
          freq: 2.5,
          speed: 0.6
        }
      },
      {
        type: 'zoom',
        params: {
          amount: { wave: 'sine', freq: 0.2, amp: 0.04, offset: 0.02 }
        }
      },
      {
        type: 'blur',
        params: {
          amount: { wave: 'sine', freq: 0.3, amp: 2, offset: 1 },
          angle: 0
        }
      },
      {
        type: 'brightness',
        params: { amount: { wave: 'sine', freq: 0.3, amp: 0.06, offset: 0.03 } }
      },
      {
        type: 'chromatic',
        params: {
          r: { wave: 'sine', freq: 0.3, amp: 1.2 },
          b: { wave: 'sine', freq: 0.3, amp: -1.2, phase: 0.5 }
        }
      }
    ]
  },
  {
    id: 'earthquake',
    name: 'Earthquake',
    icon: '💥',
    description: 'Violent displacement shake',
    category: 'energetic',
    layers: [
      {
        type: 'displace',
        params: {
          x: { wave: 'noise', freq: 12, amp: 40, seed: 1 },
          y: { wave: 'noise', freq: 10, amp: 35, seed: 2 }
        }
      },
      {
        type: 'rotate',
        params: { angle: { wave: 'noise', freq: 8, amp: 3, seed: 3 } }
      },
      {
        type: 'noiseWarp',
        params: { amount: 0.04, freq: 6, speed: 3 }
      },
      {
        type: 'rgbSplit',
        params: {
          amount: { wave: 'noise', freq: 8, amp: 8, seed: 5 },
          angle: { wave: 'noise', freq: 4, amp: 180, seed: 6 }
        }
      }
    ]
  },
  {
    id: 'vhs-degrade',
    name: 'VHS Degrade',
    icon: '📼',
    description: 'Analog tape distortion',
    category: 'retro',
    layers: [
      {
        type: 'wave',
        params: {
          ampX: { wave: 'noise', freq: 3, amp: 12, seed: 1 },
          ampY: 0,
          freqX: 3,
          freqY: 1
        }
      },
      {
        type: 'rgbSplit',
        params: {
          amount: { wave: 'noise', freq: 2, amp: 6, offset: 3, seed: 2 },
          angle: 0
        }
      },
      {
        type: 'saturation',
        params: { amount: { wave: 'noise', freq: 1, amp: 0.3, offset: 0.15, seed: 3 } }
      },
      {
        type: 'displace',
        params: {
          x: { wave: 'noise', freq: 5, amp: 8, seed: 4 },
          y: 0
        }
      },
      { type: 'vignette', params: { intensity: 0.5 } }
    ]
  },
  {
    id: 'fracture-grid',
    name: 'Fracture',
    icon: '🪟',
    description: 'Image shatters into displaced tiles',
    category: 'destructive',
    layers: [
      {
        type: 'fracture',
        params: {
          amount: { from: 0, to: 0.8 }
        }
      },
      {
        type: 'rgbSplit',
        params: {
          amount: { from: 0, to: 10 },
          angle: 45
        }
      },
      {
        type: 'chromatic',
        params: {
          r: { from: 0, to: 2 },
          b: { from: 0, to: -2 }
        }
      }
    ],
    defaultEasing: 'easeIn'
  },
  {
    id: 'zoom-warp',
    name: 'Zoom Warp',
    icon: '🔍',
    description: 'Zooming in with barrel distortion',
    category: 'cinematic',
    layers: [
      {
        type: 'zoom',
        params: {
          amount: { from: 0, to: 0.3 },
          centerX: { wave: 'sine', freq: 0.15, amp: 0.1, offset: 0.5 },
          centerY: { wave: 'cosine', freq: 0.1, amp: 0.08, offset: 0.5 }
        }
      },
      {
        type: 'noiseWarp',
        params: {
          amount: { from: 0, to: 0.06 },
          freq: 3,
          speed: 1
        }
      },
      {
        type: 'chromatic',
        params: {
          r: { from: 0, to: 2 },
          b: { from: 0, to: -2 }
        }
      }
    ]
  },
  {
    id: 'pulse-warp',
    name: 'Pulse Warp',
    icon: '💓',
    description: 'Rhythmic zoom with pixel ripple',
    category: 'energetic',
    layers: [
      {
        type: 'zoom',
        params: {
          amount: { wave: 'sine', freq: 2, amp: 0.06 }
        }
      },
      {
        type: 'ripple',
        params: {
          amp: { wave: 'sine', freq: 2, amp: 0.02 },
          freq: 25
        }
      },
      {
        type: 'noiseWarp',
        params: {
          amount: { wave: 'sine', freq: 2, amp: 0.03 },
          freq: 5,
          speed: 2
        }
      },
      {
        type: 'chromatic',
        params: {
          r: { wave: 'sine', freq: 2, amp: 1.0 },
          b: { wave: 'sine', freq: 2, amp: -1.0 }
        }
      }
    ]
  },
  {
    id: 'smear-drift',
    name: 'Smear Drift',
    icon: '🖌️',
    description: 'Directional pixel smearing with drift',
    category: 'organic',
    layers: [
      {
        type: 'smear',
        params: {
          amount: { wave: 'sine', freq: 0.4, amp: 1.2, offset: 0.5 },
          angle: { from: 0, to: 180 }
        }
      },
      {
        type: 'displace',
        params: {
          x: { wave: 'sine', freq: 0.3, amp: 15 },
          y: { wave: 'cosine', freq: 0.2, amp: 10 }
        }
      },
      {
        type: 'noiseWarp',
        params: { amount: 0.02, freq: 3, speed: 0.5 }
      }
    ]
  }
];
