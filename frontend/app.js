// ============================================================
// Mind Map Viewer — app.js
// ============================================================

// ---- Configuration ----
const CONFIG = {
  dataUrl: '../mindmap-output.json',

  nodeWidths:  { root: 280, group: 190, file: 210 },
  nodeHeights: { root: 66,  group: 42,  file: 40  },

  verticalGap:   10,
  horizontalGap: 180,
  padding:       60,

  edgeColor: '#94a3b8',
  edgeWidth: 2,

  animStagger: 0.15,   // seconds per depth level

  zoom: { min: 0.15, max: 3, step: 0.08 },
};

// ---- DOM refs ----
const viewport   = document.getElementById('viewport');
const canvas     = document.getElementById('canvas');
const edgesSvg   = document.getElementById('edges-svg');
const nodesLayer = document.getElementById('nodes-layer');
const tooltip    = document.getElementById('tooltip');
const statsEl    = document.getElementById('stats');
const btnFit     = document.getElementById('btn-fit');
const btnZoomIn  = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---- State ----
let currentScale = 1;
let treeBounds = { width: 0, height: 0 };

// ============================================================
// Data Loading
// ============================================================
async function loadData() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('data') || CONFIG.dataUrl;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch (err) {
    throw new Error(
      `Could not load mind map data from "${url}".\n` +
      'If opening via file://, start a local server:\n' +
      'cd mind-map && python3 -m http.server 8080'
    );
  }
}

// ============================================================
// Tree Building
// ============================================================
function buildTree(data) {
  const map = new Map();
  data.nodes.forEach(n => map.set(n.id, {
    ...n,
    children: [],
    x: 0, y: 0,
    width:  CONFIG.nodeWidths[n.kind]  || 200,
    height: CONFIG.nodeHeights[n.kind] || 42,
    subtreeHeight: 0,
    depth: 0,
    displayLabel: '',
  }));

  let root = null;
  data.nodes.forEach(n => {
    const node = map.get(n.id);
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId).children.push(node);
    }
    if (n.kind === 'root') root = node;
  });

  if (!root) root = [...map.values()].find(n => !n.parentId);

  // Set depths & display labels
  (function walk(node, d) {
    node.depth = d;
    node.displayLabel = displayLabel(node);
    node.children.forEach(c => walk(c, d + 1));
  })(root, 0);

  return root;
}

function displayLabel(node) {
  if (node.kind !== 'file') return node.label;
  const p = node.metadata?.canonicalPath || node.label;
  const segs = p.split('/');
  return segs.length >= 2 ? segs.slice(-2).join('/') : node.label;
}

// ============================================================
// Layout
// ============================================================
function computeSubtreeHeight(node) {
  if (!node.children.length) {
    node.subtreeHeight = node.height;
    return node.height;
  }
  let h = 0;
  node.children.forEach((c, i) => {
    h += computeSubtreeHeight(c);
    if (i > 0) h += CONFIG.verticalGap;
  });
  node.subtreeHeight = Math.max(h, node.height);
  return node.subtreeHeight;
}

function computeXPositions(root) {
  const levelW = [];
  (function collect(n, d) {
    levelW[d] = Math.max(levelW[d] || 0, n.width);
    n.children.forEach(c => collect(c, d + 1));
  })(root, 0);

  const levelX = [CONFIG.padding];
  for (let i = 1; i < levelW.length; i++) {
    levelX[i] = levelX[i - 1] + levelW[i - 1] + CONFIG.horizontalGap;
  }

  (function apply(n, d) {
    n.x = levelX[d];
    n.children.forEach(c => apply(c, d + 1));
  })(root, 0);
}

function computeYPositions(node, yStart) {
  if (!node.children.length) {
    node.y = yStart + (node.subtreeHeight - node.height) / 2;
    return;
  }
  let cur = yStart;
  node.children.forEach((c, i) => {
    computeYPositions(c, cur);
    cur += c.subtreeHeight + CONFIG.verticalGap;
  });
  const first = node.children[0];
  const last  = node.children[node.children.length - 1];
  node.y = (first.y + first.height / 2 + last.y + last.height / 2) / 2 - node.height / 2;
}

function computeBounds(root) {
  let maxX = 0, maxY = 0;
  (function walk(n) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
    n.children.forEach(walk);
  })(root);
  return { width: maxX + CONFIG.padding, height: maxY + CONFIG.padding };
}

// ============================================================
// Rendering — Nodes
// ============================================================
function renderNodes(node) {
  const el = document.createElement('div');
  el.className = `node node--${node.kind}`;
  el.style.left   = node.x + 'px';
  el.style.top    = node.y + 'px';
  el.style.width  = node.width + 'px';
  el.style.height = node.height + 'px';
  el.style.animationDelay = (node.depth * CONFIG.animStagger) + 's';
  el.textContent  = node.displayLabel;
  el.dataset.nodeId = node.id;

  // Chevron-out indicator (right side) for nodes with children
  if (node.children.length) {
    const chev = document.createElement('span');
    chev.className = 'chevron chevron--out';
    chev.textContent = '\u203A';  // ›
    chev.style.left = (node.width + 6) + 'px';
    chev.style.animationDelay = (node.depth * CONFIG.animStagger) + 's';
    el.appendChild(chev);
  }

  // Tooltip
  el.addEventListener('mouseenter', e => showTooltip(node, e.clientX, e.clientY));
  el.addEventListener('mousemove',  e => moveTooltip(e.clientX, e.clientY));
  el.addEventListener('mouseleave', hideTooltip);

  nodesLayer.appendChild(el);
  node.children.forEach(c => renderNodes(c));
}

// ============================================================
// Rendering — Edges (SVG bezier curves)
// ============================================================
function renderEdges(node) {
  node.children.forEach(child => {
    drawEdge(node, child);
    renderEdges(child);
  });
}

function drawEdge(parent, child) {
  const sx = parent.x + parent.width + 26;   // after chevron
  const sy = parent.y + parent.height / 2;
  const tx = child.x;
  const ty = child.y + child.height / 2;
  const mx = (sx + tx) / 2;

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`);
  path.setAttribute('class', 'edge-path');

  edgesSvg.appendChild(path);

  // Animate: draw path left→right
  const len = path.getTotalLength();
  path.style.strokeDasharray  = len;
  path.style.strokeDashoffset = len;
  path.style.transition = `stroke-dashoffset 0.5s ease-out`;
  path.style.transitionDelay  = (child.depth * CONFIG.animStagger + 0.1) + 's';

  requestAnimationFrame(() =>
    requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; })
  );
}

// ============================================================
// Tooltip
// ============================================================
function showTooltip(node, x, y) {
  let html = `<div class="tooltip-label">${esc(node.label)}</div>`;
  if (node.metadata?.canonicalPath)
    html += `<div class="tooltip-path">${esc(node.metadata.canonicalPath)}</div>`;
  if (node.type && node.kind !== 'root')
    html += `<div class="tooltip-type">${esc(node.type)}</div>`;

  const parts = [];
  if (node.metadata?.importance) parts.push(node.metadata.importance);
  if (node.metadata?.language)   parts.push(node.metadata.language);
  if (node.confidence != null)   parts.push(`confidence ${(node.confidence * 100).toFixed(0)}%`);
  if (parts.length) html += `<div class="tooltip-meta">${parts.join(' · ')}</div>`;

  tooltip.innerHTML = html;
  tooltip.classList.remove('hidden');
  moveTooltip(x, y);
}

function moveTooltip(x, y) {
  const off = 14;
  const r = tooltip.getBoundingClientRect();
  let left = x + off, top = y + off;
  if (left + r.width  > window.innerWidth  - 8)  left = x - r.width  - off;
  if (top  + r.height > window.innerHeight - 8)  top  = y - r.height - off;
  tooltip.style.left = left + 'px';
  tooltip.style.top  = top  + 'px';
}

function hideTooltip() { tooltip.classList.add('hidden'); }

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ============================================================
// Zoom & Pan
// ============================================================
function setZoom(s) {
  currentScale = Math.min(CONFIG.zoom.max, Math.max(CONFIG.zoom.min, s));
  canvas.style.transform = `scale(${currentScale})`;
}

function fitToScreen() {
  const vr = viewport.getBoundingClientRect();
  const sx = vr.width  / treeBounds.width;
  const sy = vr.height / treeBounds.height;
  currentScale = Math.min(sx, sy, 1) * 0.92;
  canvas.style.transform = `scale(${currentScale})`;

  // Center the map
  const cw = treeBounds.width  * currentScale;
  const ch = treeBounds.height * currentScale;
  canvas.style.marginLeft = Math.max(0, (vr.width  - cw) / 2) + 'px';
  canvas.style.marginTop  = Math.max(0, (vr.height - ch) / 2) + 'px';

  viewport.scrollLeft = 0;
  viewport.scrollTop  = 0;
}

btnFit.addEventListener('click', fitToScreen);
btnZoomIn.addEventListener('click',  () => { setZoom(currentScale + CONFIG.zoom.step); canvas.style.marginLeft = '0'; canvas.style.marginTop = '0'; });
btnZoomOut.addEventListener('click', () => { setZoom(currentScale - CONFIG.zoom.step); canvas.style.marginLeft = '0'; canvas.style.marginTop = '0'; });

viewport.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -CONFIG.zoom.step : CONFIG.zoom.step;
    setZoom(currentScale + delta);
    canvas.style.marginLeft = '0';
    canvas.style.marginTop  = '0';
  }
}, { passive: false });

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'f' || e.key === 'F') fitToScreen();
  if (e.key === '=' || e.key === '+') { setZoom(currentScale + CONFIG.zoom.step); e.preventDefault(); }
  if (e.key === '-')                  { setZoom(currentScale - CONFIG.zoom.step); e.preventDefault(); }
});

// ============================================================
// Init
// ============================================================
async function init() {
  try {
    const data = await loadData();
    statsEl.textContent = `${data.nodes.length} nodes \u00B7 ${data.edges.length} edges`;

    const root = buildTree(data);

    // Layout
    computeSubtreeHeight(root);
    computeXPositions(root);
    computeYPositions(root, CONFIG.padding);
    treeBounds = computeBounds(root);

    // Size canvas & SVG
    canvas.style.width  = treeBounds.width  + 'px';
    canvas.style.height = treeBounds.height + 'px';
    edgesSvg.setAttribute('width',  treeBounds.width);
    edgesSvg.setAttribute('height', treeBounds.height);

    // Render
    renderNodes(root);
    renderEdges(root);

    // Fit on first load
    requestAnimationFrame(fitToScreen);

  } catch (err) {
    console.error(err);
    document.getElementById('app').innerHTML =
      `<div class="error-message"><p>${esc(err.message)}</p></div>`;
  }
}

init();
