/**
 * Shifter App Controller
 * Handles UI, image upload, preset selection, prompt generation, playback, and export.
 */

(function () {
  'use strict';

  // ===== DOM Elements =====
  const canvas = document.getElementById('canvas');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const uploadOverlay = document.getElementById('upload-overlay');
  const fileInput = document.getElementById('file-input');
  const presetList = document.getElementById('preset-list');
  const promptInput = document.getElementById('prompt-input');
  const btnGenerate = document.getElementById('btn-generate');
  const btnPlay = document.getElementById('btn-play');
  const btnStop = document.getElementById('btn-stop');
  const btnLoop = document.getElementById('btn-loop');
  const btnExport = document.getElementById('btn-export');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const timelineTrack = document.getElementById('timeline-track');
  const timelineProgress = document.getElementById('timeline-progress');
  const timelineHandle = document.getElementById('timeline-handle');
  const timeDisplay = document.getElementById('time-display');
  const durationSlider = document.getElementById('duration');
  const durationLabel = document.getElementById('duration-label');
  const effectStack = document.getElementById('effect-stack');
  const easingSelect = document.getElementById('easing-select');
  const easingSection = document.getElementById('easing-section');
  const paramsSection = document.getElementById('params-section');
  const paramsControls = document.getElementById('params-controls');
  const exportModal = document.getElementById('export-modal');
  const btnCancelExport = document.getElementById('btn-cancel-export');
  const btnStartExport = document.getElementById('btn-start-export');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const exportProgress = document.getElementById('export-progress');

  // ===== Engine =====
  const engine = new MotionEngine(canvas);

  let currentPresetId = null;
  let currentEffect = null;
  let imageLoaded = false;

  // ===== Initialize Presets =====
  function renderPresets() {
    presetList.innerHTML = '';
    PRESETS.forEach(preset => {
      const el = document.createElement('div');
      el.className = 'preset-item';
      el.dataset.id = preset.id;
      el.innerHTML = `
        <div class="preset-icon">${preset.icon}</div>
        <div class="preset-info">
          <div class="preset-name">${preset.name}</div>
          <div class="preset-desc">${preset.description}</div>
        </div>
      `;
      el.addEventListener('click', () => selectPreset(preset));
      presetList.appendChild(el);
    });
  }

  function selectPreset(preset) {
    currentPresetId = preset.id;
    currentEffect = {
      name: preset.name,
      icon: preset.icon,
      description: preset.description,
      layers: JSON.parse(JSON.stringify(preset.layers))
    };

    // Update active state
    document.querySelectorAll('.preset-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === preset.id);
    });

    // Set easing
    if (preset.defaultEasing) {
      easingSelect.value = preset.defaultEasing;
      engine.easing = preset.defaultEasing;
    }

    applyEffect();
  }

  function applyEffect() {
    if (!currentEffect) return;

    engine.setEffect(currentEffect);
    updateEffectStack();
    updateParams();

    // Enable playback if image loaded
    if (imageLoaded) {
      btnPlay.disabled = false;
      btnStop.disabled = false;
      btnExport.disabled = false;
      easingSection.style.display = '';
    }
  }

  // ===== Effect Stack Display =====
  const LAYER_COLORS = {
    translate: '#6366f1', scale: '#8b5cf6', scaleUniform: '#8b5cf6',
    rotate: '#ec4899', skew: '#f59e0b', shake: '#ef4444',
    blur: '#06b6d4', brightness: '#fbbf24', contrast: '#f97316',
    saturate: '#10b981', hueRotate: '#a78bfa', opacity: '#64748b',
    vignette: '#334155', crop: '#14b8a6'
  };

  function updateEffectStack() {
    if (!currentEffect || !currentEffect.layers.length) {
      effectStack.innerHTML = '<p class="empty-state">Select a preset or generate an effect to begin.</p>';
      return;
    }

    effectStack.innerHTML = '';
    currentEffect.layers.forEach((layer, i) => {
      const el = document.createElement('div');
      el.className = 'effect-layer';
      const color = LAYER_COLORS[layer.type] || '#6366f1';
      const summary = getLayerSummary(layer);
      el.innerHTML = `
        <div class="effect-dot" style="background:${color}"></div>
        <span class="effect-layer-name">${layer.type}</span>
        <span class="effect-layer-value">${summary}</span>
      `;
      effectStack.appendChild(el);
    });
  }

  function getLayerSummary(layer) {
    const parts = [];
    for (const [key, val] of Object.entries(layer.params || {})) {
      if (typeof val === 'number') {
        parts.push(`${key}: ${val.toFixed(1)}`);
      } else if (val && typeof val === 'object') {
        if (val.wave) parts.push(`${key}: ${val.wave}`);
        else if ('from' in val) parts.push(`${key}: ${val.from.toFixed(0)}→${val.to.toFixed(0)}`);
      }
    }
    return parts.join(', ') || '—';
  }

  // ===== Parameter Controls =====
  function updateParams() {
    if (!currentEffect || !currentEffect.layers.length) {
      paramsSection.style.display = 'none';
      return;
    }

    paramsSection.style.display = '';
    paramsControls.innerHTML = '';

    currentEffect.layers.forEach((layer, li) => {
      for (const [key, val] of Object.entries(layer.params || {})) {
        if (typeof val === 'number') {
          addParamSlider(layer, li, key, val, -100, 100);
        } else if (val && typeof val === 'object') {
          if ('amp' in val) {
            addParamSlider(layer, li, `${key} amp`, val.amp, 0, Math.max(50, val.amp * 3), (v) => {
              val.amp = v;
              applyLiveUpdate();
            });
          }
          if ('freq' in val) {
            addParamSlider(layer, li, `${key} freq`, val.freq, 0.1, Math.max(25, val.freq * 3), (v) => {
              val.freq = v;
              applyLiveUpdate();
            });
          }
          if ('from' in val && 'to' in val) {
            addParamSlider(layer, li, `${key} range`, val.to - val.from, -200, 200, (v) => {
              val.to = val.from + v;
              applyLiveUpdate();
            });
          }
        }
      }
    });
  }

  function addParamSlider(layer, layerIndex, label, value, min, max, onChange) {
    const row = document.createElement('div');
    row.className = 'param-row';

    const step = (max - min) > 10 ? 0.5 : 0.01;
    row.innerHTML = `
      <div class="param-label">
        <span>${layer.type} · ${label}</span>
        <span class="param-value">${typeof value === 'number' ? value.toFixed(2) : value}</span>
      </div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}">
    `;

    const input = row.querySelector('input');
    const valDisplay = row.querySelector('.param-value');

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valDisplay.textContent = v.toFixed(2);
      if (onChange) onChange(v);
    });

    paramsControls.appendChild(row);
  }

  function applyLiveUpdate() {
    engine.setEffect(currentEffect);
    updateEffectStack();
    if (!engine.playing) {
      engine.drawFrame(engine.currentTime);
    }
  }

  // ===== Image Upload =====
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const img = new Image();
    img.onload = () => {
      imageLoaded = true;
      uploadOverlay.style.display = 'none';

      // Limit canvas size for performance
      const maxDim = 1920;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      // Create a resized version
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      tmpCanvas.getContext('2d').drawImage(img, 0, 0, w, h);

      const resizedImg = new Image();
      resizedImg.onload = () => {
        engine.setImage(resizedImg);
        if (currentEffect) {
          btnPlay.disabled = false;
          btnStop.disabled = false;
          btnExport.disabled = false;
          easingSection.style.display = '';
        }
      };
      resizedImg.src = tmpCanvas.toDataURL();
    };
    img.src = URL.createObjectURL(file);
  }

  uploadOverlay.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  // Drag & Drop
  uploadOverlay.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadOverlay.classList.add('drag-over');
  });
  uploadOverlay.addEventListener('dragleave', () => {
    uploadOverlay.classList.remove('drag-over');
  });
  uploadOverlay.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadOverlay.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  // Also allow drop on canvas wrapper when image already loaded
  canvasWrapper.addEventListener('dragover', (e) => { e.preventDefault(); });
  canvasWrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  // ===== Prompt Generation =====
  btnGenerate.addEventListener('click', generateFromPrompt);
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateFromPrompt();
    }
  });

  function generateFromPrompt() {
    const text = promptInput.value.trim();
    if (!text) return;

    const effect = PromptParser.parse(text);
    currentPresetId = null;
    currentEffect = effect;

    // Deselect presets
    document.querySelectorAll('.preset-item').forEach(el => el.classList.remove('active'));

    // Apply easing from parser
    if (effect.defaultEasing) {
      easingSelect.value = effect.defaultEasing;
      engine.easing = effect.defaultEasing;
    }

    applyEffect();

    // Auto-play if image loaded
    if (imageLoaded && !engine.playing) {
      engine.play();
      setPlayingUI(true);
    }
  }

  // ===== Playback =====
  btnPlay.addEventListener('click', () => {
    if (engine.playing) {
      engine.pause();
      setPlayingUI(false);
    } else {
      engine.play();
      setPlayingUI(true);
    }
  });

  btnStop.addEventListener('click', () => {
    engine.stop();
    setPlayingUI(false);
  });

  btnLoop.addEventListener('click', () => {
    engine.looping = !engine.looping;
    btnLoop.classList.toggle('active', engine.looping);
  });

  function setPlayingUI(playing) {
    iconPlay.style.display = playing ? 'none' : '';
    iconPause.style.display = playing ? '' : 'none';
  }

  // Timeline
  engine.onFrame = (progress) => {
    const pct = (progress * 100).toFixed(1);
    timelineProgress.style.width = pct + '%';
    timelineHandle.style.left = pct + '%';

    const current = progress * engine.duration;
    const total = engine.duration;
    timeDisplay.textContent = `${formatTime(current)} / ${formatTime(total)}`;
  };

  function formatTime(s) {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${ms}`;
  }

  // Timeline scrubbing
  let scrubbing = false;
  timelineTrack.addEventListener('mousedown', (e) => {
    scrubbing = true;
    scrubTo(e);
  });
  document.addEventListener('mousemove', (e) => {
    if (scrubbing) scrubTo(e);
  });
  document.addEventListener('mouseup', () => { scrubbing = false; });

  function scrubTo(e) {
    const rect = timelineTrack.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    engine.seekTo(pct);
  }

  // Duration
  durationSlider.addEventListener('input', () => {
    const val = parseFloat(durationSlider.value);
    engine.duration = val;
    durationLabel.textContent = val.toFixed(1) + 's';
  });

  // Easing
  easingSelect.addEventListener('change', () => {
    engine.easing = easingSelect.value;
    if (!engine.playing && imageLoaded) {
      engine.drawFrame(engine.currentTime);
    }
  });

  // ===== Export =====
  let exportFormat = 'gif';

  btnExport.addEventListener('click', () => {
    exportModal.style.display = '';
    exportProgress.style.display = 'none';
  });

  btnCancelExport.addEventListener('click', () => {
    exportModal.style.display = 'none';
  });

  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) exportModal.style.display = 'none';
  });

  // Format buttons
  document.querySelectorAll('[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-format]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      exportFormat = btn.dataset.format;
    });
  });

  btnStartExport.addEventListener('click', async () => {
    const fps = parseInt(document.getElementById('export-fps').value);
    const resMult = parseFloat(document.getElementById('export-resolution').value);

    exportProgress.style.display = '';
    btnStartExport.disabled = true;

    // Pause playback during export
    const wasPlaying = engine.playing;
    if (wasPlaying) engine.pause();

    // Set up export canvas at target resolution
    const origW = canvas.width;
    const origH = canvas.height;
    const exportW = Math.round(origW * resMult);
    const exportH = Math.round(origH * resMult);

    canvas.width = exportW;
    canvas.height = exportH;

    if (exportFormat === 'webm') {
      await exportWebM(fps);
    } else if (exportFormat === 'gif') {
      await exportGif(fps);
    } else {
      await exportFrames(fps);
    }

    // Restore canvas
    canvas.width = origW;
    canvas.height = origH;
    engine.drawFrame(engine.currentTime);

    btnStartExport.disabled = false;
    exportModal.style.display = 'none';

    if (wasPlaying) engine.play();
  });

  async function exportWebM(fps) {
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8000000
    });

    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        downloadBlob(blob, 'shifter-animation.webm');
        resolve();
      };

      recorder.start();

      const totalFrames = Math.ceil(engine.duration * fps);
      let frame = 0;

      function renderNext() {
        if (frame > totalFrames) {
          recorder.stop();
          return;
        }

        const progress = frame / totalFrames;
        engine.drawFrame(progress);

        progressFill.style.width = (progress * 100) + '%';
        progressText.textContent = `Rendering frame ${frame}/${totalFrames}...`;

        frame++;
        requestAnimationFrame(renderNext);
      }

      renderNext();
    });
  }

  async function exportGif(fps) {
    // Use frame-by-frame canvas capture and convert to GIF using a basic approach
    // We'll generate frames as data URLs and combine them using an in-page solution
    const totalFrames = Math.ceil(engine.duration * fps);
    const frameDelay = Math.round(1000 / fps);

    // Since we don't have a GIF library, we'll export as WebM if supported,
    // otherwise export individual frames
    if (typeof MediaRecorder !== 'undefined') {
      // Try WebM first, rename as fallback
      const stream = canvas.captureStream(fps);

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      return new Promise((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          downloadBlob(blob, 'shifter-animation.webm');
          progressText.textContent = 'Exported as WebM (GIF encoding requires a library)';
          resolve();
        };

        recorder.start();

        let frame = 0;
        function renderNext() {
          if (frame > totalFrames) {
            recorder.stop();
            return;
          }

          const progress = frame / totalFrames;
          engine.drawFrame(progress);

          progressFill.style.width = (progress * 100) + '%';
          progressText.textContent = `Rendering frame ${frame}/${totalFrames}...`;

          frame++;
          requestAnimationFrame(renderNext);
        }

        renderNext();
      });
    } else {
      // Fallback to frames
      return exportFrames(fps);
    }
  }

  async function exportFrames(fps) {
    const totalFrames = Math.ceil(engine.duration * fps);

    for (let i = 0; i <= totalFrames; i++) {
      const progress = i / totalFrames;
      engine.drawFrame(progress);

      progressFill.style.width = (progress * 100) + '%';
      progressText.textContent = `Saving frame ${i}/${totalFrames}...`;

      // Download each frame
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      downloadBlob(blob, `frame-${String(i).padStart(4, '0')}.png`);

      // Small delay to not overwhelm the browser
      await new Promise(r => setTimeout(r, 30));
    }

    progressText.textContent = `Done! ${totalFrames + 1} frames exported.`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ===== Keyboard Shortcuts =====
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        btnPlay.click();
        break;
      case 'Escape':
        engine.stop();
        setPlayingUI(false);
        break;
      case 'KeyL':
        btnLoop.click();
        break;
    }
  });

  // ===== Init =====
  renderPresets();
  engine.onFrame?.(0);
  durationLabel.textContent = engine.duration.toFixed(1) + 's';

})();
