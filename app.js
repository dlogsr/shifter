/**
 * Shifter App Controller
 * Wires UI to ShaderEngine + SAM segmentation: image upload, presets,
 * prompt, playback, export, click-to-segment, text-describe, mask controls.
 */

(function () {
  'use strict';

  // ===== DOM =====
  const canvas = document.getElementById('canvas');
  const overlayCanvas = document.getElementById('overlay-canvas');
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
  const speedSlider = document.getElementById('speed');
  const speedLabel = document.getElementById('speed-label');
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

  // Demo & Replace DOM
  const btnTryDemo = document.getElementById('btn-try-demo');
  const btnReplaceImage = document.getElementById('btn-replace-image');

  // Save Preset DOM
  const savePresetSection = document.getElementById('save-preset-section');
  const btnSavePreset = document.getElementById('btn-save-preset');
  const savePresetModal = document.getElementById('save-preset-modal');
  const savePresetName = document.getElementById('save-preset-name');
  const savePresetDesc = document.getElementById('save-preset-desc');
  const savePresetEmoji = document.getElementById('save-preset-emoji');
  const btnCancelSave = document.getElementById('btn-cancel-save');
  const btnConfirmSave = document.getElementById('btn-confirm-save');

  // SAM DOM
  const apiKeyInput = document.getElementById('api-key-input');
  const btnSaveKey = document.getElementById('btn-save-key');
  const apiKeyStatus = document.getElementById('api-key-status');
  const btnQuickMode = document.getElementById('btn-quick-mode');
  const btnBrushMode = document.getElementById('btn-brush-mode');
  const btnClickMode = document.getElementById('btn-click-mode');
  const btnTextMode = document.getElementById('btn-text-mode');
  const quickSelectSection = document.getElementById('quick-select-section');
  const quickSelectInfo = document.getElementById('quick-select-info');
  const quickSelectActions = document.getElementById('quick-select-actions');
  const btnQuickApply = document.getElementById('btn-quick-apply');
  const btnQuickReset = document.getElementById('btn-quick-reset');
  const brushSelectSection = document.getElementById('brush-select-section');
  const brushSizeSlider = document.getElementById('brush-size');
  const brushSizeLabel = document.getElementById('brush-size-label');
  const textSegmentSection = document.getElementById('text-segment-section');
  const textSegmentInput = document.getElementById('text-segment-input');
  const btnTextSegment = document.getElementById('btn-text-segment');
  const clickPointsSection = document.getElementById('click-points-section');
  const clickPointsList = document.getElementById('click-points-list');
  const btnSegmentRun = document.getElementById('btn-segment-run');
  const btnClearPoints = document.getElementById('btn-clear-points');
  const maskControls = document.getElementById('mask-controls');
  const maskInfo = document.getElementById('mask-info');
  const maskInvert = document.getElementById('mask-invert');
  const maskFeather = document.getElementById('mask-feather');
  const btnClearMask = document.getElementById('btn-clear-mask');
  const btnAddMask = document.getElementById('btn-add-mask');
  const segmentStatus = document.getElementById('segment-status');
  const maskTargetInfo = document.getElementById('mask-target-info');
  const maskBadge = document.getElementById('mask-badge');
  const maskBadgeText = document.getElementById('mask-badge-text');

  // ===== Engine =====
  const engine = new ShaderEngine(canvas);

  let currentPresetId = null;
  let currentEffect = null;
  let imageLoaded = false;
  let sourceImage = null; // original <img> for SAM

  // Custom presets (localStorage)
  let customPresets = JSON.parse(localStorage.getItem('shifter_custom_presets') || '[]');

  // Segmentation state
  let segMode = null; // 'quick' | 'brush' | 'click' | 'text' | null
  let clickPoints = [];
  let currentMasks = null;
  let currentMaskCanvas = null;

  // ===== Panel Tabs =====
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

      // Exit seg mode if switching away
      if (tab.dataset.tab !== 'segment') exitSegMode();
    });
  });

  // ===== Presets =====
  function renderPresets() {
    presetList.innerHTML = '';

    // Custom (saved) presets first
    if (customPresets.length > 0) {
      const hdr = document.createElement('div');
      hdr.className = 'preset-section-header';
      hdr.textContent = 'Saved';
      presetList.appendChild(hdr);

      customPresets.forEach(preset => {
        presetList.appendChild(createPresetItem(preset, true));
      });

      const hdr2 = document.createElement('div');
      hdr2.className = 'preset-section-header';
      hdr2.textContent = 'Built-in';
      presetList.appendChild(hdr2);
    }

    // Built-in presets
    PRESETS.forEach(preset => {
      presetList.appendChild(createPresetItem(preset, false));
    });
  }

  function createPresetItem(preset, isCustom) {
    const el = document.createElement('div');
    el.className = 'preset-item';
    el.dataset.id = preset.id;
    el.innerHTML = `
      <div class="preset-icon">${preset.icon}</div>
      <div class="preset-info">
        <div class="preset-name">${preset.name}</div>
        <div class="preset-desc">${preset.description}</div>
      </div>
      ${isCustom ? '<button class="btn-delete-preset" title="Delete">&times;</button>' : ''}
    `;
    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-preset')) return;
      selectPreset(preset);
    });
    if (isCustom) {
      el.querySelector('.btn-delete-preset').addEventListener('click', (e) => {
        e.stopPropagation();
        customPresets = customPresets.filter(p => p.id !== preset.id);
        localStorage.setItem('shifter_custom_presets', JSON.stringify(customPresets));
        renderPresets();
      });
    }
    return el;
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
    updateMaskBadge();

    // Show save preset button whenever we have an active effect
    savePresetSection.style.display = '';

    if (imageLoaded) {
      btnPlay.disabled = false;
      btnStop.disabled = false;
      btnExport.disabled = false;
      easingSection.style.display = '';
      maskTargetInfo.style.display = '';
    }
  }

  // ===== Effect Stack =====
  const LAYER_COLORS = {
    displace: '#6366f1', noiseWarp: '#8b5cf6', wave: '#06b6d4',
    ripple: '#3b82f6', chromatic: '#ec4899', rgbSplit: '#f43f5e',
    glitch: '#ef4444', pixelate: '#f59e0b', pixelStretch: '#f97316',
    zoom: '#10b981', rotate: '#a78bfa', blur: '#64748b',
    brightness: '#fbbf24', contrast: '#f97316', saturation: '#10b981',
    hueShift: '#a78bfa', vignette: '#334155', liquify: '#8b5cf6',
    smear: '#ec4899', fracture: '#ef4444', glow: '#fbbf24', edgeDetect: '#06b6d4'
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
      el.innerHTML = `
        <div class="effect-dot" style="background:${color}"></div>
        <span class="effect-layer-name">${layer.type}</span>
        <span class="effect-layer-value">${getLayerSummary(layer)}</span>
      `;
      effectStack.appendChild(el);
    });
  }

  function getLayerSummary(layer) {
    const parts = [];
    for (const [key, val] of Object.entries(layer.params || {})) {
      if (typeof val === 'number') parts.push(`${key}: ${fmtNum(val)}`);
      else if (val && typeof val === 'object') {
        if (val.wave) parts.push(`${key}: ${val.wave}`);
        else if ('from' in val) parts.push(`${key}: ${fmtNum(val.from)}->${fmtNum(val.to)}`);
      }
    }
    return parts.join(', ') || '—';
  }

  function fmtNum(n) {
    if (Math.abs(n) >= 10) return n.toFixed(0);
    if (Math.abs(n) >= 1) return n.toFixed(1);
    return n.toFixed(3);
  }

  // ===== Parameters =====
  function updateParams() {
    if (!currentEffect || !currentEffect.layers.length) {
      paramsSection.style.display = 'none';
      return;
    }
    paramsSection.style.display = '';
    paramsControls.innerHTML = '';

    currentEffect.layers.forEach(layer => {
      for (const [key, val] of Object.entries(layer.params || {})) {
        if (typeof val === 'number') {
          const absMax = Math.max(Math.abs(val) * 3, 1);
          addSlider(layer, key, val, -absMax, absMax, v => { layer.params[key] = v; liveUpdate(); });
        } else if (val && typeof val === 'object') {
          if ('amp' in val) {
            const m = Math.max(Math.abs(val.amp) * 3, 0.5);
            addSlider(layer, `${key} amp`, val.amp, 0, m, v => { val.amp = v; liveUpdate(); });
          }
          if ('freq' in val) {
            const m = Math.max(val.freq * 3, 2);
            addSlider(layer, `${key} freq`, val.freq, 0.1, m, v => { val.freq = v; liveUpdate(); });
          }
          if ('from' in val && 'to' in val) {
            const range = val.to - val.from;
            const m = Math.max(Math.abs(range) * 2, 1);
            addSlider(layer, `${key} range`, range, -m, m, v => { val.to = val.from + v; liveUpdate(); });
          }
        }
      }
    });
  }

  function addSlider(layer, label, value, min, max, onChange) {
    const row = document.createElement('div');
    row.className = 'param-row';
    const step = (max - min) > 10 ? 0.5 : 0.001;
    row.innerHTML = `
      <div class="param-label"><span>${layer.type} · ${label}</span><span class="param-value">${fmtNum(value)}</span></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}">
    `;
    const input = row.querySelector('input');
    const disp = row.querySelector('.param-value');
    input.addEventListener('input', () => { const v = parseFloat(input.value); disp.textContent = fmtNum(v); onChange(v); });
    paramsControls.appendChild(row);
  }

  function liveUpdate() {
    engine.setEffect(currentEffect);
    updateEffectStack();
    if (!engine.playing) engine.drawFrame(engine.currentTime);
  }

  // ===== Image Upload =====
  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => loadImage(img);
    img.src = URL.createObjectURL(file);
  }

  function loadImage(img) {
    imageLoaded = true;
    sourceImage = img;
    uploadOverlay.style.display = 'none';
    btnReplaceImage.style.display = '';
    engine.setImage(img);

    overlayCanvas.width = engine.imgWidth || canvas.width;
    overlayCanvas.height = engine.imgHeight || canvas.height;

    updateSamButtons();
    clearMask();

    if (currentEffect) {
      btnPlay.disabled = false;
      btnStop.disabled = false;
      btnExport.disabled = false;
      easingSection.style.display = '';
      maskTargetInfo.style.display = '';
      savePresetSection.style.display = '';
    }
  }

  // Replace / Remove image
  btnReplaceImage.addEventListener('click', () => {
    engine.pause();
    setPlayingUI(false);
    imageLoaded = false;
    sourceImage = null;
    clearMask();
    exitSegMode();
    uploadOverlay.style.display = '';
    btnReplaceImage.style.display = 'none';
    btnPlay.disabled = true;
    btnStop.disabled = true;
    btnExport.disabled = true;
    updateSamButtons();
    fileInput.click();
  });

  // Demo image
  btnTryDemo.addEventListener('click', (e) => {
    e.stopPropagation();
    loadDemoImage();
  });

  async function loadDemoImage() {
    // Try to load demo.jpg from project directory first
    try {
      const resp = await fetch('demo.jpg');
      if (resp.ok) {
        const blob = await resp.blob();
        const img = new Image();
        img.onload = () => loadImage(img);
        img.src = URL.createObjectURL(blob);
        return;
      }
    } catch (e) { /* fall through to procedural */ }

    // Generate procedural demo image
    const c = generateDemoImage();
    const img = new Image();
    img.onload = () => loadImage(img);
    img.src = c.toDataURL('image/jpeg', 0.92);
  }

  function generateDemoImage() {
    const w = 1280, h = 720;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Night sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#050510');
    sky.addColorStop(0.3, '#0a0a2e');
    sky.addColorStop(0.55, '#151538');
    sky.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`;
      ctx.fillRect(Math.random() * w, Math.random() * h * 0.4, Math.random() * 2, Math.random() * 2);
    }

    // City buildings
    const neonColors = ['#ff006e', '#00f5ff', '#ff00ff', '#00ff88', '#ffaa00', '#ff4444', '#4488ff'];
    for (let i = 0; i < 28; i++) {
      const bx = (i / 28) * w - 15 + Math.random() * 50;
      const bw = 30 + Math.random() * 80;
      const bh = 60 + Math.random() * 420;
      const by = h * 0.72 - bh;
      ctx.fillStyle = `hsl(${225 + Math.random() * 25}, 28%, ${8 + Math.random() * 10}%)`;
      ctx.fillRect(bx, by, bw, bh + h * 0.28);

      // Windows
      for (let wy = by + 6; wy < h * 0.72 - 6; wy += 16) {
        for (let wx = bx + 4; wx < bx + bw - 4; wx += 11) {
          if (Math.random() > 0.3) {
            const wh = Math.random() > 0.8 ? 30 : 45;
            ctx.fillStyle = `hsla(${wh}, 80%, 65%, ${0.15 + Math.random() * 0.7})`;
            ctx.fillRect(wx, wy, 6, 9);
          }
        }
      }
    }

    // Neon signs
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const color = neonColors[Math.floor(Math.random() * neonColors.length)];
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 + Math.random() * 20;
      ctx.globalAlpha = 0.4 + Math.random() * 0.5;
      ctx.fillRect(40 + Math.random() * (w - 80), h * 0.2 + Math.random() * h * 0.4, 30 + Math.random() * 110, 6 + Math.random() * 18);
    }
    ctx.restore();

    // Ground / wet street
    ctx.fillStyle = '#0e0e1c';
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    for (let i = 0; i < 25; i++) {
      const color = neonColors[Math.floor(Math.random() * neonColors.length)];
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.05 + Math.random() * 0.1;
      ctx.fillRect(Math.random() * w, h * 0.74 + Math.random() * h * 0.22, 100 + Math.random() * 300, 1 + Math.random() * 2);
    }
    ctx.globalAlpha = 1;

    // Center subject (car silhouette)
    ctx.fillStyle = '#181828';
    const carX = w * 0.35, carY = h * 0.68, carW = w * 0.3, carH = h * 0.08;
    ctx.beginPath();
    ctx.moveTo(carX, carY + carH);
    ctx.lineTo(carX + carW, carY + carH);
    ctx.lineTo(carX + carW - 10, carY + carH * 0.3);
    ctx.lineTo(carX + carW * 0.7, carY);
    ctx.lineTo(carX + carW * 0.3, carY);
    ctx.lineTo(carX + 10, carY + carH * 0.3);
    ctx.closePath();
    ctx.fill();

    // Car highlights
    ctx.strokeStyle = neonColors[0];
    ctx.shadowColor = neonColors[0];
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(carX + carW - 8, carY + carH * 0.5);
    ctx.lineTo(carX + carW + 5, carY + carH * 0.5);
    ctx.stroke();
    ctx.strokeStyle = neonColors[1];
    ctx.shadowColor = neonColors[1];
    ctx.beginPath();
    ctx.moveTo(carX + 8, carY + carH * 0.5);
    ctx.lineTo(carX - 5, carY + carH * 0.5);
    ctx.stroke();
    ctx.shadowBlur = 0;

    return c;
  }

  uploadOverlay.addEventListener('click', (e) => { if (e.target === uploadOverlay || e.target.closest('.upload-content') && !e.target.closest('.btn-demo')) fileInput.click(); });
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  ['dragover', 'dragenter'].forEach(evt => {
    uploadOverlay.addEventListener(evt, e => { e.preventDefault(); uploadOverlay.classList.add('drag-over'); });
    canvasWrapper.addEventListener(evt, e => e.preventDefault());
  });
  uploadOverlay.addEventListener('dragleave', () => uploadOverlay.classList.remove('drag-over'));
  uploadOverlay.addEventListener('drop', e => { e.preventDefault(); uploadOverlay.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  canvasWrapper.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

  // ===== Prompt =====
  btnGenerate.addEventListener('click', generateFromPrompt);
  promptInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateFromPrompt(); } });

  function generateFromPrompt() {
    const text = promptInput.value.trim();
    if (!text) return;
    const effect = PromptParser.parse(text);
    currentPresetId = null;
    currentEffect = effect;
    document.querySelectorAll('.preset-item').forEach(el => el.classList.remove('active'));
    if (effect.defaultEasing) { easingSelect.value = effect.defaultEasing; engine.easing = effect.defaultEasing; }
    applyEffect();
    if (imageLoaded && !engine.playing) { engine.play(); setPlayingUI(true); }
  }

  // ===== Playback =====
  btnPlay.addEventListener('click', () => {
    if (engine.playing) { engine.pause(); setPlayingUI(false); }
    else { engine.play(); setPlayingUI(true); }
  });
  btnStop.addEventListener('click', () => { engine.stop(); setPlayingUI(false); });
  btnLoop.addEventListener('click', () => { engine.looping = !engine.looping; btnLoop.classList.toggle('active', engine.looping); });

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

  let scrubbing = false;
  timelineTrack.addEventListener('mousedown', e => { scrubbing = true; scrubTo(e); });
  document.addEventListener('mousemove', e => { if (scrubbing) scrubTo(e); });
  document.addEventListener('mouseup', () => { scrubbing = false; });
  function scrubTo(e) {
    const rect = timelineTrack.getBoundingClientRect();
    engine.seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  }

  function onSpeedChange() {
    const val = parseFloat(speedSlider.value);
    engine.speed = val;
    speedLabel.textContent = val.toFixed(1) + 'x';
  }
  speedSlider.addEventListener('input', onSpeedChange);
  speedSlider.addEventListener('change', onSpeedChange);

  durationSlider.addEventListener('input', () => {
    const val = parseFloat(durationSlider.value);
    engine.duration = val;
    durationLabel.textContent = val.toFixed(1) + 's';
  });

  easingSelect.addEventListener('change', () => {
    engine.easing = easingSelect.value;
    if (!engine.playing && imageLoaded) engine.drawFrame(engine.currentTime);
  });

  // ========================================
  // ===== SAM SEGMENTATION =====
  // ========================================

  // API Key
  if (SAM.hasApiKey()) {
    apiKeyInput.value = SAM.getApiKey();
    apiKeyStatus.textContent = 'Key saved';
    apiKeyStatus.className = 'hint success';
  }

  btnSaveKey.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) { apiKeyStatus.textContent = 'Please enter a key'; apiKeyStatus.className = 'hint error'; return; }
    SAM.setApiKey(key);
    apiKeyStatus.textContent = 'Key saved';
    apiKeyStatus.className = 'hint success';
    updateSamButtons();
  });

  function updateSamButtons() {
    const ready = SAM.hasApiKey() && imageLoaded;
    btnQuickMode.disabled = !ready;
    btnBrushMode.disabled = !ready;
    btnClickMode.disabled = !ready;
    btnTextMode.disabled = !ready;
  }

  // Mode switching
  btnQuickMode.addEventListener('click', () => {
    if (segMode === 'quick') { exitSegMode(); return; }
    enterQuickMode();
  });

  btnBrushMode.addEventListener('click', () => {
    if (segMode === 'brush') { exitSegMode(); return; }
    enterBrushMode();
  });

  btnClickMode.addEventListener('click', () => {
    if (segMode === 'click') { exitSegMode(); return; }
    enterClickMode();
  });

  btnTextMode.addEventListener('click', () => {
    if (segMode === 'text') { exitSegMode(); return; }
    enterTextMode();
  });

  function enterQuickMode() {
    exitSegMode();
    segMode = 'quick';
    btnQuickMode.classList.add('active');
    quickSelectSection.style.display = '';
    overlayCanvas.classList.add('interactive');
    quickMasks = [];
    quickMaskCanvas = null;

    if (engine.playing) { engine.pause(); setPlayingUI(false); }
    engine.drawFrame(engine.currentTime);
  }

  function enterBrushMode() {
    exitSegMode();
    segMode = 'brush';
    btnBrushMode.classList.add('active');
    brushSelectSection.style.display = '';
    overlayCanvas.classList.add('interactive', 'brush-cursor');

    if (engine.playing) { engine.pause(); setPlayingUI(false); }
    engine.drawFrame(engine.currentTime);
    updateBrushCursor();
  }

  function enterClickMode() {
    exitSegMode();
    segMode = 'click';
    btnClickMode.classList.add('active');
    clickPointsSection.style.display = '';
    overlayCanvas.classList.add('interactive');

    // Pause playback during selection
    if (engine.playing) { engine.pause(); setPlayingUI(false); }
    engine.drawFrame(engine.currentTime);
  }

  function enterTextMode() {
    exitSegMode();
    segMode = 'text';
    btnTextMode.classList.add('active');
    textSegmentSection.style.display = '';
    textSegmentInput.focus();
  }

  function exitSegMode() {
    segMode = null;
    btnQuickMode.classList.remove('active');
    btnBrushMode.classList.remove('active');
    btnClickMode.classList.remove('active');
    btnTextMode.classList.remove('active');
    quickSelectSection.style.display = 'none';
    quickSelectInfo.style.display = 'none';
    quickSelectActions.style.display = 'none';
    brushSelectSection.style.display = 'none';
    clickPointsSection.style.display = 'none';
    textSegmentSection.style.display = 'none';
    overlayCanvas.classList.remove('interactive', 'brush-cursor');
    clearOverlay();
  }

  // ===== Quick Select (Photoshop-style) =====
  let quickMasks = [];       // accumulated mask polygons
  let quickMaskCanvas = null; // rendered cumulative mask canvas
  let quickSegBusy = false;

  overlayCanvas.addEventListener('mousedown', (e) => {
    if (segMode !== 'quick') return;
    if (e.button === 0) {
      e.preventDefault();
      runQuickSelect(e, true);
    } else if (e.button === 2) {
      e.preventDefault();
      runQuickSelect(e, false);
    }
  });

  overlayCanvas.addEventListener('contextmenu', (e) => {
    if (segMode === 'quick') e.preventDefault();
  });

  async function runQuickSelect(e, positive) {
    if (quickSegBusy) return;
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    quickSegBusy = true;
    showSegStatus('loading', positive ? 'Selecting...' : 'Subtracting...');

    try {
      const cleanCanvas = getCleanCanvas();
      const masks = await SAM.segmentByPoint(cleanCanvas, [{ x, y, positive: true }]);
      if (masks.length === 0) {
        showSegStatus('error', 'No object found at that point.');
        quickSegBusy = false;
        return;
      }

      if (positive) {
        // Add new masks to the cumulative selection
        quickMasks = quickMasks.concat(masks);
      } else {
        // Subtract: render new masks, then erase from cumulative canvas
        subtractFromQuickMask(masks);
      }

      renderQuickMaskOverlay();
      showSegStatus('success', `${quickMasks.length} region(s) selected`);
    } catch (err) {
      showSegStatus('error', err.message);
    }
    quickSegBusy = false;
  }

  function subtractFromQuickMask(subtractMasks) {
    const w = engine.imgWidth || canvas.width;
    const h = engine.imgHeight || canvas.height;

    // Build the current cumulative mask
    if (!quickMaskCanvas) {
      quickMaskCanvas = SAM.renderMaskToCanvas(quickMasks, w, h);
    }

    // Erase the subtract regions using destination-out compositing
    const ctx = quickMaskCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#fff';
    for (const mask of subtractMasks) {
      if (!mask.points || mask.points.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(mask.points[0].x, mask.points[0].y);
      for (let i = 1; i < mask.points.length; i++) {
        ctx.lineTo(mask.points[i].x, mask.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Clear polygon-based masks since we're now canvas-based
    quickMasks = [{ _canvasBased: true }];
  }

  function renderQuickMaskOverlay() {
    const w = engine.imgWidth || canvas.width;
    const h = engine.imgHeight || canvas.height;
    const ctx = overlayCanvas.getContext('2d');
    clearOverlay();

    // Build cumulative mask canvas from polygons (unless canvas-based from subtract)
    if (quickMasks.length > 0 && !quickMasks[0]._canvasBased) {
      quickMaskCanvas = SAM.renderMaskToCanvas(quickMasks, w, h);
    }

    if (!quickMaskCanvas) return;

    // Draw semi-transparent overlay
    ctx.globalAlpha = 0.35;
    // Tint: draw color, then mask it
    const tint = document.createElement('canvas');
    tint.width = w;
    tint.height = h;
    const tctx = tint.getContext('2d');
    tctx.fillStyle = 'rgba(99, 102, 241, 1)';
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(quickMaskCanvas, 0, 0);
    ctx.drawImage(tint, 0, 0);
    ctx.globalAlpha = 1;

    // Draw border by tracing the mask edge
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.lineWidth = 2;
    // Use the mask as a clip and stroke a full rect to get edge effect
    // Simpler: just draw the mask outline as a slightly dilated version
    ctx.globalAlpha = 0.6;
    ctx.globalCompositeOperation = 'source-over';
    const edge = document.createElement('canvas');
    edge.width = w;
    edge.height = h;
    const ectx = edge.getContext('2d');
    ectx.filter = 'blur(2px)';
    ectx.drawImage(quickMaskCanvas, 0, 0);
    ectx.filter = 'none';
    ectx.globalCompositeOperation = 'source-out';
    ectx.drawImage(quickMaskCanvas, 0, 0);
    ctx.drawImage(edge, 0, 0);
    ctx.globalAlpha = 1;

    // Show action buttons
    quickSelectInfo.textContent = `${quickMasks.length} region(s) selected`;
    quickSelectInfo.style.display = '';
    quickSelectActions.style.display = '';
  }

  btnQuickApply.addEventListener('click', () => {
    if (!quickMaskCanvas || quickMasks.length === 0) return;
    // Convert to the standard mask flow
    applyQuickMask();
  });

  btnQuickReset.addEventListener('click', () => {
    quickMasks = [];
    quickMaskCanvas = null;
    quickSelectInfo.style.display = 'none';
    quickSelectActions.style.display = 'none';
    clearOverlay();
  });

  function applyQuickMask() {
    const w = engine.imgWidth || canvas.width;
    const h = engine.imgHeight || canvas.height;

    let maskCanvas = quickMaskCanvas;
    if (maskFeather.checked) {
      maskCanvas = SAM.featherMask(maskCanvas, 6);
    }

    currentMasks = quickMasks;
    currentMaskCanvas = maskCanvas;

    engine.setMask(maskCanvas);
    engine.invertMask = maskInvert.checked;

    // Show mask overlay
    const ctx = overlayCanvas.getContext('2d');
    clearOverlay();
    renderQuickMaskOverlay();

    maskControls.style.display = '';
    maskInfo.textContent = `${quickMasks.length} region(s) selected`;
    updateMaskBadge();

    exitSegMode();
    quickMasks = [];
    quickMaskCanvas = null;
  }

  // ===== Brush Select =====
  let brushSize = 20;
  let painting = false;
  let strokePath = []; // raw pixel coords of the brush stroke
  let brushCursorPos = null; // current mouse position for brush cursor

  brushSizeSlider.addEventListener('input', () => {
    brushSize = parseInt(brushSizeSlider.value);
    brushSizeLabel.textContent = brushSize;
    updateBrushCursor();
  });

  function updateBrushCursor() {
    if (segMode !== 'brush') return;
    const rect = overlayCanvas.getBoundingClientRect();
    const displaySize = Math.max(4, brushSize / (overlayCanvas.width / rect.width));
    overlayCanvas.style.setProperty('--brush-size', displaySize + 'px');
  }

  function canvasCoord(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    };
  }

  overlayCanvas.addEventListener('mousedown', (e) => {
    if (segMode !== 'brush' || e.button !== 0) return;
    painting = true;
    strokePath = [];
    const pt = canvasCoord(e);
    strokePath.push(pt);
    drawBrushStroke();
  });

  overlayCanvas.addEventListener('mousemove', (e) => {
    if (segMode === 'brush') {
      brushCursorPos = canvasCoord(e);
      if (painting) {
        strokePath.push(brushCursorPos);
      }
      drawBrushStroke();
    }
  });

  overlayCanvas.addEventListener('mouseup', () => {
    if (!painting) return;
    painting = false;
    if (strokePath.length > 0) runBrushSegment();
  });

  overlayCanvas.addEventListener('mouseleave', () => {
    brushCursorPos = null;
    if (segMode === 'brush' && !painting) {
      drawBrushStroke(); // clear cursor
    }
    if (!painting) return;
    painting = false;
    if (strokePath.length > 0) runBrushSegment();
  });

  function drawBrushStroke() {
    const ctx = overlayCanvas.getContext('2d');
    clearOverlay();

    // Draw existing mask overlay if present
    if (currentMasks && currentMaskCanvas) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(currentMaskCanvas, 0, 0);
      ctx.globalAlpha = 1;
    }

    // Draw the brush stroke
    if (strokePath.length > 0) {
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx.beginPath();
      ctx.moveTo(strokePath[0].x, strokePath[0].y);
      for (let i = 1; i < strokePath.length; i++) {
        ctx.lineTo(strokePath[i].x, strokePath[i].y);
      }
      ctx.stroke();
    }

    // Draw brush cursor
    if (brushCursorPos) {
      ctx.beginPath();
      ctx.arc(brushCursorPos.x, brushCursorPos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function samplePointsFromStroke(path, spacing) {
    const points = [];
    if (path.length === 0) return points;
    points.push({ x: path[0].x, y: path[0].y, positive: true });
    let accumulated = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      accumulated += Math.sqrt(dx * dx + dy * dy);
      if (accumulated >= spacing) {
        points.push({ x: path[i].x, y: path[i].y, positive: true });
        accumulated = 0;
      }
    }
    const last = path[path.length - 1];
    if (points.length === 1 || (points[points.length - 1].x !== last.x || points[points.length - 1].y !== last.y)) {
      points.push({ x: last.x, y: last.y, positive: true });
    }
    return points;
  }

  async function runBrushSegment() {
    const spacing = Math.max(brushSize * 1.5, 20);
    const sampled = samplePointsFromStroke(strokePath, spacing);
    strokePath = [];

    if (sampled.length === 0) return;

    showSegStatus('loading', `Segmenting (${sampled.length} points)...`);
    try {
      const cleanCanvas = getCleanCanvas();
      const masks = await SAM.segmentByPoint(cleanCanvas, sampled);
      if (masks.length === 0) {
        showSegStatus('error', 'No objects found. Try painting over the object.');
        return;
      }
      applyMasks(masks);
      showSegStatus('success', `Found ${masks.length} region(s)`);
    } catch (err) {
      showSegStatus('error', err.message);
    }
  }

  // ===== Click-to-Segment =====
  overlayCanvas.addEventListener('click', (e) => {
    if (segMode !== 'click') return;
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    clickPoints.push({ x, y, positive: true });
    renderClickPoints();
  });

  overlayCanvas.addEventListener('contextmenu', (e) => {
    if (segMode !== 'click') return;
    e.preventDefault();
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    clickPoints.push({ x, y, positive: false });
    renderClickPoints();
  });

  function renderClickPoints() {
    const ctx = overlayCanvas.getContext('2d');
    clearOverlay();

    // Draw existing mask overlay if any
    if (currentMasks && currentMaskCanvas) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(currentMaskCanvas, 0, 0);
      ctx.globalAlpha = 1;
    }

    // Draw click points
    clickPoints.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = pt.positive ? 'rgba(52,211,153,0.9)' : 'rgba(248,113,113,0.9)';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crosshair
      ctx.beginPath();
      ctx.moveTo(pt.x - 10, pt.y); ctx.lineTo(pt.x + 10, pt.y);
      ctx.moveTo(pt.x, pt.y - 10); ctx.lineTo(pt.x, pt.y + 10);
      ctx.strokeStyle = pt.positive ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Update list
    clickPointsList.innerHTML = '';
    clickPoints.forEach((pt, i) => {
      const el = document.createElement('div');
      el.className = 'click-point';
      el.innerHTML = `<div class="dot ${pt.positive ? 'positive' : 'negative'}"></div><span>(${pt.x}, ${pt.y})</span>`;
      clickPointsList.appendChild(el);
    });

    btnSegmentRun.disabled = clickPoints.length === 0;
  }

  btnClearPoints.addEventListener('click', () => {
    clickPoints = [];
    renderClickPoints();
  });

  btnSegmentRun.addEventListener('click', async () => {
    if (clickPoints.length === 0) return;
    await runClickSegmentation();
  });

  async function runClickSegmentation() {
    showSegStatus('loading', 'Segmenting image...');
    try {
      // Need a clean canvas without effects for the API
      const cleanCanvas = getCleanCanvas();
      const masks = await SAM.segmentByPoint(cleanCanvas, clickPoints);
      if (masks.length === 0) {
        showSegStatus('error', 'No objects found. Try different points.');
        return;
      }
      applyMasks(masks);
      showSegStatus('success', `Found ${masks.length} region(s)`);
    } catch (err) {
      showSegStatus('error', err.message);
    }
  }

  // ===== Text-Describe Segment =====
  btnTextSegment.addEventListener('click', runTextSegmentation);
  textSegmentInput.addEventListener('keydown', e => { if (e.key === 'Enter') runTextSegmentation(); });

  async function runTextSegmentation() {
    const text = textSegmentInput.value.trim();
    if (!text) return;
    showSegStatus('loading', `Looking for "${text}"...`);
    try {
      const cleanCanvas = getCleanCanvas();
      const masks = await SAM.segmentByText(cleanCanvas, text);
      if (masks.length === 0) {
        showSegStatus('error', `Could not find "${text}". Try a different description.`);
        return;
      }
      applyMasks(masks);
      showSegStatus('success', `Found ${masks.length} region(s) for "${text}"`);
    } catch (err) {
      showSegStatus('error', err.message);
    }
  }

  // ===== Mask Application =====
  function applyMasks(masks) {
    currentMasks = masks;
    const w = engine.imgWidth || canvas.width;
    const h = engine.imgHeight || canvas.height;

    // Render polygon mask to canvas
    let maskCanvas = SAM.renderMaskToCanvas(masks, w, h);

    // Feather if checked
    if (maskFeather.checked) {
      maskCanvas = SAM.featherMask(maskCanvas, 6);
    }

    currentMaskCanvas = maskCanvas;

    // Upload to WebGL engine
    engine.setMask(maskCanvas);
    engine.invertMask = maskInvert.checked;

    // Show mask overlay on the overlay canvas
    drawMaskOverlay();

    // Show mask controls
    maskControls.style.display = '';
    maskInfo.textContent = `${masks.length} region(s) selected`;

    // Update badge
    updateMaskBadge();

    // Exit seg mode
    exitSegMode();
    clickPoints = [];
  }

  function drawMaskOverlay() {
    if (!currentMasks) return;
    const ctx = overlayCanvas.getContext('2d');
    clearOverlay();

    const w = overlayCanvas.width;
    const h = overlayCanvas.height;
    const overlay = SAM.renderOverlay(currentMasks, w, h);
    ctx.drawImage(overlay, 0, 0);
  }

  function clearMask() {
    currentMasks = null;
    currentMaskCanvas = null;
    engine.clearMask();
    maskControls.style.display = 'none';
    maskInvert.checked = false;
    clearOverlay();
    updateMaskBadge();
  }

  function clearOverlay() {
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  function getCleanCanvas() {
    // Render the source image to a temp canvas for clean API submission
    const c = document.createElement('canvas');
    const w = engine.imgWidth || canvas.width;
    const h = engine.imgHeight || canvas.height;
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(sourceImage, 0, 0, w, h);
    return c;
  }

  // Mask controls
  btnClearMask.addEventListener('click', clearMask);

  btnAddMask.addEventListener('click', () => {
    // Go back to click mode to add more regions
    enterClickMode();
  });

  maskInvert.addEventListener('change', () => {
    engine.invertMask = maskInvert.checked;
    if (engine.image) engine.drawFrame(engine.currentTime);
    updateMaskBadge();
  });

  maskFeather.addEventListener('change', () => {
    if (currentMasks) {
      const w = engine.imgWidth || canvas.width;
      const h = engine.imgHeight || canvas.height;
      let maskCanvas = SAM.renderMaskToCanvas(currentMasks, w, h);
      if (maskFeather.checked) maskCanvas = SAM.featherMask(maskCanvas, 6);
      currentMaskCanvas = maskCanvas;
      engine.setMask(maskCanvas);
    }
  });

  function updateMaskBadge() {
    if (!maskTargetInfo) return;
    if (engine.hasMask) {
      maskBadge.className = 'mask-badge' + (engine.invertMask ? ' inverted' : ' has-mask');
      maskBadgeText.textContent = engine.invertMask ? 'Background (inverted)' : 'Selected Region';
    } else {
      maskBadge.className = 'mask-badge';
      maskBadgeText.textContent = 'Full Image';
    }
  }

  function showSegStatus(type, msg) {
    segmentStatus.textContent = msg;
    segmentStatus.className = 'segment-status ' + type;
    if (type !== 'loading') {
      setTimeout(() => { segmentStatus.className = 'segment-status'; }, 5000);
    }
  }

  // ===== Export =====
  let exportFormat = 'webm';

  btnExport.addEventListener('click', () => { exportModal.style.display = ''; exportProgress.style.display = 'none'; });
  btnCancelExport.addEventListener('click', () => { exportModal.style.display = 'none'; });
  exportModal.addEventListener('click', e => { if (e.target === exportModal) exportModal.style.display = 'none'; });

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

    // Hide overlay during export
    const overlayVis = overlayCanvas.style.display;
    overlayCanvas.style.display = 'none';

    if (exportFormat === 'frames') await exportFrames(fps);
    else await exportVideo(fps);

    overlayCanvas.style.display = overlayVis;
    btnStartExport.disabled = false;
    exportModal.style.display = 'none';
    if (wasPlaying) { engine.play(); setPlayingUI(true); }
  });

  async function exportVideo(fps) {
    const stream = canvas.captureStream(0);
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    return new Promise(resolve => {
      recorder.onstop = () => {
        downloadBlob(new Blob(chunks, { type: 'video/webm' }), 'shifter-animation.webm');
        resolve();
      };
      recorder.start();
      const totalFrames = Math.ceil(engine.duration * fps);
      let frame = 0;
      function renderNext() {
        if (frame > totalFrames) { recorder.stop(); return; }
        engine.drawFrame(frame / totalFrames);
        if (stream.getVideoTracks()[0].requestFrame) stream.getVideoTracks()[0].requestFrame();
        progressFill.style.width = (frame / totalFrames * 100) + '%';
        progressText.textContent = `Rendering ${frame}/${totalFrames}...`;
        frame++;
        setTimeout(renderNext, 1000 / fps);
      }
      renderNext();
    });
  }

  async function exportFrames(fps) {
    const total = Math.ceil(engine.duration * fps);
    for (let i = 0; i <= total; i++) {
      engine.drawFrame(i / total);
      progressFill.style.width = (i / total * 100) + '%';
      progressText.textContent = `Frame ${i}/${total}...`;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      downloadBlob(blob, `frame-${String(i).padStart(4, '0')}.png`);
      await new Promise(r => setTimeout(r, 50));
    }
    progressText.textContent = `Done! ${total + 1} frames exported.`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ===== Keyboard =====
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    switch (e.code) {
      case 'Space': e.preventDefault(); btnPlay.click(); break;
      case 'Escape':
        if (segMode) exitSegMode();
        else { engine.stop(); setPlayingUI(false); }
        break;
      case 'KeyL': btnLoop.click(); break;
    }
  });

  // ===== Save Preset =====
  const EMOJI_MAP = {
    glitch: '⚡', noiseWarp: '🌊', liquify: '🌀', zoom: '🔍',
    ripple: '💧', chromatic: '🌈', rgbSplit: '🔴', blur: '💨',
    hueShift: '🎨', saturation: '🎨', glow: '✨', rotate: '🔄',
    wave: '〰️', displace: '💥', vignette: '🎬', brightness: '☀️',
    contrast: '🎭', smear: '🖌️', fracture: '🪟', pixelate: '👾',
    pixelStretch: '📊', edgeDetect: '🔲'
  };

  function autoPickEmoji(effect) {
    if (!effect || !effect.layers || !effect.layers.length) return '🎭';
    // Count layer types and pick emoji for the most prominent
    const counts = {};
    effect.layers.forEach(l => { counts[l.type] = (counts[l.type] || 0) + 1; });
    const primary = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return EMOJI_MAP[primary] || '🎭';
  }

  btnSavePreset.addEventListener('click', () => {
    if (!currentEffect) return;
    savePresetName.value = currentEffect.name || '';
    savePresetDesc.value = currentEffect.description || '';
    savePresetEmoji.textContent = autoPickEmoji(currentEffect);
    savePresetModal.style.display = '';
  });

  btnCancelSave.addEventListener('click', () => {
    savePresetModal.style.display = 'none';
  });

  savePresetModal.addEventListener('click', (e) => {
    if (e.target === savePresetModal) savePresetModal.style.display = 'none';
  });

  btnConfirmSave.addEventListener('click', () => {
    const name = savePresetName.value.trim() || 'Custom Effect';
    const desc = savePresetDesc.value.trim() || '';
    const emoji = savePresetEmoji.textContent;
    const id = 'custom-' + Date.now();

    const preset = {
      id,
      name,
      icon: emoji,
      description: desc,
      category: 'custom',
      layers: JSON.parse(JSON.stringify(currentEffect.layers))
    };

    if (currentEffect.defaultEasing) preset.defaultEasing = currentEffect.defaultEasing;

    customPresets.push(preset);
    localStorage.setItem('shifter_custom_presets', JSON.stringify(customPresets));
    renderPresets();
    savePresetModal.style.display = 'none';

    // Highlight the newly saved preset
    document.querySelectorAll('.preset-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
    currentPresetId = id;
  });

  // ===== Init =====
  renderPresets();
  engine.onFrame?.(0);
  speedLabel.textContent = engine.speed.toFixed(1) + 'x';
  durationLabel.textContent = engine.duration.toFixed(1) + 's';

})();
