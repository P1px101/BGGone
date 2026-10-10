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
  const toleranceSlider = document.getElementById('tolerance');
  const toleranceVal = document.getElementById('toleranceVal');
  const featherSlider = document.getElementById('feather');
  const featherVal = document.getElementById('featherVal');
  const autoModeBtn = document.getElementById('autoMode');
  const pickModeBtn = document.getElementById('pickMode');
  const pickHint = document.getElementById('pickHint');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const imageInfo = document.getElementById('imageInfo');
  const chipDot = document.getElementById('chipDot');
  const bgLabel = document.getElementById('bgLabel');

  let originalImage = null;
  let originalFileName = 'image';
  let processedCanvas = document.createElement('canvas');
  let processedCtx = processedCanvas.getContext('2d', { willReadFrequently: true });
  let bgColor = { r: 255, g: 255, b: 255 };
  let pickMode = false;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let hasMoved = false;

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

    imageInfo.textContent = `${originalFileName} · ${img.naturalWidth}×${img.naturalHeight}`;
    beforeImage.src = img.src;

    fitComparison();

    processedCtx.drawImage(img, 0, 0);
    bgColor = sampleBackgroundColor(processedCtx, processedCanvas.width, processedCanvas.height);
    updateColorChip();
    processImage();

    setSliderPosition(50);
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

  function processImage() {
    if (!originalImage) return;

    processedCtx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
    processedCtx.drawImage(originalImage, 0, 0);

    const imageData = processedCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
    const data = imageData.data;

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
      } else if (feather > 0 && dist2 <= feather2) {
        const t = (dist2 - tol2) / featherSpan;
        data[i + 3] = Math.round(255 * t);
      }
    }

    processedCtx.putImageData(imageData, 0, 0);
    afterImage.src = processedCanvas.toDataURL('image/png');
    downloadBtn.disabled = false;
  }

  toleranceSlider.addEventListener('input', (e) => {
    toleranceVal.textContent = e.target.value;
  });
  toleranceSlider.addEventListener('change', processImage);

  featherSlider.addEventListener('input', (e) => {
    featherVal.textContent = e.target.value;
  });
  featherSlider.addEventListener('change', processImage);

  autoModeBtn.addEventListener('click', () => {
    pickMode = false;
    autoModeBtn.classList.add('active');
    pickModeBtn.classList.remove('active');
    comparison.style.cursor = 'ew-resize';
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
    comparison.style.cursor = 'crosshair';
    pickHint.textContent = 'Click on the background area in the image';
  });

  function setSliderPosition(percent) {
    percent = Math.max(0, Math.min(100, percent));
    sliderHandle.style.left = `${percent}%`;
    beforeImage.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
  }

  function handleMove(clientX) {
    const rect = comparison.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(percent);
  }

  comparison.addEventListener('mousedown', (e) => {
    if (!originalImage) return;
    isDragging = false;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (e.buttons === 1 && originalImage) {
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > 4 || dy > 4) {
        isDragging = true;
        hasMoved = true;
        handleMove(e.clientX);
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!originalImage) return;
    if (!hasMoved && pickMode) {
      const rect = comparison.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / rect.width * processedCanvas.width);
      const y = Math.round((e.clientY - rect.top) / rect.height * processedCanvas.height);
      
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        bgColor = sampleColorAtPoint(x, y);
        updateColorChip();
        processImage();
      }
    }
    isDragging = false;
    hasMoved = false;
  });

  comparison.addEventListener('touchstart', (e) => {
    if (!originalImage) return;
    isDragging = false;
    hasMoved = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (originalImage) {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 4 || dy > 4) {
        isDragging = true;
        hasMoved = true;
        handleMove(e.touches[0].clientX);
        e.preventDefault();
      }
    }
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (!originalImage) return;
    if (!hasMoved && pickMode) {
      const touch = e.changedTouches[0];
      const rect = comparison.getBoundingClientRect();
      if (touch.clientX >= rect.left && touch.clientX <= rect.right && touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const x = Math.round((touch.clientX - rect.left) / rect.width * processedCanvas.width);
        const y = Math.round((touch.clientY - rect.top) / rect.height * processedCanvas.height);
        bgColor = sampleColorAtPoint(x, y);
        updateColorChip();
        processImage();
      }
    }
    isDragging = false;
    hasMoved = false;
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
    beforeImage.src = '';
    afterImage.src = '';
    fileInput.value = '';
    downloadBtn.disabled = true;
    editor.classList.add('hidden');
    uploadZone.classList.remove('hidden');
    toleranceSlider.value = 40;
    featherSlider.value = 4;
    toleranceVal.textContent = '40';
    featherVal.textContent = '4';
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

})();