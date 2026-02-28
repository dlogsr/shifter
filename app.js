/**
 * Shifter App Controller
 * Wires UI to WebGL ShaderEngine: image upload, presets, prompt, playback, export.
 */

(function () {
  'use strict';

  // ===== DOM =====
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
  const engine = new ShaderEngine(canvas);

  let currentPresetId = null;
  let currentEffect = null;
  let imageLoaded = false;

  // ===== Presets =====
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

    document.querySelectorAll('.preset-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === preset.id);
    });

    if (preset.defaultEasing) {
      easingSelect.value = preset.defaultEasing;
      engine.easing = preset.defaultEasing;
    }

    applyEffect();

    // Auto-play on preset select if image is loaded
    if (imageLoaded && !engine.playing) {
      engine.play();
      setPlayingUI(true);
    }
  }

  function applyEffect() {
    if (!currentEffect) return;

    engine.setEffect(currentEffect);
    updateEffectStack();
    updateParams();

    if (imageLoaded) {
      btnPlay.disabled = false;
      btnStop.disabled = false;
      btnExport.disabled = false;
      easingSection.style.display = '';
    }
  }

  // ===== Effect Stack Display =====
  const LAYER_COLORS = {
    displace: '#6366f1', noiseWarp: '#8b5cf6', wave: '#06b6d4',
    ripple: '#3b82f6', chromatic: '#ec4899', rgbSplit: '#f43f5e',
    glitch: '#ef4444', pixelate: '#f59e0b', pixelStretch: '#f97316',
    zoom: '#10b981', rotate: '#a78bfa', blur: '#64748b',
    brightness: '#fbbf24', contrast: '#f97316', saturation: '#10b981',
    hueShift: '#a78bfa', vignette: '#334155', liquify: '#8b5cf6',
    smear: '#ec4899', fracture: '#ef4444'
  };

  function updateEffectStack() {
    if (!currentEffect || !currentEffect.layers.length) {
      effectStack.innerHTML = '<p class="empty-state">Select a preset or describe a motion effect.</p>';
      return;
    }

    effectStack.innerHTML = '';
    currentEffect.layers.forEach(layer => {
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
        parts.push(`${key}: ${formatNum(val)}`);
      } else if (val && typeof val === 'object') {
        if (val.wave) parts.push(`${key}: ${val.wave}`);
        else if ('from' in val) parts.push(`${key}: ${formatNum(val.from)}→${formatNum(val.to)}`);
      }
    }
    return parts.join(', ') || '—';
  }

  function formatNum(n) {
    if (Math.abs(n) >= 10) return n.toFixed(0);
    if (Math.abs(n) >= 1) return n.toFixed(1);
    return n.toFixed(3);
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
          const absMax = Math.max(Math.abs(val) * 3, 1);
          addParamSlider(layer, key, val, -absMax, absMax, (v) => {
            layer.params[key] = v;
            applyLiveUpdate();
          });
        } else if (val && typeof val === 'object') {
          if ('amp' in val) {
            const maxAmp = Math.max(Math.abs(val.amp) * 3, 0.5);
            addParamSlider(layer, `${key} amp`, val.amp, 0, maxAmp, (v) => {
              val.amp = v;
              applyLiveUpdate();
            });
          }
          if ('freq' in val) {
            const maxFreq = Math.max(val.freq * 3, 2);
            addParamSlider(layer, `${key} freq`, val.freq, 0.1, maxFreq, (v) => {
              val.freq = v;
              applyLiveUpdate();
            });
          }
          if ('from' in val && 'to' in val) {
            const range = val.to - val.from;
            const absMax = Math.max(Math.abs(range) * 2, 1);
            addParamSlider(layer, `${key} range`, range, -absMax, absMax, (v) => {
              val.to = val.from + v;
              applyLiveUpdate();
            });
          }
        }
      }
    });
  }

  function addParamSlider(layer, label, value, min, max, onChange) {
    const row = document.createElement('div');
    row.className = 'param-row';
    const step = (max - min) > 10 ? 0.5 : 0.001;
    row.innerHTML = `
      <div class="param-label">
        <span>${layer.type} · ${label}</span>
        <span class="param-value">${formatNum(value)}</span>
      </div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}">
    `;

    const input = row.querySelector('input');
    const valDisplay = row.querySelector('.param-value');

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valDisplay.textContent = formatNum(v);
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
      engine.setImage(img);

      if (currentEffect) {
        btnPlay.disabled = false;
        btnStop.disabled = false;
        btnExport.disabled = false;
        easingSection.style.display = '';
      }
    };
    img.src = URL.createObjectURL(file);
  }

  uploadOverlay.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  // Drag & Drop
  ['dragover', 'dragenter'].forEach(evt => {
    uploadOverlay.addEventListener(evt, (e) => {
      e.preventDefault();
      uploadOverlay.classList.add('drag-over');
    });
    canvasWrapper.addEventListener(evt, (e) => e.preventDefault());
  });

  uploadOverlay.addEventListener('dragleave', () => uploadOverlay.classList.remove('drag-over'));

  uploadOverlay.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadOverlay.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  canvasWrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  // ===== Prompt =====
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

    document.querySelectorAll('.preset-item').forEach(el => el.classList.remove('active'));

    if (effect.defaultEasing) {
      easingSelect.value = effect.defaultEasing;
      engine.easing = effect.defaultEasing;
    }

    applyEffect();

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

  engine.onFrame = (progress) => {
    const pct = (progress * 100).toFixed(1);
    timelineProgress.style.width = pct + '%';
    timelineHandle.style.left = pct + '%';
    const cur = progress * engine.duration;
    timeDisplay.textContent = `${fmtTime(cur)} / ${fmtTime(engine.duration)}`;
  };

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${String(sec).padStart(2, '0')}.${ms}`;
  }

  // Timeline scrubbing
  let scrubbing = false;
  timelineTrack.addEventListener('mousedown', (e) => { scrubbing = true; scrubTo(e); });
  document.addEventListener('mousemove', (e) => { if (scrubbing) scrubTo(e); });
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
    if (!engine.playing && imageLoaded) engine.drawFrame(engine.currentTime);
  });

  // ===== Export =====
  let exportFormat = 'webm';

  btnExport.addEventListener('click', () => {
    exportModal.style.display = '';
    exportProgress.style.display = 'none';
  });

  btnCancelExport.addEventListener('click', () => { exportModal.style.display = 'none'; });
  exportModal.addEventListener('click', (e) => { if (e.target === exportModal) exportModal.style.display = 'none'; });

  document.querySelectorAll('[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-format]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      exportFormat = btn.dataset.format;
    });
  });

  btnStartExport.addEventListener('click', async () => {
    const fps = parseInt(document.getElementById('export-fps').value);
    exportProgress.style.display = '';
    btnStartExport.disabled = true;

    const wasPlaying = engine.playing;
    if (wasPlaying) engine.pause();

    if (exportFormat === 'frames') {
      await exportFrames(fps);
    } else {
      await exportVideo(fps);
    }

    btnStartExport.disabled = false;
    exportModal.style.display = 'none';
    if (wasPlaying) { engine.play(); setPlayingUI(true); }
  });

  async function exportVideo(fps) {
    const stream = canvas.captureStream(0); // 0 = manual frame push
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
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

        // Request frame capture
        if (stream.getVideoTracks()[0].requestFrame) {
          stream.getVideoTracks()[0].requestFrame();
        }

        progressFill.style.width = (progress * 100) + '%';
        progressText.textContent = `Rendering frame ${frame}/${totalFrames}...`;

        frame++;
        // Use a small timeout to give MediaRecorder time to capture
        setTimeout(renderNext, 1000 / fps);
      }

      renderNext();
    });
  }

  async function exportFrames(fps) {
    const totalFrames = Math.ceil(engine.duration * fps);

    for (let i = 0; i <= totalFrames; i++) {
      const progress = i / totalFrames;
      engine.drawFrame(progress);

      progressFill.style.width = (progress * 100) + '%';
      progressText.textContent = `Saving frame ${i}/${totalFrames}...`;

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      downloadBlob(blob, `frame-${String(i).padStart(4, '0')}.png`);
      await new Promise(r => setTimeout(r, 50));
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
      case 'Space': e.preventDefault(); btnPlay.click(); break;
      case 'Escape': engine.stop(); setPlayingUI(false); break;
      case 'KeyL': btnLoop.click(); break;
    }
  });

  // ===== Init =====
  renderPresets();
  engine.onFrame?.(0);
  durationLabel.textContent = engine.duration.toFixed(1) + 's';

  // Default the export format button
  document.querySelectorAll('[data-format]').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-format="webm"]').classList.add('active');

})();
