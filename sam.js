/**
 * Shifter SAM Integration
 * Segment Anything Model via Roboflow API.
 * Supports: click-to-segment (SAM3 visual) and text-describe (SAM3 concept).
 */

const SAM = (() => {
  const API_BASE = 'https://serverless.roboflow.com';
  let apiKey = localStorage.getItem('shifter_roboflow_key') || '';
  let cachedImageId = null;
  let cachedImageData = null;

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

  // Step 1: Embed image for point-based segmentation
  async function embedImage(canvas) {
    if (!hasApiKey()) throw new Error('Roboflow API key required');

    const base64 = canvasToBase64(canvas);
    const imageId = 'shifter_' + Date.now();

    const resp = await fetch(`${API_BASE}/sam3/embed_image?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: { type: 'base64', value: base64 },
        image_id: imageId
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Embed failed (${resp.status}): ${err}`);
    }

    cachedImageId = imageId;
    cachedImageData = base64;
    return imageId;
  }

  // Step 2: Segment by clicking a point
  async function segmentByPoint(canvas, points, imageId) {
    if (!hasApiKey()) throw new Error('Roboflow API key required');

    const id = imageId || cachedImageId;

    // If no cached embedding, embed first
    if (!id) {
      await embedImage(canvas);
    }

    const prompts = points.map(pt => ({
      points: [{ x: pt.x, y: pt.y, positive: pt.positive !== false }]
    }));

    const resp = await fetch(`${API_BASE}/sam3/visual_segment?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_id: cachedImageId,
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
  function parseSegmentResponse(data) {
    const masks = [];

    // Handle different response structures
    const results = data.prompt_results || data.results || data.predictions || [];

    // If it's an array of prompt results
    const promptResults = Array.isArray(results) ? results : [results];

    for (const promptResult of promptResults) {
      const predictions = promptResult.predictions || promptResult.masks || promptResult || [];
      const preds = Array.isArray(predictions) ? predictions : [predictions];

      for (const pred of preds) {
        if (pred.points) {
          masks.push({
            points: pred.points.map(p => ({ x: p.x, y: p.y })),
            confidence: pred.confidence || 1,
            class: pred.class || 'object'
          });
        } else if (pred.polygon) {
          masks.push({
            points: pred.polygon.map(p => ({ x: p.x || p[0], y: p.y || p[1] })),
            confidence: pred.confidence || 1,
            class: pred.class || 'object'
          });
        } else if (pred.segmentation) {
          // RLE or other format
          masks.push({
            raw: pred.segmentation,
            confidence: pred.confidence || 1,
            class: pred.class || 'object'
          });
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

  function clearCache() {
    cachedImageId = null;
    cachedImageData = null;
  }

  return {
    setApiKey,
    getApiKey,
    hasApiKey,
    embedImage,
    segmentByPoint,
    segmentByText,
    renderMaskToCanvas,
    featherMask,
    invertMask,
    renderOverlay,
    clearCache
  };
})();
