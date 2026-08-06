// Tiny two-page spread renderer using PDF.js (ESM from CDN).
// Renders pairs (1|2, 3|4, …); the last spread shows a single page if total is odd.

const PDFJS_VERSION = '4.7.76';
const PDF_URL = 'handbook.pdf';
const RANGE_CHUNK = 1024 * 1024;

const viewer = document.getElementById('pdfViewer');
if (viewer) initViewer().catch(showError);

async function initViewer() {
  const pdfjsLib = await import(
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

  // Netlify answers Range requests with 206 but omits the `Accept-Ranges`
  // response header, which makes PDF.js's built-in loader fall back to
  // downloading the whole file. Drive range loading ourselves instead.
  class RangeTransport extends pdfjsLib.PDFDataRangeTransport {
    requestDataRange(begin, end) {
      fetch(PDF_URL, { headers: { Range: `bytes=${begin}-${end - 1}` } })
        .then((res) => {
          if (res.status !== 206) throw new Error(`Range request failed (${res.status})`);
          return res.arrayBuffer();
        })
        .then((buf) => this.onDataRange(begin, buf))
        .catch((err) => console.error('PDF range fetch failed:', err));
    }
  }

  const pdfParams = {
    disableAutoFetch: true,
    disableStream: true,
    rangeChunkSize: RANGE_CHUNK,
  };
  let source = { url: PDF_URL };
  try {
    const first = await fetch(PDF_URL, { headers: { Range: `bytes=0-${RANGE_CHUNK - 1}` } });
    const initialData = await first.arrayBuffer();
    if (first.status === 206) {
      const total = parseInt(first.headers.get('Content-Range')?.split('/')[1], 10);
      if (Number.isInteger(total)) {
        source = { url: PDF_URL, range: new RangeTransport(total, initialData) };
      }
    } else if (first.status === 200) {
      // Server ignored Range; use the full body we already received.
      source = { data: initialData };
    }
  } catch (err) {
    console.warn('PDF range probing failed; falling back to a single download:', err);
  }

  const pdf = await pdfjsLib.getDocument({ ...source, ...pdfParams }).promise;
  const total = pdf.numPages;

  const leftCanvas  = document.getElementById('pdfLeft');
  const rightCanvas = document.getElementById('pdfRight');
  const spread      = document.getElementById('pdfSpread');
  const loading     = document.getElementById('pdfLoading');
  const info        = document.getElementById('pdfPageInfo');
  const prev        = document.getElementById('pdfPrev');
  const next        = document.getElementById('pdfNext');
  const cover       = document.getElementById('pdfCover');

  loading.remove();

  // Two-page (desktop) view renders a virtual blank on the left so the book
  // opens as (blank | P1, P2 | P3, …). Single-page view starts at the cover (P1).
  // We navigate in "display" indices where the two-page sequence is
  // [blank(1), P1(2), P2(3), …] and the single-page sequence is [P1(1), P2(2), …].
  const mqSpread = window.matchMedia('(min-width: 1100px)');
  let pagesPerSpread = mqSpread.matches ? 2 : 1;
  const displayTotal = () => pagesPerSpread === 2 ? total + 1 : total;
  const minDisplay   = () => 1;
  let firstDisplay = 1;

  const clampDisplay = () => {
    if (firstDisplay < minDisplay()) firstDisplay = minDisplay();
    if (firstDisplay > displayTotal()) firstDisplay = displayTotal();
    // In two-page view spreads start on odd display indices.
    if (pagesPerSpread === 2 && firstDisplay % 2 === 0) firstDisplay -= 1;
  };

  // Display index -> PDF page (null = virtual blank).
  const pdfOfDisplay = (d) => pagesPerSpread === 2 ? d - 1 : d;

  let renderToken = 0;
  let rendering = false;
  let pendingRerender = false;

  // Render page `num` into an offscreen canvas, then synchronously blit it
  // into the visible `canvas` only if this render is still current. Rendering
  // offscreen means a stale PDF.js task (which can't be cancelled) can never
  // paint over a fresher render.
  async function renderPage(num, canvas, token) {
    const page = await pdf.getPage(num);
    if (token !== renderToken) return false;
    const baseViewport = page.getViewport({ scale: 1 });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const gap = parseFloat(getComputedStyle(spread).columnGap) || 0;
    const pad = parseFloat(getComputedStyle(spread).paddingLeft) || 0;
    const slotWidth = pagesPerSpread === 2
      ? (spread.clientWidth - pad * 2 - gap) / 2
      : spread.clientWidth - pad * 2;
    const cssScale = slotWidth / baseViewport.width;
    const renderViewport = page.getViewport({ scale: cssScale * dpr });

    const off = document.createElement('canvas');
    off.width  = Math.floor(renderViewport.width);
    off.height = Math.floor(renderViewport.height);

    const offCtx = off.getContext('2d');
    await page.render({ canvasContext: offCtx, viewport: renderViewport }).promise;

    // Synchronous blit; superseded renders abort here and never draw.
    if (token !== renderToken) return false;

    canvas.width  = Math.floor(renderViewport.width);
    canvas.height = Math.floor(renderViewport.height);
    canvas.style.width  = `${Math.floor(baseViewport.width * cssScale)}px`;
    canvas.style.height = `${Math.floor(baseViewport.height * cssScale)}px`;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0);
    return true;
  }

  // Fill a canvas with a plain white page matching the given dimensions.
  function renderBlank(canvas, width, height) {
    canvas.width  = Math.floor(width);
    canvas.height = Math.floor(height);
    canvas.style.width  = `${Math.floor(width)}px`;
    canvas.style.height = `${Math.floor(height)}px`;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function renderSpreadInner() {
    const token = ++renderToken;
    clampDisplay();
    const leftDisplay  = firstDisplay;
    const rightDisplay = leftDisplay + 1;
    const isTwoPage = pagesPerSpread === 2;
    const showRight = isTwoPage && rightDisplay <= displayTotal();
    // In two-page mode the opening edges get a blank partner: the leading page
    // is a virtual blank on the left, and a trailing book leaves a blank on the right.
    const leftBlank  = isTwoPage && leftDisplay === 1;
    const rightBlank = isTwoPage && !showRight;

    const singleLayout = !isTwoPage && !showRight;
    spread.classList.toggle('is-single', singleLayout);
    spread.classList.toggle('has-dummy', leftBlank || rightBlank);

    // Render the real page first so a blank partner can mirror its size.
    if (showRight && !(await renderPage(pdfOfDisplay(rightDisplay), rightCanvas, token))) return;
    if (!leftBlank && !(await renderPage(pdfOfDisplay(leftDisplay), leftCanvas, token))) return;
    if (token !== renderToken) return;

    if (leftBlank) {
      const blankW = parseFloat(rightCanvas.style.width) || rightCanvas.width;
      const blankH = parseFloat(rightCanvas.style.height) || rightCanvas.height;
      renderBlank(leftCanvas, blankW, blankH);
    }
    if (rightBlank) {
      const blankW = parseFloat(leftCanvas.style.width) || leftCanvas.width;
      const blankH = parseFloat(leftCanvas.style.height) || leftCanvas.height;
      renderBlank(rightCanvas, blankW, blankH);
    }
    if (token !== renderToken) return;

    if (leftBlank) {
      info.innerHTML = `<span class="pdf-info-label">Page </span>1 of ${total}`;
    } else if (rightBlank) {
      info.innerHTML =
        `<span class="pdf-info-label">Page </span>${pdfOfDisplay(leftDisplay)} of ${total}`;
    } else if (showRight) {
      info.innerHTML =
        `<span class="pdf-info-label">Pages </span>` +
        `${pdfOfDisplay(leftDisplay)}–${pdfOfDisplay(rightDisplay)} of ${total}`;
    } else {
      info.innerHTML =
        `<span class="pdf-info-label">Page </span>${pdfOfDisplay(leftDisplay)} of ${total}`;
    }

    prev.disabled  = leftDisplay <= 1;
    next.disabled  = leftDisplay + pagesPerSpread > displayTotal();
    cover.disabled = leftDisplay === 1;
  }

  // Serialize rendering so only one PDF.js render runs at a time. Rapid
  // clicks that arrive mid-render are coalesced into a single follow-up pass.
  async function renderSpread() {
    if (rendering) { pendingRerender = true; return; }
    rendering = true;
    try {
      await renderSpreadInner();
    } finally {
      rendering = false;
      if (pendingRerender) {
        pendingRerender = false;
        renderSpread();
      }
    }
  }

  prev.addEventListener('click', () => {
    firstDisplay -= pagesPerSpread;
    renderSpread();
  });
  next.addEventListener('click', () => {
    firstDisplay += pagesPerSpread;
    renderSpread();
  });
  cover.addEventListener('click', () => {
    firstDisplay = 1;
    renderSpread();
  });

  mqSpread.addEventListener('change', (e) => {
    pagesPerSpread = e.matches ? 2 : 1;
    clampDisplay();
    renderSpread();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowLeft')  prev.click();
    if (e.key === 'ArrowRight') next.click();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderSpread, 180);
  });

  await renderSpread();
}

function showError(err) {
  console.error('PDF viewer failed:', err);
  const loading = document.getElementById('pdfLoading');
  if (loading) {
    loading.textContent = "Couldn't load the preview. Use the link below to open the PDF.";
  }
}
