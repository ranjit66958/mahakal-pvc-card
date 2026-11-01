(() => {
  const fileInput = document.getElementById('pdfFile');
  const typeSelect = document.getElementById('cardType');
  const canvas = document.getElementById('cardCanvas');
  const ctx = canvas.getContext('2d');
  const empty = document.getElementById('emptyState');
  const info = document.getElementById('fileInfo');
  const alertBox = document.getElementById('alert');
  const printBtn = document.getElementById('printBtn');
  const clearBtn = document.getElementById('clearBtn');
  let pdfDoc = null;
  let currentPageImage = null;
  let renderToken = 0;
  const OUT_W = 856, OUT_H = 540;
  const names = { aadhaar: 'આધાર કાર્ડ', pan: 'PAN કાર્ડ', ayushman: 'આયુષ્માન કાર્ડ', other: 'અન્ય કાર્ડ' };

  function showAlert(message) { alertBox.textContent = message; alertBox.style.display = 'block'; }
  function hideAlert() { alertBox.textContent = ''; alertBox.style.display = 'none'; }
  function clearFile() {
    renderToken++;
    pdfDoc = null; currentPageImage = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.hidden = true; empty.style.display = 'flex';
    fileInput.value = ''; info.textContent = 'હજુ કોઈ PDF પસંદ કરી નથી.';
    printBtn.disabled = true; hideAlert();
  }

  fileInput.addEventListener('change', async () => {
    hideAlert();
    const file = fileInput.files && fileInput.files[0];
    if (!file) { clearFile(); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      clearFile(); showAlert('કૃપા કરીને માત્ર PDF ફાઇલ પસંદ કરો.'); return;
    }
    if (file.size > 25 * 1024 * 1024) {
      clearFile(); showAlert('ફાઇલ 25 MB કરતાં મોટી છે. નાની PDF પસંદ કરો.'); return;
    }
    const token = ++renderToken;
    info.textContent = `${names[typeSelect.value]} • ${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    printBtn.disabled = true;
    if (!window.pdfjsLib) {
      showAlert('PDF reader લોડ થયો નથી. ઇન્ટરનેટ કનેક્શન તપાસીને પેજ ફરી ખોલો.'); return;
    }
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await window.pdfjsLib.getDocument({ data }).promise;
      if (token !== renderToken) return;
      pdfDoc = doc;
      await renderPage(1, token);
      if (token !== renderToken) return;
      printBtn.disabled = false;
      showAlert(`PDF માં ${pdfDoc.numPages} પેજ છે. પ્રથમ પેજમાંથી કાર્ડનો ભાગ ઓળખીને PVC માપમાં ફિટ કરવાનો પ્રયાસ થયો છે.`);
    } catch (err) {
      if (token !== renderToken) return;
      showAlert('PDF વાંચી શકાઈ નથી. પાસવર્ડવાળી PDF સપોર્ટ થતી નથી; ફાઇલ ફરી ડાઉનલોડ કરીને પ્રયાસ કરો.');
    }
  });

  typeSelect.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) info.textContent = `${names[typeSelect.value]} • ${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  });

  async function renderPage(pageNumber, token) {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const source = document.createElement('canvas');
    source.width = Math.ceil(viewport.width); source.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: source.getContext('2d'), viewport }).promise;
    if (token !== renderToken) return;
    currentPageImage = source;
    drawCard();
  }

  function drawCard() {
    if (!currentPageImage) return;
    canvas.width = OUT_W; canvas.height = OUT_H;
    const sw = currentPageImage.width, sh = currentPageImage.height;
    const probe = document.createElement('canvas');
    probe.width = sw; probe.height = sh;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, sw, sh);
    pctx.drawImage(currentPageImage, 0, 0);
    let minX = 0, minY = 0, maxX = sw, maxY = sh;
    try {
      const data = pctx.getImageData(0, 0, sw, sh).data;
      let left = sw, top = sh, right = -1, bottom = -1;
      const step = Math.max(1, Math.floor(Math.max(sw, sh) / 900));
      for (let y = 0; y < sh; y += step) {
        for (let x = 0; x < sw; x += step) {
          const i = (y * sw + x) * 4;
          if (data[i] < 238 || data[i + 1] < 238 || data[i + 2] < 238) {
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
        }
      }
      const boxArea = (right - left) * (bottom - top);
      if (right > left && bottom > top && boxArea > sw * sh * 0.008 && boxArea < sw * sh * 0.92) {
        const pad = Math.round(Math.max(right - left, bottom - top) * 0.015);
        minX = Math.max(0, left - pad); minY = Math.max(0, top - pad);
        maxX = Math.min(sw, right + pad); maxY = Math.min(sh, bottom + pad);
      }
    } catch (_) {}
    const cropW = maxX - minX, cropH = maxY - minY;
    const scale = Math.min(OUT_W / cropW, OUT_H / cropH);
    const drawW = cropW * scale, drawH = cropH * scale;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.drawImage(currentPageImage, minX, minY, cropW, cropH,
      (OUT_W - drawW) / 2, (OUT_H - drawH) / 2, drawW, drawH);
    canvas.hidden = false;
    empty.style.display = 'none';
  }

  printBtn.addEventListener('click', () => {
    if (!currentPageImage) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showAlert('પ્રિન્ટ માટે નવી વિન્ડો ખોલવાની મંજૂરી આપો.'); return; }
    const imageData = canvas.toDataURL('image/png');
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>PVC Card Print</title><style>@page{size:85.6mm 54mm;margin:0}html,body{margin:0;width:85.6mm;height:54mm}img{display:block;width:85.6mm;height:54mm}</style></head><body><img id="card" src="${imageData}" alt="PVC card"></body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  });

  clearBtn.addEventListener('click', clearFile);
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  } else {
    window.addEventListener('load', () => {
      if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    });
  }
})();
