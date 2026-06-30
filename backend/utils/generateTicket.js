const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');
const bwipjs = require('bwip-js');
const puppeteer = require('puppeteer');

const TICKET_WIDTH = 1200;
const TICKET_HEIGHT = 400;
const POSTER_WIDTH = 400;
const STUB_WIDTH = 150;

// mirrors the exact directory multer writes posters into — see middleware/upload.js
const POSTERS_DIR = path.join(__dirname, '..', 'uploads', 'posters');

const POSTER_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const resolvePosterDataUri = (posterUrl) => {
  if (!posterUrl) return null;

  try {
    const filename = path.basename(posterUrl);
    const filePath = path.join(POSTERS_DIR, filename);
    const mimeType = POSTER_MIME_TYPES[path.extname(filename).toLowerCase()];
    if (!mimeType) return null;

    const buffer = fs.readFileSync(filePath);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null; // missing/unreadable file — caller falls back to a solid placeholder block
  }
};

const generateBarcodeDataUri = async (text) => {
  const buffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 12,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
  return `data:image/png;base64,${buffer.toString('base64')}`;
};

const buildTicketHtml = ({
  posterDataUri,
  barcodeDataUri,
  categoryLine,
  location,
  title,
  dateText,
  timeText,
  confirmationCode,
  nameWords,
}) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Montserrat', Arial, sans-serif; }

  .ticket {
    position: relative;
    width: ${TICKET_WIDTH}px;
    height: ${TICKET_HEIGHT}px;
    display: flex;
    background: #F2EAE6;
    overflow: hidden;
  }

  .poster {
    width: ${POSTER_WIDTH}px;
    height: ${TICKET_HEIGHT}px;
    flex-shrink: 0;
    object-fit: cover;
  }
  .poster-fallback {
    width: ${POSTER_WIDTH}px;
    height: ${TICKET_HEIGHT}px;
    flex-shrink: 0;
    background: #F7F7F7;
  }

  .main-content {
    width: ${TICKET_WIDTH - POSTER_WIDTH - STUB_WIDTH}px;
    height: ${TICKET_HEIGHT}px;
    padding: 30px 32px;
    display: flex;
    flex-direction: column;
  }

  .top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }
  .meta {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #1A1A1A;
    white-space: nowrap;
  }

  .title {
    font-size: 38px;
    font-weight: 800;
    text-transform: uppercase;
    line-height: 1.15;
    margin-top: 26px;
    color: #1A1A1A;
  }

  .pills {
    display: flex;
    gap: 16px;
    margin-top: 36px;
  }
  .pill {
    border: 2px solid #1A1A1A;
    border-radius: 999px;
    padding: 10px 22px;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .notch {
    position: absolute;
    right: ${STUB_WIDTH - 13}px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #1A1A1A;
    z-index: 2;
  }
  .notch-top { top: -13px; }
  .notch-bottom { bottom: -13px; }
  .perforation {
    position: absolute;
    right: ${STUB_WIDTH}px;
    top: 0;
    bottom: 0;
    border-left: 3px dashed #1A1A1A;
  }

  .stub {
    width: ${STUB_WIDTH}px;
    height: ${TICKET_HEIGHT}px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 22px;
  }
  .barcode {
    width: 96px;
    height: 86px;
    object-fit: contain;
    margin-bottom: 14px;
  }
  /* transform: rotate() doesn't affect the flex layout box, so each rotated
     block sits in a fixed-size slot sized for its POST-rotation footprint —
     otherwise flex only reserves the narrow pre-rotation box and neighbouring
     content overlaps it */
  .stub-slot {
    width: ${STUB_WIDTH}px;
    height: 130px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .rotated-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 130px;
    transform: rotate(-90deg);
    white-space: nowrap;
  }
  .rotated-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #6B6358;
  }
  .rotated-value {
    font-size: 15px;
    font-weight: 800;
    text-transform: uppercase;
    color: #1A1A1A;
    line-height: 1.2;
  }
</style>
</head>
<body>
  <div class="ticket">
    ${posterDataUri ? `<img class="poster" src="${posterDataUri}" />` : '<div class="poster-fallback"></div>'}

    <div class="main-content">
      <div class="top-row">
        <span class="meta">${categoryLine}</span>
        <span class="meta">${location}</span>
      </div>
      <div class="title">${title}</div>
      <div class="pills">
        <span class="pill">${dateText}</span>
        <span class="pill">${timeText}</span>
      </div>
    </div>

    <div class="notch notch-top"></div>
    <div class="perforation"></div>
    <div class="notch notch-bottom"></div>

    <div class="stub">
      <img class="barcode" src="${barcodeDataUri}" />
      <div class="stub-slot">
        <div class="rotated-group">
          <span class="rotated-label">Admission</span>
          <span class="rotated-value">${confirmationCode}</span>
        </div>
      </div>
      <div class="stub-slot">
        <div class="rotated-group">
          <span class="rotated-label">Name</span>
          ${nameWords.map((word) => `<span class="rotated-value">${word}</span>`).join('')}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Pure rendering function: takes already-populated documents, returns a PNG Buffer.
// No DB access, no email sending — callers decide what to do with the result.
const generateTicketImage = async ({ booking, event, student }) => {
  const [barcodeDataUri, posterDataUri] = await Promise.all([
    generateBarcodeDataUri(booking._id.toString()),
    Promise.resolve(resolvePosterDataUri(event.posterUrl)),
  ]);

  const html = buildTicketHtml({
    posterDataUri,
    barcodeDataUri,
    categoryLine: escapeHtml(`${event.category} Event`),
    location: escapeHtml(event.location),
    title: escapeHtml(event.title),
    dateText: escapeHtml(format(new Date(event.date), 'MMM d, yyyy')),
    timeText: escapeHtml(event.time),
    // full ObjectId is 24 hex chars — too long to read rotated in a 150px stub,
    // so the visible code is the last 8 chars (still unique enough at this scale)
    confirmationCode: escapeHtml(booking._id.toString().slice(-8).toUpperCase()),
    nameWords: student.name.trim().split(/\s+/).map(escapeHtml),
  });

  const browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: TICKET_WIDTH, height: TICKET_HEIGHT });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
};

module.exports = generateTicketImage;
