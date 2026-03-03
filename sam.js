/**
 * Shifter SAM Integration
 * Segment Anything Model via Roboflow API.
 * Supports: click-to-segment (SAM3 visual) and text-describe (SAM3 concept).
 */

const SAM = (() => {
  const API_BASE = 'https://serverless.roboflow.com';
  const DEFAULT_API_KEY = '9SUUG4R4vOxRxeZewweT';
  let apiKey = localStorage.getItem('shifter_roboflow_key') || DEFAULT_API_KEY;

  function setApiKey(key) {
    apiKey = key.trim();
    localStorage.setItem('shifter_roboflow_key', apiKey);
  }

  function getApiKey() {
    return apiKey;
  }

  function hasApiKey() {
    return apiKey.length > 0;
  }

  // Convert canvas to base64 (strip data:image/png;base64, prefix)
  function canvasToBase64(canvas) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return dataUrl.split(',')[1];
  }

  // Segment by clicking a point (sends image inline — no embed step needed)
  async function segmentByPoint(canvas, points) {
    if (!hasApiKey()) throw new Error('Roboflow API key required');

    const base64 = canvasToBase64(canvas);

    const prompts = points.map(pt => ({
      points: [{ x: pt.x, y: pt.y, positive: pt.positive !== false }]
    }));

    const resp = await fetch(`${API_BASE}/sam3/visual_segment?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: { type: 'base64', value: base64 },
        prompts: prompts,
        format: 'polygon'
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Segment failed (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    return parseSegmentResponse(data);
  }

  // Segment by text description (concept segmentation)
  async function segmentByText(canvas, textPrompt) {
    if (!hasApiKey()) throw new Error('Roboflow API key required');

    const base64 = canvasToBase64(canvas);

    const resp = await fetch(`${API_BASE}/sam3/concept_segment?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: { type: 'base64', value: base64 },
        prompts: [{ type: 'text', text: textPrompt }],
        format: 'polygon',
        output_prob_thresh: 0.4
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Concept segment failed (${resp.status}): ${err}`);
    }

    const data = await resp.json();
    return parseSegmentResponse(data);
  }

  // Parse API response into polygon masks
  // Roboflow SAM3 response shape:
  //   { prompt_results: [{ predictions: [{ masks: [[[x,y], ...]], confidence, format }] }] }
  function parseSegmentResponse(data) {
    const masks = [];

    const promptResults = data.prompt_results || [];

    for (const pr of promptResults) {
      const preds = pr.predictions || [];
      for (const pred of preds) {
        // SAM3 returns masks as an array of polygons, each polygon is [[x,y], ...]
        if (pred.masks && Array.isArray(pred.masks)) {
          for (const polygon of pred.masks) {
            if (!Array.isArray(polygon) || polygon.length < 3) continue;
            masks.push({
              points: polygon.map(p => ({ x: p[0], y: p[1] })),
              confidence: pred.confidence || 1,
              class: pred.class || 'object'
            });
          }
        }
      }
    }

    return masks;
  }

  // Render polygon masks to a canvas (creates a binary mask texture)
  function renderMaskToCanvas(masks, width, height) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const ctx = maskCanvas.getContext('2d');

    // Black = unmasked, White = masked
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    for (const mask of masks) {
      if (!mask.points || mask.points.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(mask.points[0].x, mask.points[0].y);
      for (let i = 1; i < mask.points.length; i++) {
        ctx.lineTo(mask.points[i].x, mask.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    return maskCanvas;
  }

  // Create a smooth/feathered mask by blurring the hard mask
  function featherMask(maskCanvas, featherAmount = 8) {
    const feathered = document.createElement('canvas');
    feathered.width = maskCanvas.width;
    feathered.height = maskCanvas.height;
    const ctx = feathered.getContext('2d');

    ctx.filter = `blur(${featherAmount}px)`;
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.filter = 'none';

    return feathered;
  }

  // Invert a mask canvas
  function invertMask(maskCanvas) {
    const inverted = document.createElement('canvas');
    inverted.width = maskCanvas.width;
    inverted.height = maskCanvas.height;
    const ctx = inverted.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, inverted.width, inverted.height);

    ctx.globalCompositeOperation = 'difference';
    ctx.drawImage(maskCanvas, 0, 0);

    return inverted;
  }

  // Render mask overlay for visualization (colored semi-transparent)
  function renderOverlay(masks, width, height, color = 'rgba(99, 102, 241, 0.35)') {
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    const ctx = overlayCanvas.getContext('2d');

    ctx.fillStyle = color;
    for (const mask of masks) {
      if (!mask.points || mask.points.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(mask.points[0].x, mask.points[0].y);
      for (let i = 1; i < mask.points.length; i++) {
        ctx.lineTo(mask.points[i].x, mask.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Draw border
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.lineWidth = 2;
    for (const mask of masks) {
      if (!mask.points || mask.points.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(mask.points[0].x, mask.points[0].y);
      for (let i = 1; i < mask.points.length; i++) {
        ctx.lineTo(mask.points[i].x, mask.points[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    return overlayCanvas;
  }

  return {
    setApiKey,
    getApiKey,
    hasApiKey,
    segmentByPoint,
    segmentByText,
    renderMaskToCanvas,
    featherMask,
    invertMask,
    renderOverlay
  };
})();
