(() => {
  const fileInput = document.getElementById('pdfFile');
  const typeSelect = document.getElementById('cardType');
  const frontCanvas = document.getElementById('frontCanvas');
  const backCanvas = document.getElementById('backCanvas');
  const frontCtx = frontCanvas.getContext('2d');
  const backCtx = backCanvas.getContext('2d');
  const empty = document.getElementById('emptyState');
  const emptyBack = document.getElementById('emptyBack');
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
    frontCtx.clearRect(0, 0, frontCanvas.width, frontCanvas.height);
    backCtx.clearRect(0, 0, backCanvas.width, backCanvas.height);
    frontCanvas.hidden = true; backCanvas.hidden = true;
    empty.style.display = 'flex'; emptyBack.style.display = 'flex';
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
      showAlert(`PDF માં ${pdfDoc.numPages} પેજ છે. પ્રથમ પેજમાંથી આગળ અને પાછળની સાઇડ ક્રોપ કરી છે. બંને પ્રિવ્યૂ તપાસીને જ પ્રિન્ટ કરો.`);
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
    const sw = currentPageImage.width, sh = currentPageImage.height;
    frontCanvas.width = backCanvas.width = OUT_W;
    frontCanvas.height = backCanvas.height = OUT_H;
    let rects;
    if (typeSelect.value === 'aadhaar') {
      // The supplied Aadhaar letter layout has the two card faces in the lower row.
      rects = [
        {x:0.075*sw, y:0.675*sh, w:0.42*sw, h:0.19*sh},
        {x:0.505*sw, y:0.675*sh, w:0.42*sw, h:0.19*sh}
      ];
    } else {
      // Best-effort split for other PDFs; inspect previews before printing.
      rects = [
        {x:0.04*sw, y:0.10*sh, w:0.46*sw, h:0.80*sh},
        {x:0.50*sw, y:0.10*sh, w:0.46*sw, h:0.80*sh}
      ];
    }
    [[frontCtx, rects[0]],[backCtx, rects[1]]].forEach(([target, r]) => {
      target.fillStyle = '#fff'; target.fillRect(0, 0, OUT_W, OUT_H);
      target.drawImage(currentPageImage, r.x, r.y, r.w, r.h, 0, 0, OUT_W, OUT_H);
    });
    frontCanvas.hidden = false; backCanvas.hidden = false;
    empty.style.display = 'none'; emptyBack.style.display = 'none';
  }

  printBtn.addEventListener('click', () => {
    if (!currentPageImage) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showAlert('પ્રિન્ટ માટે નવી વિન્ડો ખોલવાની મંજૂરી આપો.'); return; }
    const frontData = frontCanvas.toDataURL('image/png');
    const backData = backCanvas.toDataURL('image/png');
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>PVC Card Front and Back</title><style>@page{size:85.6mm 54mm;margin:0}html,body{margin:0;padding:0}section{width:85.6mm;height:54mm;page-break-after:always;break-after:page}section:last-child{page-break-after:auto;break-after:auto}img{display:block;width:85.6mm;height:54mm}</style></head><body><section><img src="${frontData}" alt="Front"></section><section><img src="${backData}" alt="Back"></section></body></html>`);
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
