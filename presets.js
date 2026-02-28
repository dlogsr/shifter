/**
 * Shifter Motion Presets
 * 15 presets inspired by Jitter, CapCut, After Effects, and trending motion design.
 */

const PRESETS = [
  {
    id: 'ken-burns-in',
    name: 'Ken Burns In',
    icon: '🔍',
    description: 'Classic slow zoom in with drift',
    category: 'cinematic',
    layers: [
      {
        type: 'scaleUniform',
        params: { amount: { from: 0, to: 0.15 } }
      },
      {
        type: 'translate',
        params: {
          x: { from: 0, to: -30 },
          y: { from: 0, to: -20 }
        }
      }
    ]
  },
  {
    id: 'ken-burns-out',
    name: 'Ken Burns Out',
    icon: '🔭',
    description: 'Slow zoom out reveal',
    category: 'cinematic',
    layers: [
      {
        type: 'scaleUniform',
        params: { amount: { from: 0.2, to: 0 } }
      },
      {
        type: 'translate',
        params: {
          x: { from: 20, to: 0 },
          y: { from: 15, to: 0 }
        }
      }
    ]
  },
  {
    id: 'jitter',
    name: 'Jitter',
    icon: '⚡',
    description: 'Rapid random shake effect',
    category: 'energetic',
    layers: [
      {
        type: 'shake',
        params: {
          intensityX: { wave: 'noise', freq: 12, amp: 8, octaves: 2, seed: 1 },
          intensityY: { wave: 'noise', freq: 12, amp: 6, octaves: 2, seed: 2 }
        }
      },
      {
        type: 'rotate',
        params: {
          angle: { wave: 'noise', freq: 8, amp: 1.5, octaves: 2, seed: 3 }
        }
      }
    ]
  },
  {
    id: 'drift',
    name: 'Gentle Drift',
    icon: '🌊',
    description: 'Smooth floating motion',
    category: 'calm',
    layers: [
      {
        type: 'translate',
        params: {
          x: { wave: 'sine', freq: 0.5, amp: 25, phase: 0 },
          y: { wave: 'sine', freq: 0.3, amp: 15, phase: Math.PI / 3 }
        }
      },
      {
        type: 'scaleUniform',
        params: {
          amount: { wave: 'sine', freq: 0.4, amp: 0.02, phase: Math.PI / 4 }
        }
      }
    ]
  },
  {
    id: 'pulse',
    name: 'Pulse',
    icon: '💓',
    description: 'Rhythmic scale breathing',
    category: 'energetic',
    layers: [
      {
        type: 'scaleUniform',
        params: {
          amount: { wave: 'sine', freq: 2, amp: 0.06, phase: 0 }
        }
      },
      {
        type: 'brightness',
        params: {
          amount: { wave: 'sine', freq: 2, amp: 8, phase: 0 }
        }
      }
    ]
  },
  {
    id: 'film-grain',
    name: 'Film Shake',
    icon: '🎬',
    description: 'Vintage film gate weave',
    category: 'retro',
    layers: [
      {
        type: 'shake',
        params: {
          intensityX: { wave: 'noise', freq: 6, amp: 3, octaves: 3, seed: 10 },
          intensityY: { wave: 'noise', freq: 5, amp: 4, octaves: 3, seed: 20 }
        }
      },
      {
        type: 'rotate',
        params: {
          angle: { wave: 'noise', freq: 4, amp: 0.4, octaves: 2, seed: 30 }
        }
      },
      {
        type: 'brightness',
        params: {
          amount: { wave: 'noise', freq: 8, amp: 5, octaves: 2, seed: 40 }
        }
      },
      {
        type: 'vignette',
        params: { intensity: 0.4 }
      }
    ]
  },
  {
    id: 'parallax',
    name: 'Parallax Slide',
    icon: '📐',
    description: 'Horizontal slide with depth',
    category: 'cinematic',
    layers: [
      {
        type: 'translate',
        params: {
          x: { from: -60, to: 60 },
          y: { from: 0, to: 0 }
        }
      },
      {
        type: 'scaleUniform',
        params: {
          amount: { from: 0.05, to: 0 }
        }
      }
    ]
  },
  {
    id: 'glitch',
    name: 'Glitch',
    icon: '👾',
    description: 'Digital glitch with offset',
    category: 'energetic',
    layers: [
      {
        type: 'shake',
        params: {
          intensityX: { wave: 'square', freq: 6, amp: 15, phase: 0 },
          intensityY: { wave: 'square', freq: 4, amp: 5, phase: 1 }
        }
      },
      {
        type: 'skew',
        params: {
          x: { wave: 'square', freq: 3, amp: 2, phase: 0.5 },
          y: 0
        }
      },
      {
        type: 'hueRotate',
        params: {
          angle: { wave: 'square', freq: 5, amp: 30, phase: 0 }
        }
      },
      {
        type: 'scaleUniform',
        params: {
          amount: { wave: 'square', freq: 7, amp: 0.02, phase: 0.3 }
        }
      }
    ]
  },
  {
    id: 'tilt',
    name: 'Tilt Swing',
    icon: '🎪',
    description: 'Pendulum rotation swing',
    category: 'playful',
    layers: [
      {
        type: 'rotate',
        params: {
          angle: { wave: 'sine', freq: 0.8, amp: 5, phase: 0 }
        }
      },
      {
        type: 'translate',
        params: {
          x: { wave: 'sine', freq: 0.8, amp: 15, phase: 0 },
          y: { wave: 'cosine', freq: 1.6, amp: 8, phase: 0 }
        }
      }
    ]
  },
  {
    id: 'bounce-in',
    name: 'Bounce In',
    icon: '🏀',
    description: 'Scale up with bounce easing',
    category: 'playful',
    layers: [
      {
        type: 'scaleUniform',
        params: { amount: { from: -0.3, to: 0 } }
      },
      {
        type: 'translate',
        params: {
          x: 0,
          y: { from: 40, to: 0 }
        }
      }
    ],
    defaultEasing: 'bounce'
  },
  {
    id: 'dreamy',
    name: 'Dreamy Float',
    icon: '☁️',
    description: 'Soft zoom with blur drift',
    category: 'calm',
    layers: [
      {
        type: 'scaleUniform',
        params: {
          amount: { wave: 'sine', freq: 0.3, amp: 0.04, offset: 0.02 }
        }
      },
      {
        type: 'translate',
        params: {
          x: { wave: 'sine', freq: 0.2, amp: 12, phase: 0 },
          y: { wave: 'cosine', freq: 0.15, amp: 8, phase: 0 }
        }
      },
      {
        type: 'blur',
        params: {
          amount: { wave: 'sine', freq: 0.5, amp: 1.5, offset: 0.5 }
        }
      },
      {
        type: 'brightness',
        params: {
          amount: { wave: 'sine', freq: 0.4, amp: 6, offset: 3 }
        }
      }
    ]
  },
  {
    id: 'spin',
    name: 'Slow Spin',
    icon: '🌀',
    description: 'Continuous slow rotation',
    category: 'hypnotic',
    layers: [
      {
        type: 'rotate',
        params: {
          angle: { from: 0, to: 360 }
        }
      },
      {
        type: 'scaleUniform',
        params: { amount: 0.15 }
      }
    ]
  },
  {
    id: 'zoom-blur',
    name: 'Zoom Punch',
    icon: '💥',
    description: 'Fast zoom in with impact',
    category: 'energetic',
    layers: [
      {
        type: 'scaleUniform',
        params: { amount: { from: 0, to: 0.35 } }
      },
      {
        type: 'blur',
        params: {
          amount: { from: 0, to: 4 }
        }
      },
      {
        type: 'brightness',
        params: {
          amount: { from: 0, to: 25 }
        }
      }
    ],
    defaultEasing: 'easeIn'
  },
  {
    id: 'wave',
    name: 'Wave',
    icon: '〰️',
    description: 'Oscillating wave motion',
    category: 'playful',
    layers: [
      {
        type: 'translate',
        params: {
          x: 0,
          y: { wave: 'sine', freq: 1.5, amp: 20 }
        }
      },
      {
        type: 'rotate',
        params: {
          angle: { wave: 'sine', freq: 1.5, amp: 3, phase: Math.PI / 2 }
        }
      },
      {
        type: 'skew',
        params: {
          x: { wave: 'sine', freq: 1.5, amp: 1.5, phase: Math.PI / 4 },
          y: 0
        }
      }
    ]
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    icon: '❤️',
    description: 'Double-tap pulse rhythm',
    category: 'energetic',
    layers: [
      {
        type: 'scaleUniform',
        params: {
          amount: { wave: 'sine', freq: 4, amp: 0.05, phase: 0 }
        }
      },
      {
        type: 'brightness',
        params: {
          amount: { wave: 'sine', freq: 4, amp: 6, phase: 0 }
        }
      },
      {
        type: 'vignette',
        params: {
          intensity: { wave: 'sine', freq: 4, amp: 0.15, offset: 0.2 }
        }
      }
    ]
  }
];
