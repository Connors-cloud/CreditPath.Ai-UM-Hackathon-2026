#!/usr/bin/env node
/**
 * Generates DFD Level 1 for Credit Path AI as a PDF (A4 Landscape).
 * Usage:  node scripts/generateDFD.js
 * Output: docs/DFD-Level1-CreditPathAI.pdf
 */
import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, '..', 'docs'), { recursive: true });
const OUT = join(__dirname, '..', 'docs', 'DFD-Level1-CreditPathAI.pdf');

// ── Colours ───────────────────────────────────────────────────────────────────
const DARK_BLUE  = '#0d2b5e';
const MID_BLUE   = '#1a3a6b';
const LIGHT_BLUE = '#dce8f8';
const ENTITY_BG  = '#eef2ff';
const PROC_BG    = '#dce8f8';
const GREY_DARK  = '#333333';
const GREY_MID   = '#666666';
const ARROW_CLR  = '#2a2a2a';
const STORE_BG   = '#f4f7fb';

// ── Page ──────────────────────────────────────────────────────────────────────
const PW = 841.89;   // A4 landscape width
const PH = 595.28;   // A4 landscape height

const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape' });
const ws  = createWriteStream(OUT);
doc.pipe(ws);

// ── Drawing primitives ────────────────────────────────────────────────────────

/** Point on circle edge towards (tx,ty). */
function ce(cx, cy, r, tx, ty) {
  const a = Math.atan2(ty - cy, tx - cx);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Point on rect edge (cx,cy centre, hw/hh half-width/height) towards (tx,ty). */
function re(cx, cy, hw, hh, tx, ty) {
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const sx = hw / Math.abs(dx || 1e-9);
  const sy = hh / Math.abs(dy || 1e-9);
  const s  = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

/** Arrowhead at (x2,y2) pointing from (x1,y1). */
function head(x1, y1, x2, y2, sz = 7) {
  const a  = Math.atan2(y2 - y1, x2 - x1);
  const af = Math.PI / 6;
  doc.save()
    .moveTo(x2, y2)
    .lineTo(x2 - sz * Math.cos(a - af), y2 - sz * Math.sin(a - af))
    .lineTo(x2 - sz * Math.cos(a + af), y2 - sz * Math.sin(a + af))
    .closePath().fill(ARROW_CLR).restore();
}

/**
 * Draw labelled arrow.
 * lx / ly: explicit label top-left; if omitted, centred on midpoint.
 */
function arrow(x1, y1, x2, y2, label = '', lx, ly) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = dx / len, ny = dy / len;
  const SZ = 7;
  // Line (shorten tail end by 1px, head end by arrowhead)
  doc.moveTo(x1 + nx, y1 + ny)
     .lineTo(x2 - nx * SZ, y2 - ny * SZ)
     .strokeColor(ARROW_CLR).lineWidth(0.85).stroke();
  head(x1, y1, x2, y2, SZ);
  if (label) {
    const mx = lx !== undefined ? lx : (x1 + x2) / 2 - 28;
    const my = ly !== undefined ? ly : (y1 + y2) / 2 - 9;
    // Small white backing for legibility
    const lw = 58, lh = label.split('\n').length * 8 + 4;
    doc.rect(mx - 1, my - 1, lw + 2, lh).fillColor('white').fill();
    doc.fillColor(GREY_MID).fontSize(6.2).font('Helvetica-Oblique')
       .text(label, mx, my, { width: lw, align: 'center' });
  }
}

/** External entity — double-bordered rectangle. */
function entity(cx, cy, name) {
  const W = 82, H = 40;
  // Drop shadow
  doc.rect(cx - W/2 + 3, cy - H/2 + 3, W, H).fillColor('#b8c8e8').fill();
  // Outer box
  doc.rect(cx - W/2, cy - H/2, W, H)
     .fillColor(ENTITY_BG).strokeColor(DARK_BLUE).lineWidth(2).fillAndStroke();
  // Inner border (double-line effect)
  doc.rect(cx - W/2 + 4, cy - H/2 + 4, W - 8, H - 8)
     .strokeColor(DARK_BLUE).lineWidth(0.5).stroke();
  doc.fillColor(DARK_BLUE).fontSize(8.5).font('Helvetica-Bold')
     .text(name, cx - W/2 + 2, cy - 7, { width: W - 4, align: 'center' });
}

/** Process — circle split by horizontal line (Yourdon/DeMarco notation). */
function proc(cx, cy, r, num, label) {
  // Drop shadow
  doc.circle(cx + 2, cy + 2, r).fillColor('#9cb0cc').fill();
  // Main circle
  doc.circle(cx, cy, r)
     .fillColor(PROC_BG).strokeColor(MID_BLUE).lineWidth(1.5).fillAndStroke();
  // Horizontal divider
  doc.moveTo(cx - r + 6, cy - 6)
     .lineTo(cx + r - 6, cy - 6)
     .strokeColor(MID_BLUE).lineWidth(0.7).stroke();
  // Process number (above line)
  doc.fillColor(MID_BLUE).fontSize(9).font('Helvetica-Bold')
     .text(num, cx - r + 6, cy - 20, { width: (r - 6) * 2, align: 'center', lineBreak: false });
  // Label (below line) — support \n
  const lines = label.split('\n');
  let lY = cy - 2;
  for (const ln of lines) {
    doc.fillColor(DARK_BLUE).fontSize(6.5).font('Helvetica')
       .text(ln, cx - r + 7, lY, { width: (r - 7) * 2, align: 'center', lineBreak: false });
    lY += 9;
  }
}

/**
 * Data store — two horizontal lines, closed on left, open on right.
 * x1,x2: left/right x;  topY: top line y;  id: short id;  label: name.
 */
function store(x1, x2, topY, id, label) {
  const H = 22;
  doc.rect(x1, topY, x2 - x1, H).fillColor(STORE_BG).fill();
  // Top & bottom lines
  doc.moveTo(x1, topY)    .lineTo(x2, topY)    .strokeColor(MID_BLUE).lineWidth(1.2).stroke();
  doc.moveTo(x1, topY + H).lineTo(x2, topY + H).strokeColor(MID_BLUE).lineWidth(1.2).stroke();
  // Left cap
  doc.moveTo(x1, topY).lineTo(x1, topY + H).strokeColor(MID_BLUE).lineWidth(1.2).stroke();
  // ID tile
  doc.rect(x1, topY, 28, H).fillColor(LIGHT_BLUE).fill();
  doc.moveTo(x1 + 28, topY).lineTo(x1 + 28, topY + H).strokeColor(MID_BLUE).lineWidth(0.5).stroke();
  doc.fillColor(MID_BLUE).fontSize(7).font('Helvetica-Bold')
     .text(id, x1 + 2, topY + 6, { width: 24, align: 'center', lineBreak: false });
  // Name
  doc.fillColor(GREY_DARK).fontSize(7.5).font('Helvetica')
     .text(label, x1 + 32, topY + 6, { width: x2 - x1 - 36, lineBreak: false });
}

// ── Layout ────────────────────────────────────────────────────────────────────

const R = 44;   // process circle radius

// External entities  { cx, cy, hw, hh }
const ST  = { cx: 72,  cy: 293, hw: 41, hh: 20 };
const LEC = { cx: 769, cy: 293, hw: 41, hh: 20 };

// Processes  { cx, cy, num, lbl }
const P1 = { cx: 220, cy: 128, num: '1.0', lbl: 'Authenticate\nUser' };
const P2 = { cx: 185, cy: 455, num: '2.0', lbl: 'Upload &\nParse Documents' };
const P3 = { cx: 403, cy: 270, num: '3.0', lbl: 'AI Credit\nTransfer Analysis' };
const P4 = { cx: 568, cy: 455, num: '4.0', lbl: 'Submit &\nTrack Application' };
const P5 = { cx: 648, cy: 120, num: '5.0', lbl: 'Lecturer\nReview & Decide' };
const P6 = { cx: 567, cy: 205, num: '6.0', lbl: 'Generate\nPDF Report' };

// Data stores  { x1, x2, topY, id, label }
const D1 = { x1: 142, x2: 302, topY: 38,  id: 'D1', label: 'Users & Profiles' };
const D2 = { x1: 28,  x2: 182, topY: 533, id: 'D2', label: 'Document Store' };
const D3 = { x1: 308, x2: 472, topY: 38,  id: 'D3', label: 'Subject Catalogue' };
const D4 = { x1: 308, x2: 468, topY: 362, id: 'D4', label: 'Analyses' };
const D5 = { x1: 460, x2: 665, topY: 533, id: 'D5', label: 'Applications & Items' };

// Helpers for data store connection points
const sTop = s => [(s.x1 + s.x2) / 2, s.topY];
const sBot = s => [(s.x1 + s.x2) / 2, s.topY + 22];
const sL   = s => [s.x1,              s.topY + 11];
const sR   = s => [s.x2,              s.topY + 11];

// ── PAGE HEADER ───────────────────────────────────────────────────────────────
doc.rect(0, 0, PW, 27).fill(DARK_BLUE);
doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
   .text('DATA FLOW DIAGRAM — LEVEL 1', 24, 7, { width: 420 });
doc.fillColor('#aac8f0').fontSize(8.5).font('Helvetica')
   .text('Credit Path AI  ·  UMHackathon 2026', PW - 240, 9, { width: 215, align: 'right' });

// ── DATA STORES (drawn first, under everything) ───────────────────────────────
store(D1.x1, D1.x2, D1.topY, D1.id, D1.label);
store(D2.x1, D2.x2, D2.topY, D2.id, D2.label);
store(D3.x1, D3.x2, D3.topY, D3.id, D3.label);
store(D4.x1, D4.x2, D4.topY, D4.id, D4.label);
store(D5.x1, D5.x2, D5.topY, D5.id, D5.label);

// ── ARROWS (drawn before processes so circles cleanly overlay ends) ────────────

// ─ Student ↔ P1 (Authentication)
{
  const [ex, ey] = re(ST.cx, ST.cy, ST.hw, ST.hh, P1.cx, P1.cy - 6);
  const [px, py] = ce(P1.cx, P1.cy, R, ST.cx, ST.cy - 6);
  arrow(ex, ey, px, py, 'Login\nCredentials', ex + 6, ey - 18);
}
{
  const [px, py] = ce(P1.cx, P1.cy, R, ST.cx, ST.cy + 6);
  const [ex, ey] = re(ST.cx, ST.cy + 4, ST.hw, ST.hh, P1.cx, P1.cy + 6);
  arrow(px, py, ex, ey, 'Auth Token', (px + ex) / 2 + 4, (py + ey) / 2 + 2);
}

// ─ P1 ↔ D1 (Users)
{
  const [px, py] = ce(P1.cx, P1.cy, R, D1.x1 + 80, D1.topY);
  arrow(px, py, D1.x1 + 72, D1.topY + 22, 'Write\nUser', D1.x1 + 38, (py + D1.topY + 22) / 2 - 6);
}
{
  const [px, py] = ce(P1.cx, P1.cy, R, D1.x1 + 100, D1.topY);
  arrow(D1.x1 + 92, D1.topY + 22, px, py, 'Read\nUser', D1.x1 + 96, (D1.topY + 22 + py) / 2 - 4);
}

// ─ Student → P2 (Upload)
{
  const [ex, ey] = re(ST.cx, ST.cy, ST.hw, ST.hh, P2.cx, P2.cy);
  const [px, py] = ce(P2.cx, P2.cy, R, ST.cx, ST.cy);
  arrow(ex, ey, px, py, 'PDF\nDocuments', ex - 32, (ey + py) / 2);
}

// ─ P2 → D2 (Document Store)
{
  const [px, py] = ce(P2.cx, P2.cy, R, D2.x1 + 80, D2.topY);
  arrow(px, py, D2.x1 + 75, D2.topY, 'Parsed\nDocs', (px + D2.x1 + 75) / 2 - 18, (py + D2.topY) / 2 - 6);
}

// ─ P2 → P3 (Parsed transcript & syllabus data)
{
  const [ax, ay] = ce(P2.cx, P2.cy, R, P3.cx, P3.cy);
  const [bx, by] = ce(P3.cx, P3.cy, R, P2.cx, P2.cy);
  arrow(ax, ay, bx, by, 'Parsed Transcript\n& Syllabus Data', (ax + bx) / 2 - 28, (ay + by) / 2 + 4);
}

// ─ D3 (Subjects) → P3
{
  const [px, py] = ce(P3.cx, P3.cy, R, D3.x1 + 82, D3.topY);
  arrow(D3.x1 + 82, D3.topY + 22, px, py, 'Subject\nTopics', D3.x1 + 57, (D3.topY + 22 + py) / 2 - 5);
}

// ─ P3 → Student (Analysis results via SSE)
{
  const [px, py] = ce(P3.cx, P3.cy, R, ST.cx, ST.cy + 8);
  const [ex, ey] = re(ST.cx, ST.cy + 5, ST.hw, ST.hh, P3.cx, P3.cy + 8);
  arrow(px, py, ex, ey, 'Analysis Results\n(SSE Stream)', (px + ex) / 2 - 22, (py + ey) / 2 + 5);
}

// ─ P3 → D4 (store analysis)
{
  const [px, py] = ce(P3.cx, P3.cy, R, D4.x1 + 80, D4.topY);
  arrow(px, py, D4.x1 + 78, D4.topY, 'Store Analysis\nResults', D4.x1 + 50, (py + D4.topY) / 2 - 6);
}

// ─ D4 → P4 (application needs analysis data)
{
  const [px, py] = ce(P4.cx, P4.cy, R, sR(D4)[0], sR(D4)[1]);
  arrow(sR(D4)[0], sR(D4)[1], px, py, 'Analysis\nData', sR(D4)[0] + 4, (sR(D4)[1] + py) / 2 - 5);
}

// ─ D4 → P6 (AI verdicts for report)
{
  const [px, py] = ce(P6.cx, P6.cy, R, sR(D4)[0], sR(D4)[1]);
  arrow(sR(D4)[0], sR(D4)[1] - 3, px, py, 'AI Verdicts\n& Topics', sR(D4)[0] + 5, (sR(D4)[1] + py) / 2 - 10);
}

// ─ Student → P4 (submit strategy choice)
{
  const [ex, ey] = re(ST.cx, ST.cy, ST.hw, ST.hh, P4.cx, P4.cy);
  const [px, py] = ce(P4.cx, P4.cy, R, ST.cx, ST.cy);
  arrow(ex, ey, px, py, 'Strategy\nChoice', (ex + px) / 2 - 24, (ey + py) / 2 + 8);
}

// ─ P4 → D5 (create application record)
{
  const [px, py] = ce(P4.cx, P4.cy, R, D5.x1 + 100, D5.topY);
  arrow(px, py, D5.x1 + 98, D5.topY, 'Application\nRecord', D5.x1 + 62, (py + D5.topY) / 2 - 6);
}

// ─ P4 → Student (application status)
{
  // Offset slightly from the submit arrow to avoid overlap
  const [px, py] = ce(P4.cx, P4.cy, R, ST.cx + 5, ST.cy + 10);
  const [ex, ey] = re(ST.cx + 3, ST.cy + 6, ST.hw, ST.hh, P4.cx, P4.cy + 10);
  arrow(px, py, ex, ey, 'Application\nStatus', (px + ex) / 2 - 20, (py + ey) / 2 + 10);
}

// ─ D5 → P5 (pending applications for lecturer review) — bent via right edge
{
  // Route: D5 right → P5
  const [px, py] = ce(P5.cx, P5.cy, R, sR(D5)[0], sR(D5)[1]);
  // Use a two-segment path for clarity
  const midX = sR(D5)[0] + 28;
  const midY = (sR(D5)[1] + py) / 2;
  // Segment 1: D5 right → bend
  doc.moveTo(sR(D5)[0], sR(D5)[1])
     .lineTo(midX, sR(D5)[1])
     .lineTo(midX, py)
     .lineTo(px, py)
     .strokeColor(ARROW_CLR).lineWidth(0.85).stroke();
  head(midX, py, px, py);
  // Label
  doc.rect(midX - 2, sR(D5)[1] - 20, 64, 16).fillColor('white').fill();
  doc.fillColor(GREY_MID).fontSize(6.2).font('Helvetica-Oblique')
     .text('Pending\nApplications', midX + 2, sR(D5)[1] - 19, { width: 58, align: 'center' });
}

// ─ Lecturer → P5 (review decisions)
{
  const [ex, ey] = re(LEC.cx, LEC.cy, LEC.hw, LEC.hh, P5.cx, P5.cy - 6);
  const [px, py] = ce(P5.cx, P5.cy, R, LEC.cx, LEC.cy - 6);
  arrow(ex, ey, px, py, 'Review Decisions\n& Notes', (ex + px) / 2 - 28, (ey + py) / 2 - 14);
}

// ─ P5 → Lecturer (finalized status)
{
  const [px, py] = ce(P5.cx, P5.cy, R, LEC.cx, LEC.cy + 6);
  const [ex, ey] = re(LEC.cx, LEC.cy + 4, LEC.hw, LEC.hh, P5.cx, P5.cy + 6);
  arrow(px, py, ex, ey, 'Application\nFinalized', (px + ex) / 2 + 4, (py + ey) / 2 + 2);
}

// ─ P5 → D5 (update item decisions)
{
  const [px, py] = ce(P5.cx, P5.cy, R, D5.x1 + 130, D5.topY);
  // Two-segment: go down then left
  const midY2 = (py + D5.topY) / 2 + 20;
  doc.moveTo(px, py)
     .lineTo(px, D5.topY)
     .strokeColor(ARROW_CLR).lineWidth(0.85).stroke();
  head(px, py + 10, px, D5.topY);
  doc.rect(px + 3, (py + D5.topY) / 2 - 9, 62, 16).fillColor('white').fill();
  doc.fillColor(GREY_MID).fontSize(6.2).font('Helvetica-Oblique')
     .text('Updated Item\nDecisions', px + 4, (py + D5.topY) / 2 - 8, { width: 60, align: 'center' });
}

// ─ P5 → P6 (trigger report generation)
{
  const [ax, ay] = ce(P5.cx, P5.cy, R, P6.cx, P6.cy);
  const [bx, by] = ce(P6.cx, P6.cy, R, P5.cx, P5.cy);
  arrow(ax, ay, bx, by, 'Finalized\nData', (ax + bx) / 2 + 4, (ay + by) / 2 - 14);
}

// ─ P6 → Lecturer (PDF report download)
{
  const [px, py] = ce(P6.cx, P6.cy, R, LEC.cx, LEC.cy + 14);
  const [ex, ey] = re(LEC.cx, LEC.cy + 8, LEC.hw, LEC.hh, P6.cx, P6.cy + 14);
  arrow(px, py, ex, ey, 'PDF Report', (px + ex) / 2 + 4, (py + ey) / 2 + 4);
}

// ─ P5 → Student (decision notification — long bent arrow along bottom)
{
  // Route: P5 → down → left to Student
  const [px, py] = ce(P5.cx, P5.cy, R, P5.cx, PH);
  const bottomY  = 515;
  const [ex, ey] = re(ST.cx, ST.cy, ST.hw, ST.hh, ST.cx, bottomY);
  doc.moveTo(px, py)
     .lineTo(px, bottomY)
     .lineTo(ex, bottomY)
     .lineTo(ex, ey)
     .strokeColor(ARROW_CLR).lineWidth(0.85).dash(4, { space: 2 }).stroke();
  doc.undash();
  head(ex, bottomY + 10, ex, ey);
  // Label along bottom
  const lblX = (px + ex) / 2 - 32;
  doc.rect(lblX - 1, bottomY - 11, 68, 10).fillColor('white').fill();
  doc.fillColor(GREY_MID).fontSize(6.2).font('Helvetica-Oblique')
     .text('Decision Notification (dashed = async)', lblX, bottomY - 11, { width: 78 });
}

// ── PROCESSES (drawn over arrows) ─────────────────────────────────────────────
proc(P1.cx, P1.cy, R, P1.num, P1.lbl);
proc(P2.cx, P2.cy, R, P2.num, P2.lbl);
proc(P3.cx, P3.cy, R, P3.num, P3.lbl);
proc(P4.cx, P4.cy, R, P4.num, P4.lbl);
proc(P5.cx, P5.cy, R, P5.num, P5.lbl);
proc(P6.cx, P6.cy, R, P6.num, P6.lbl);

// ── EXTERNAL ENTITIES (drawn over arrows) ─────────────────────────────────────
entity(ST.cx,  ST.cy,  'STUDENT');
entity(LEC.cx, LEC.cy, 'LECTURER');

// ── LEGEND ────────────────────────────────────────────────────────────────────
const LX = 26, LY = PH - 92;
doc.rect(LX, LY, 182, 80).fillColor('#f8faff').strokeColor('#bbbbbb').lineWidth(0.5).fillAndStroke();
doc.fillColor(DARK_BLUE).fontSize(8).font('Helvetica-Bold').text('LEGEND', LX + 7, LY + 7);

// Entity sample
doc.rect(LX + 8, LY + 20, 24, 13).fillColor(ENTITY_BG).strokeColor(DARK_BLUE).lineWidth(1.5).fillAndStroke();
doc.rect(LX + 10, LY + 22, 20, 9).strokeColor(DARK_BLUE).lineWidth(0.4).stroke();
doc.fillColor(GREY_DARK).fontSize(7).font('Helvetica').text('External Entity', LX + 36, LY + 23);

// Process sample
doc.circle(LX + 20, LY + 49, 9).fillColor(PROC_BG).strokeColor(MID_BLUE).lineWidth(1.2).fillAndStroke();
doc.moveTo(LX + 12, LY + 46).lineTo(LX + 28, LY + 46).strokeColor(MID_BLUE).lineWidth(0.5).stroke();
doc.fillColor(GREY_DARK).fontSize(7).font('Helvetica').text('Process', LX + 36, LY + 45);

// Data store sample
doc.rect(LX + 8, LY + 60, 24, 10).fillColor(STORE_BG).fill();
doc.moveTo(LX + 8,  LY + 60).lineTo(LX + 32, LY + 60).strokeColor(MID_BLUE).lineWidth(1.1).stroke();
doc.moveTo(LX + 8,  LY + 70).lineTo(LX + 32, LY + 70).strokeColor(MID_BLUE).lineWidth(1.1).stroke();
doc.moveTo(LX + 8,  LY + 60).lineTo(LX + 8,  LY + 70).strokeColor(MID_BLUE).lineWidth(1.1).stroke();
doc.fillColor(GREY_DARK).fontSize(7).font('Helvetica').text('Data Store (open-right)', LX + 36, LY + 62);

// Arrow samples
arrow(LX + 100, LY + 24, LX + 130, LY + 24);
doc.fillColor(GREY_DARK).fontSize(7).font('Helvetica').text('Data Flow', LX + 134, LY + 20);
doc.moveTo(LX + 100, LY + 44).lineTo(LX + 130, LY + 44).strokeColor(ARROW_CLR).lineWidth(0.85).dash(4, { space: 2 }).stroke();
doc.undash(); head(LX + 100, LY + 44, LX + 130, LY + 44);
doc.fillColor(GREY_DARK).fontSize(7).font('Helvetica').text('Async / Notification', LX + 134, LY + 40);

// ── PROCESS INDEX TABLE ───────────────────────────────────────────────────────
const TX = PW - 200, TY = 32;
doc.rect(TX, TY, 172, 148).fillColor('#f8faff').strokeColor('#bbbbbb').lineWidth(0.5).fillAndStroke();
doc.rect(TX, TY, 172, 14).fillColor(DARK_BLUE).fill();
doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold')
   .text('PROCESS INDEX', TX + 5, TY + 3, { width: 162 });

const idx = [
  ['1.0', 'Authenticate User'],
  ['2.0', 'Upload & Parse Documents'],
  ['3.0', 'AI Credit Transfer Analysis'],
  ['4.0', 'Submit & Track Application'],
  ['5.0', 'Lecturer Review & Decide'],
  ['6.0', 'Generate PDF Report'],
];
let iy = TY + 17;
for (const [num, lbl] of idx) {
  doc.rect(TX, iy, 172, 20).fillColor(iy % 40 === (TY + 17) % 40 ? '#f0f4fc' : STORE_BG).fill();
  doc.moveTo(TX, iy).lineTo(TX + 172, iy).strokeColor('#dddddd').lineWidth(0.3).stroke();
  doc.rect(TX, iy, 28, 20).fillColor(LIGHT_BLUE).fill();
  doc.fillColor(MID_BLUE).fontSize(7.5).font('Helvetica-Bold')
     .text(num, TX + 2, iy + 6, { width: 24, align: 'center', lineBreak: false });
  doc.fillColor(GREY_DARK).fontSize(7.5).font('Helvetica')
     .text(lbl, TX + 32, iy + 6, { width: 136, lineBreak: false });
  iy += 20;
}
doc.rect(TX, TY, 172, 148).strokeColor('#bbbbbb').lineWidth(0.5).stroke();

// ── FOOTER ────────────────────────────────────────────────────────────────────
doc.fillColor('#999999').fontSize(7).font('Helvetica')
   .text('Credit Path AI  —  DFD Level 1  —  UMHackathon 2026  —  Yourdon/DeMarco Notation',
     0, PH - 14, { width: PW, align: 'center' });

doc.end();

ws.on('finish', () => console.log(`\n✓ DFD Level 1 generated: ${OUT}\n`));
ws.on('error',  err => { console.error(err.message); process.exit(1); });
