(() => {
  'use strict';

  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');

  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('bggone-theme', next);
  });

  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const editor = document.getElementById('editor');
  const beforeImage = document.getElementById('beforeImage');
  const afterImage = document.getElementById('afterImage');
  const comparison = document.getElementById('comparison');
  const sliderHandle = document.getElementById('sliderHandle');
  const brushCursor = document.getElementById('brushCursor');
  
  const toleranceSlider = document.getElementById('tolerance');
  const toleranceInput = document.getElementById('toleranceInput');
  const featherSlider = document.getElementById('feather');
  const featherInput = document.getElementById('featherInput');
  const bgBlurSlider = document.getElementById('bgBlur');
  const bgBlurInput = document.getElementById('bgBlurInput');
  const blurSlider = document.getElementById('blur');
  const blurInput = document.getElementById('blurInput');
  
  const autoModeBtn = document.getElementById('autoMode');
  const pickModeBtn = document.getElementById('pickMode');
  const pickHint = document.getElementById('pickHint');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const imageInfo = document.getElementById('imageInfo');
  const chipDot = document.getElementById('chipDot');
  const bgLabel = document.getElementById('bgLabel');
  const bgChip = document.getElementById('bgChip');

  const tabs = document.querySelectorAll('.tab-btn');
  const tabIndicator = document.getElementById('tabIndicator');
  const bgPanel = document.getElementById('bgPanel');
  const blurPanel = document.getElementById('blurPanel');

  const eraserBtn = document.getElementById('eraserBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const clearBrushBtn = document.getElementById('clearBrushBtn');
  const brushSizeSlider = document.getElementById('brushSize');
  const brushSizeInput = document.getElementById('brushSizeInput');

  const blurAllBtn = document.getElementById('blurAllBtn');
  const blurBrushBtn = document.getElementById('blurBrushBtn');
  const blurBrushSizeSlider = document.getElementById('blurBrushSize');
  const blurBrushSizeInput = document.getElementById('blurBrushSizeInput');

  let originalImage = null;
  let originalFileName = 'image';
  let processedCanvas = document.createElement('canvas');
  let processedCtx = processedCanvas.getContext('2d', { willReadFrequently: true });
  let bgColor = { r: 255, g: 255, b: 255 };
  let pickMode = false;
  let isDragging = false;
  let currentTab = 'bg';
  let sliderPercent = 50;
  
  let brushMode = 'none'; // 'erase', 'restore', 'blur', 'none'
  let blurAll = true;
  let isBrushing = false;

  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');
  const blurMaskCanvas = document.createElement('canvas');
  const blurMaskCtx = blurMaskCanvas.getContext('2d');

  function updateTabIndicator(activeTab) {
    tabIndicator.style.left = activeTab.offsetLeft + 'px';
    tabIndicator.style.width = activeTab.offsetWidth + 'px';
  }

  function syncInput(slider, input) {
    input.value = slider.value;
    input.addEventListener('input', () => {
      let val = parseInt(input.value, 10);
      if (isNaN(val)) val = 0;
      val = Math.max(parseInt(slider.min, 10), Math.min(parseInt(slider.max, 10), val));
      slider.value = val;
      input.value = val;
      processImage();
    });
    slider.addEventListener('input', () => {
      input.value = slider.value;
    });
    slider.addEventListener('change', processImage);
  }

  syncInput(toleranceSlider, toleranceInput);
  syncInput(featherSlider, featherInput);
  syncInput(bgBlurSlider, bgBlurInput);
  syncInput(blurSlider, blurInput);
  syncInput(brushSizeSlider, brushSizeInput);
  syncInput(blurBrushSizeSlider, blurBrushSizeInput);

  function setBrushMode(mode) {
    brushMode = mode;
    if (mode !== 'none') {
      comparison.style.cursor = 'none';
    } else {
      comparison.style.cursor = pickMode ? 'crosshair' : 'ew-resize';
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updateTabIndicator(tab);
      
      currentTab = tab.dataset.tab;
      
      if (currentTab === 'bg') {
        bgPanel.classList.remove('hidden');
        blurPanel.classList.add('hidden');
        bgChip.style.display = 'inline-flex';
        eraserBtn.classList.remove('active');
        restoreBtn.classList.remove('active');
        setBrushMode('none');
      } else {
        bgPanel.classList.add('hidden');
        blurPanel.classList.remove('hidden');
        bgChip.style.display = 'none';
        blurAllBtn.classList.add('active');
        blurBrushBtn.classList.remove('active');
        blurAll = true;
        setBrushMode('none');
      }
      
      if (originalImage) processImage();
    });
  });

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadImage(file);
  });

  function loadImage(file) {
    originalFileName = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        originalImage = img;
        setupEditor(img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function setupEditor(img) {
    uploadZone.classList.add('hidden');
    editor.classList.remove('hidden');

    processedCanvas.width = img.naturalWidth;
    processedCanvas.height = img.naturalHeight;
    maskCanvas.width = img.naturalWidth;
    maskCanvas.height = img.naturalHeight;
    blurMaskCanvas.width = img.naturalWidth;
    blurMaskCanvas.height = img.naturalHeight;
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    blurMaskCtx.clearRect(0, 0, blurMaskCanvas.width, blurMaskCanvas.height);

    imageInfo.textContent = `${originalFileName} · ${img.naturalWidth}×${img.naturalHeight}`;
    beforeImage.src = img.src;

    fitComparison();

    if (currentTab === 'bg') {
      processedCtx.drawImage(img, 0, 0);
      bgColor = sampleBackgroundColor(processedCtx, processedCanvas.width, processedCanvas.height);
      updateColorChip();
    }

    processImage();
    setSliderPosition(sliderPercent);
    requestAnimationFrame(() => updateTabIndicator(document.querySelector('.tab-btn.active')));
  }

  function fitComparison() {
    const stage = document.querySelector('.preview-stage');
    const maxW = stage.clientWidth - 40; 
    const maxH = Math.min(window.innerHeight * 0.65, 600);

    const ratio = Math.min(
      maxW / processedCanvas.width,
      maxH / processedCanvas.height
    );

    const displayW = Math.max(1, Math.floor(processedCanvas.width * ratio));
    const displayH = Math.max(1, Math.floor(processedCanvas.height * ratio));

    comparison.style.width = displayW + 'px';
    comparison.style.height = displayH + 'px';
  }

  window.addEventListener('resize', () => {
    if (originalImage) fitComparison();
    updateTabIndicator(document.querySelector('.tab-btn.active'));
  });

  function sampleBackgroundColor(ctx, w, h) {
    const patchSize = Math.min(12, Math.floor(Math.min(w, h) / 4));
    const positions = [
      [0, 0],
      [w - patchSize, 0],
      [0, h - patchSize],
      [w - patchSize, h - patchSize]
    ];

    let r = 0, g = 0, b = 0, count = 0;
    for (const [x, y] of positions) {
      const data = ctx.getImageData(x, y, patchSize, patchSize).data;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
    }
    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count)
    };
  }

  function sampleColorAtPoint(x, y) {
    const patchSize = 5;
    const px = Math.max(0, Math.min(processedCanvas.width - patchSize, x - Math.floor(patchSize / 2)));
    const py = Math.max(0, Math.min(processedCanvas.height - patchSize, y - Math.floor(patchSize / 2)));
    
    processedCtx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
    processedCtx.drawImage(originalImage, 0, 0);
    const data = processedCtx.getImageData(px, py, patchSize, patchSize).data;
    
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count)
    };
  }

  function updateColorChip() {
    chipDot.style.background = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
    const hex = '#' + [bgColor.r, bgColor.g, bgColor.b]
      .map(c => c.toString(16).padStart(2, '0')).join('');
    bgLabel.textContent = hex.toUpperCase();
  }

  function applyBlur(sourceCanvas, blurAmount) {
    if (blurAmount === 0) return sourceCanvas;
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const padding = Math.ceil(blurAmount * 4);
    
    const temp1 = document.createElement('canvas');
    temp1.width = w + padding * 2; 
    temp1.height = h + padding * 2;
    const ctx1 = temp1.getContext('2d');
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        ctx1.drawImage(sourceCanvas, padding + dx * w, padding + dy * h, w, h);
      }
    }
    
    const temp2 = document.createElement('canvas');
    temp2.width = w; 
    temp2.height = h;
    const ctx2 = temp2.getContext('2d');
    
    const actualBlur = blurAmount * 0.4;
    ctx2.filter = `blur(${actualBlur}px)`;
    ctx2.drawImage(temp1, -padding, -padding);
    
    return temp2;
  }

  function processImage() {
    if (!originalImage) return;

    processedCtx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
    processedCtx.drawImage(originalImage, 0, 0);

    let blurAmount = 0;

    if (currentTab === 'bg') {
      const imageData = processedCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
      const data = imageData.data;
      const originalData = processedCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height).data;

      const tolerance = parseInt(toleranceSlider.value, 10);
      const feather = parseInt(featherSlider.value, 10);

      const tol2 = tolerance * tolerance * 3;
      const totalRange = tolerance + feather;
      const feather2 = totalRange * totalRange * 3;
      const featherSpan = Math.max(1, feather2 - tol2);

      const bgR = bgColor.r;
      const bgG = bgColor.g;
      const bgB = bgColor.b;

      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - bgR;
        const dg = data[i + 1] - bgG;
        const db = data[i + 2] - bgB;
        const dist2 = dr * dr + dg * dg + db * db;

        if (dist2 <= tol2) {
          data[i + 3] = 0;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        } else if (feather > 0 && dist2 <= feather2) {
          const t = (dist2 - tol2) / featherSpan;
          data[i + 3] = Math.round(255 * t);
        }
      }

      const maskData = maskCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (maskData[i+3] > 0) {
          if (maskData[i] === 0) { 
            data[i + 3] = 0;
          } else { 
            data[i] = originalData[i];
            data[i + 1] = originalData[i + 1];
            data[i + 2] = originalData[i + 2];
            data[i + 3] = 255;
          }
        }
      }

      processedCtx.putImageData(imageData, 0, 0);
      blurAmount = parseInt(bgBlurSlider.value, 10);
      
      if (blurAmount > 0) {
        const blurred = applyBlur(processedCanvas, blurAmount);
        processedCtx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
        processedCtx.drawImage(blurred, 0, 0);
      }
    } else {
      blurAmount = parseInt(blurSlider.value, 10);
      
      if (blurAmount > 0) {
        if (blurAll) {
          const blurred = applyBlur(processedCanvas, blurAmount);
          processedCtx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
          processedCtx.drawImage(blurred, 0, 0);
        } else {
          const blurred = applyBlur(processedCanvas, blurAmount);
          const tempBlur = document.createElement('canvas');
          tempBlur.width = processedCanvas.width; 
          tempBlur.height = processedCanvas.height;
          const tCtx = tempBlur.getContext('2d');
          tCtx.drawImage(blurred, 0, 0);
          tCtx.globalCompositeOperation = 'destination-in';
          tCtx.drawImage(blurMaskCanvas, 0, 0);
          
          processedCtx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
          processedCtx.drawImage(originalImage, 0, 0);
          processedCtx.drawImage(tempBlur, 0, 0);
        }
      }
    }

    afterImage.src = processedCanvas.toDataURL('image/png');
    downloadBtn.disabled = false;
  }

  autoModeBtn.addEventListener('click', () => {
    pickMode = false;
    autoModeBtn.classList.add('active');
    pickModeBtn.classList.remove('active');
    comparison.style.cursor = brushMode !== 'none' ? 'none' : 'ew-resize';
    pickHint.textContent = 'Sampling background color from image corners';
    
    processedCtx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
    processedCtx.drawImage(originalImage, 0, 0);
    bgColor = sampleBackgroundColor(processedCtx, processedCanvas.width, processedCanvas.height);
    updateColorChip();
    processImage();
  });

  pickModeBtn.addEventListener('click', () => {
    pickMode = true;
    pickModeBtn.classList.add('active');
    autoModeBtn.classList.remove('active');
    comparison.style.cursor = brushMode !== 'none' ? 'none' : 'crosshair';
    pickHint.textContent = 'Click on the background area in the image';
  });

  eraserBtn.addEventListener('click', () => {
    brushMode = brushMode === 'erase' ? 'none' : 'erase';
    eraserBtn.classList.toggle('active', brushMode === 'erase');
    restoreBtn.classList.remove('active');
    setBrushMode(brushMode);
  });

  restoreBtn.addEventListener('click', () => {
    brushMode = brushMode === 'restore' ? 'none' : 'restore';
    restoreBtn.classList.toggle('active', brushMode === 'restore');
    eraserBtn.classList.remove('active');
    setBrushMode(brushMode);
  });

  clearBrushBtn.addEventListener('click', () => {
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    blurMaskCtx.clearRect(0, 0, blurMaskCanvas.width, blurMaskCanvas.height);
    processImage();
  });

  blurAllBtn.addEventListener('click', () => {
    blurAll = true;
    blurAllBtn.classList.add('active');
    blurBrushBtn.classList.remove('active');
    setBrushMode('none');
    processImage();
  });

  blurBrushBtn.addEventListener('click', () => {
    blurAll = false;
    blurBrushBtn.classList.add('active');
    blurAllBtn.classList.remove('active');
    setBrushMode('blur');
    processImage();
  });

  function setSliderPosition(percent) {
    sliderPercent = Math.max(0, Math.min(100, percent));
    sliderHandle.style.left = `${sliderPercent}%`;
    beforeImage.style.clipPath = `inset(0 ${100 - sliderPercent}% 0 0)`;
  }

  function handleMove(clientX) {
    const rect = comparison.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(percent);
  }

  function startSliderDrag(e) {
    isDragging = true;
    e.preventDefault();
    e.stopPropagation();
  }

  sliderHandle.addEventListener('mousedown', startSliderDrag);
  sliderHandle.addEventListener('touchstart', startSliderDrag, { passive: false });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) handleMove(e.clientX);
    if (isBrushing) drawBrush(e);
    if (brushMode !== 'none' && originalImage) {
      const rect = comparison.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        brushCursor.style.left = (e.clientX - rect.left) + 'px';
        brushCursor.style.top = (e.clientY - rect.top) + 'px';
        const size = currentTab === 'bg' ? parseInt(brushSizeSlider.value, 10) : parseInt(blurBrushSizeSlider.value, 10);
        brushCursor.style.width = size + 'px';
        brushCursor.style.height = size + 'px';
        brushCursor.classList.remove('hidden');
      } else {
        brushCursor.classList.add('hidden');
      }
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (isDragging) {
      handleMove(e.touches[0].clientX);
      e.preventDefault();
    }
    if (isBrushing) {
      drawBrush(e.touches[0]);
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    isBrushing = false;
  });
  window.addEventListener('touchend', () => {
    isDragging = false;
    isBrushing = false;
  });

  function getCanvasCoords(e) {
    const rect = comparison.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
    const clientY = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
    const x = Math.round((clientX - rect.left) / rect.width * processedCanvas.width);
    const y = Math.round((clientY - rect.top) / rect.height * processedCanvas.height);
    return { x, y };
  }

  function drawBrush(e) {
    if (!isBrushing || brushMode === 'none') return;
    const { x, y } = getCanvasCoords(e);
    const ctx = currentTab === 'bg' ? maskCtx : blurMaskCtx;
    
    if (currentTab === 'bg') {
      ctx.fillStyle = brushMode === 'erase' ? 'black' : 'white';
    } else {
      ctx.fillStyle = 'white';
    }
    
    const rect = comparison.getBoundingClientRect();
    const scale = processedCanvas.width / rect.width;
    const size = currentTab === 'bg' ? parseInt(brushSizeSlider.value, 10) : parseInt(blurBrushSizeSlider.value, 10);
    const radius = (size / 2) * scale;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    processImage();
  }

  comparison.addEventListener('mousedown', (e) => {
    if (!originalImage) return;
    if (brushMode !== 'none') {
      isBrushing = true;
      drawBrush(e);
      e.preventDefault();
    } else if (pickMode && currentTab === 'bg') {
      const { x, y } = getCanvasCoords(e);
      bgColor = sampleColorAtPoint(x, y);
      updateColorChip();
      processImage();
    }
  });

  comparison.addEventListener('touchstart', (e) => {
    if (!originalImage) return;
    if (brushMode !== 'none') {
      isBrushing = true;
      drawBrush(e.touches[0]);
      e.preventDefault();
    } else if (pickMode && currentTab === 'bg') {
      const { x, y } = getCanvasCoords(e.touches[0]);
      bgColor = sampleColorAtPoint(x, y);
      updateColorChip();
      processImage();
    }
  }, { passive: false });

  comparison.addEventListener('mouseleave', () => {
    brushCursor.classList.add('hidden');
  });

  downloadBtn.addEventListener('click', () => {
    if (!originalImage) return;
    const link = document.createElement('a');
    link.download = `${originalFileName}-bggone.png`;
    link.href = processedCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  resetBtn.addEventListener('click', () => {
    originalImage = null;
    processedCanvas.width = 0;
    processedCanvas.height = 0;
    maskCanvas.width = 0;
    maskCanvas.height = 0;
    blurMaskCanvas.width = 0;
    blurMaskCanvas.height = 0;
    beforeImage.src = '';
    afterImage.src = '';
    fileInput.value = '';
    downloadBtn.disabled = true;
    editor.classList.add('hidden');
    uploadZone.classList.remove('hidden');
    
    toleranceSlider.value = 40;
    featherSlider.value = 4;
    bgBlurSlider.value = 0;
    blurSlider.value = 10;
    brushSizeSlider.value = 20;
    blurBrushSizeSlider.value = 20;
    
    toleranceInput.value = 40;
    featherInput.value = 4;
    bgBlurInput.value = 0;
    blurInput.value = 10;
    brushSizeInput.value = 20;
    blurBrushSizeInput.value = 20;
    
    autoModeBtn.click();
  });

  document.addEventListener('paste', (e) => {
    if (editor.classList.contains('hidden')) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) loadImage(file);
          break;
        }
      }
    }
  });

  requestAnimationFrame(() => {
    updateTabIndicator(document.querySelector('.tab-btn.active'));
  });

})();