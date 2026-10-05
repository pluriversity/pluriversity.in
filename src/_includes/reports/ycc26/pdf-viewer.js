// Two-page spread viewer using static WebP page images.
// Renders pairs (1|2, 3|4, …); last spread shows single page if total is odd.

const TOTAL = 48;
const PAGE_PREFIX = 'assets/pages/page-';
const PAD = 2; // zero-pad width

const viewer = document.getElementById('pdfViewer');
if (viewer) initViewer();

function initViewer() {
  const leftImg   = document.getElementById('pdfLeft');
  const rightImg  = document.getElementById('pdfRight');
  const spread    = document.getElementById('pdfSpread');
  const loading   = document.getElementById('pdfLoading');
  const info      = document.getElementById('pdfPageInfo');
  const prev      = document.getElementById('pdfPrev');
  const next      = document.getElementById('pdfNext');
  const cover     = document.getElementById('pdfCover');

  const mqSpread = window.matchMedia('(min-width: 1100px)');
  let pagesPerSpread = mqSpread.matches ? 2 : 1;
  const displayTotal = () => pagesPerSpread === 2 ? TOTAL + 1 : TOTAL;
  let firstDisplay = 1;

  const clampDisplay = () => {
    if (firstDisplay < 1) firstDisplay = 1;
    if (firstDisplay > displayTotal()) firstDisplay = displayTotal();
    if (pagesPerSpread === 2 && firstDisplay % 2 === 0) firstDisplay -= 1;
  };

  const pageNum = (d) => pagesPerSpread === 2 ? d - 1 : d;
  const imgSrc = (n) => `${PAGE_PREFIX}${String(n).padStart(PAD, '0')}.webp`;

  function renderSpread() {
    clampDisplay();
    const leftDisplay  = firstDisplay;
    const rightDisplay = leftDisplay + 1;
    const isTwoPage    = pagesPerSpread === 2;
    const showRight    = isTwoPage && rightDisplay <= displayTotal();
    const leftBlank    = isTwoPage && leftDisplay === 1;
    const rightBlank   = isTwoPage && !showRight;

    const singleLayout = !isTwoPage && !showRight;
    spread.classList.toggle('is-single', singleLayout);
    spread.classList.toggle('has-dummy', leftBlank || rightBlank);

    // Left page
    if (leftBlank) {
      leftImg.style.visibility = 'hidden';
    } else {
      leftImg.src = imgSrc(pageNum(leftDisplay));
      leftImg.alt = `Page ${pageNum(leftDisplay)}`;
      leftImg.style.visibility = 'visible';
    }

    // Right page
    if (showRight) {
      rightImg.src = imgSrc(pageNum(rightDisplay));
      rightImg.alt = `Page ${pageNum(rightDisplay)}`;
      rightImg.style.visibility = 'visible';
    } else {
      rightImg.style.visibility = 'hidden';
    }

    // Page info text
    if (leftBlank) {
      info.innerHTML = `<span class="pdf-info-label">Page </span>1 of ${TOTAL}`;
    } else if (rightBlank) {
      info.innerHTML =
        `<span class="pdf-info-label">Page </span>${pageNum(leftDisplay)} of ${TOTAL}`;
    } else if (showRight) {
      info.innerHTML =
        `<span class="pdf-info-label">Pages </span>` +
        `${pageNum(leftDisplay)}–${pageNum(rightDisplay)} of ${TOTAL}`;
    } else {
      info.innerHTML =
        `<span class="pdf-info-label">Page </span>${pageNum(leftDisplay)} of ${TOTAL}`;
    }

    prev.disabled  = leftDisplay <= 1;
    next.disabled  = leftDisplay + pagesPerSpread > displayTotal();
    cover.disabled = leftDisplay === 1;
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

  renderSpread();

  if (loading) {
    loading.classList.add('is-done');
    setTimeout(() => loading.remove(), 500);
  }
}
