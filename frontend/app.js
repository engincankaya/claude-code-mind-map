// ============================================================
// Mind Map Viewer — app.js
// ============================================================

// ---- Configuration ----
const CONFIG = {
  dataUrl: '../mindmap-output.json',

  nodeWidths:  { root: 280, group: 260, file: 210 },
  nodeHeights: { root: 66,  group: 62,  file: 40  },

  detailCard: { width: 320, padding: 16 },

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
let rootNode = null;
let rawData = null;
let nodeMap = new Map();        // id → tree node (for edge lookups)
let activeDetailCard = null;    // currently open detail card
let activeDetailEdge = null;    // SVG edge to detail card

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
    collapsed: n.kind === 'group',
    _allChildren: [],
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

  (function walk(node, d) {
    node.depth = d;
    node.displayLabel = displayLabel(node);
    node._allChildren = [...node.children];
    if (node.collapsed) {
      node.children = [];
    }
    node._allChildren.forEach(c => walk(c, d + 1));
  })(root, 0);

  // Store global nodeMap for edge lookups
  nodeMap = map;

  return root;
}

function displayLabel(node) {
  if (node.kind !== 'file') return node.label;
  const p = node.metadata?.canonicalPath || node.label;
  const segs = p.split('/');
  return segs.length >= 2 ? segs.slice(-2).join('/') : node.label;
}

// ============================================================
// Explain — compute /explain data from edges
// ============================================================
function computeExplain(node) {
  const edges = rawData.edges;
  const nodeId = node.id;

  // Find group (parent)
  const groupNode = node.parentId ? nodeMap.get(node.parentId) : null;

  // Outgoing: this file depends on
  const outgoing = edges
    .filter(e => e.source === nodeId)
    .map(e => ({
      target: nodeMap.get(e.target),
      rels: e.rels,
      label: e.label || e.metadata?.annotation || e.rels.join(', '),
    }))
    .filter(e => e.target);

  // Incoming: files that depend on this
  const incoming = edges
    .filter(e => e.target === nodeId)
    .map(e => ({
      source: nodeMap.get(e.source),
      rels: e.rels,
      label: e.label || e.metadata?.annotation || e.rels.join(', '),
    }))
    .filter(e => e.source);

  // Cross-group: collect unique group names
  const myGroupId = node.parentId;
  const crossGroupEdges = [...outgoing, ...incoming].filter(e => {
    const other = e.target || e.source;
    return other && other.parentId !== myGroupId;
  });

  // Group cross-group by target group name
  const crossGroupMap = new Map();
  crossGroupEdges.forEach(e => {
    const other = e.target || e.source;
    const otherGroup = other.parentId ? nodeMap.get(other.parentId) : null;
    const groupLabel = otherGroup ? otherGroup.label : 'Root';
    if (!crossGroupMap.has(groupLabel)) crossGroupMap.set(groupLabel, []);
    const otherLabel = other.displayLabel || other.label;
    if (!crossGroupMap.get(groupLabel).includes(otherLabel)) {
      crossGroupMap.get(groupLabel).push(otherLabel);
    }
  });

  // Generate summary sentence
  const totalEdges = outgoing.length + incoming.length;
  const groupCount = crossGroupMap.size;
  let summary = '';
  if (totalEdges === 0) {
    summary = 'This file has no dependency edges — it is architecturally isolated.';
  } else if (groupCount === 0) {
    summary = `All ${totalEdges} connections stay within the ${groupNode ? groupNode.label : 'same'} group. Safe to modify locally.`;
  } else {
    const allGroups = new Set();
    crossGroupEdges.forEach(e => {
      const o = e.target || e.source;
      if (o?.parentId) {
        const g = nodeMap.get(o.parentId);
        if (g) allGroups.add(g.label);
      }
    });
    if (groupNode) allGroups.add(groupNode.label);
    summary = `Bridges ${allGroups.size} of ${countGroups()} groups. Changes here risk cascading across the architecture.`;
  }

  return {
    role: node.type || node.metadata?.role || 'Unknown',
    group: groupNode ? groupNode.label : 'Root',
    groupType: groupNode ? groupNode.type : '',
    groupDescription: groupNode?.metadata?.description || '',
    importance: node.metadata?.importance || 'unknown',
    language: node.metadata?.language || '',
    path: node.metadata?.canonicalPath || node.label,
    confidence: node.confidence,
    outgoing,
    incoming,
    crossGroupEdges,
    crossGroupMap,
    summary,
  };
}

function countGroups() {
  let c = 0;
  rawData.nodes.forEach(n => { if (n.kind === 'group') c++; });
  return c;
}

// ============================================================
// Explain Group — compute aggregate analysis for a group node
// ============================================================
function computeExplainGroup(node) {
  const edges = rawData.edges;

  // All child file IDs in this group
  const childIds = new Set(node._allChildren.map(c => c.id));

  // Files with their metadata
  const files = node._allChildren.map(c => ({
    id: c.id,
    label: c.displayLabel || c.label,
    role: c.type || c.metadata?.role || 'Unknown',
    importance: c.metadata?.importance || 'unknown',
    language: c.metadata?.language || '',
  }));

  // Internal edges (both source and target within this group)
  const internalEdges = edges.filter(e => childIds.has(e.source) && childIds.has(e.target));

  // External outgoing (source in group, target outside)
  const externalOutgoing = edges
    .filter(e => childIds.has(e.source) && !childIds.has(e.target))
    .map(e => ({
      source: nodeMap.get(e.source),
      target: nodeMap.get(e.target),
      rels: e.rels,
      label: e.label || e.metadata?.annotation || e.rels.join(', '),
    }))
    .filter(e => e.target);

  // External incoming (target in group, source outside)
  const externalIncoming = edges
    .filter(e => childIds.has(e.target) && !childIds.has(e.source))
    .map(e => ({
      source: nodeMap.get(e.source),
      target: nodeMap.get(e.target),
      rels: e.rels,
      label: e.label || e.metadata?.annotation || e.rels.join(', '),
    }))
    .filter(e => e.source);

  // Group external outgoing by target group
  const outgoingGroupMap = new Map();
  externalOutgoing.forEach(e => {
    const targetGroup = e.target.parentId ? nodeMap.get(e.target.parentId) : null;
    const groupLabel = targetGroup ? targetGroup.label : 'Root';
    if (!outgoingGroupMap.has(groupLabel)) outgoingGroupMap.set(groupLabel, []);
    const name = e.target.displayLabel || e.target.label;
    if (!outgoingGroupMap.get(groupLabel).find(f => f.name === name)) {
      outgoingGroupMap.get(groupLabel).push({ name, rels: e.rels });
    }
  });

  // Group external incoming by source group
  const incomingGroupMap = new Map();
  externalIncoming.forEach(e => {
    const sourceGroup = e.source.parentId ? nodeMap.get(e.source.parentId) : null;
    const groupLabel = sourceGroup ? sourceGroup.label : 'Root';
    if (!incomingGroupMap.has(groupLabel)) incomingGroupMap.set(groupLabel, []);
    const name = e.source.displayLabel || e.source.label;
    if (!incomingGroupMap.get(groupLabel).find(f => f.name === name)) {
      incomingGroupMap.get(groupLabel).push({ name, rels: e.rels });
    }
  });

  // Summary
  const coreCount = files.filter(f => f.importance === 'core').length;
  const crossGroupCount = new Set([...outgoingGroupMap.keys(), ...incomingGroupMap.keys()]).size;
  const extEdgeCount = externalOutgoing.length + externalIncoming.length;

  let summary = '';
  if (crossGroupCount === 0) {
    summary = `Self-contained group with ${files.length} files and ${internalEdges.length} internal connections. No external dependencies.`;
  } else {
    summary = `${files.length} files (${coreCount} core). Connected to ${crossGroupCount} other group${crossGroupCount > 1 ? 's' : ''} via ${extEdgeCount} external edge${extEdgeCount > 1 ? 's' : ''}.`;
  }

  return {
    description: node.metadata?.description || '',
    type: node.type || '',
    files,
    internalEdgeCount: internalEdges.length,
    externalOutgoing,
    externalIncoming,
    outgoingGroupMap,
    incomingGroupMap,
    summary,
  };
}

// ============================================================
// Detail Card — helpers
// ============================================================
function addSection(card, title, contentHtml) {
  const section = document.createElement('div');
  section.className = 'detail-section';
  if (title) {
    const label = document.createElement('div');
    label.className = 'detail-section-label';
    label.textContent = title;
    section.appendChild(label);
  }
  const value = document.createElement('div');
  value.className = 'detail-section-value';
  value.innerHTML = contentHtml;
  section.appendChild(value);
  card.appendChild(section);
}

function drawDetailEdge(node, cardX, cardY, card) {
  const sx = node.x + node.width;
  const sy = node.y + node.height / 2;
  const tx = cardX;
  const cardHeight = card.getBoundingClientRect().height / currentScale;
  const ty = cardY + Math.min(cardHeight / 2, 30);
  const mx = (sx + tx) / 2;

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`);
  path.setAttribute('class', 'edge-path edge-path--detail');
  edgesSvg.appendChild(path);
  activeDetailEdge = path;
}

// ============================================================
// Detail Card — render /explain output as a connected card
// ============================================================
function showDetailCard(node) {
  closeDetailCard();

  if (node.kind === 'group') {
    showGroupDetailCard(node);
    return;
  }

  const explain = computeExplain(node);
  const card = document.createElement('div');
  card.className = 'detail-card';

  const cardX = node.x + node.width + 60;
  const cardY = node.y - 20;
  card.style.left = cardX + 'px';
  card.style.top  = cardY + 'px';
  card.style.width = CONFIG.detailCard.width + 'px';

  // ── Header: file name + path + close button ──
  const header = document.createElement('div');
  header.className = 'detail-header';
  header.innerHTML = `
    <div>
      <div class="detail-title">${esc(node.displayLabel)}</div>
      <div class="detail-path">${esc(explain.path)}</div>
    </div>
    <button class="detail-close">&times;</button>
  `;
  card.appendChild(header);
  header.querySelector('.detail-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeDetailCard();
  });

  // ── 1. Role ──
  addSection(card, 'Role', `<div class="detail-role-text">${esc(explain.role)}</div>`);

  // ── 2. Group ──
  const groupHtml = `<span class="detail-badge detail-badge--group">${esc(explain.group)}</span>
    <span class="detail-group-desc">${explain.groupType ? '(' + esc(explain.groupType) + ')' : ''}</span>`;
  addSection(card, 'Group', groupHtml);

  // ── 3. Importance + Language + Confidence ──
  const metaHtml = `
    <div class="detail-meta-row">
      <span class="detail-badge detail-badge--importance detail-badge--${explain.importance}">${explain.importance}</span>
      ${explain.language ? `<span class="detail-badge detail-badge--lang">${explain.language}</span>` : ''}
      ${explain.confidence != null ? `<span class="detail-badge detail-badge--confidence">confidence ${(explain.confidence * 100).toFixed(0)}%</span>` : ''}
    </div>`;
  addSection(card, 'Importance', metaHtml);

  // ── 4. Dependencies (outgoing edges) with annotations ──
  if (explain.outgoing.length) {
    const depHtml = explain.outgoing.map(e => {
      const name = e.target.displayLabel || e.target.label;
      const relTags = e.rels.map(r => `<span class="detail-rel-tag detail-rel--${r}">${r}</span>`).join('');
      return `<div class="detail-edge-item" data-target-id="${e.target.id}">
        <span class="detail-edge-arrow">\u2192</span>
        <span class="detail-edge-name" data-node-id="${e.target.id}">${esc(name)}</span>
        ${relTags}
        <div class="detail-edge-annotation">${esc(e.label)}</div>
      </div>`;
    }).join('');
    addSection(card, `Dependencies (${explain.outgoing.length})`, `<div class="detail-edge-list">${depHtml}</div>`);
  }

  // ── 5. Dependents (incoming edges) with annotations ──
  if (explain.incoming.length) {
    const incHtml = explain.incoming.map(e => {
      const name = e.source.displayLabel || e.source.label;
      const relTags = e.rels.map(r => `<span class="detail-rel-tag detail-rel--${r}">${r}</span>`).join('');
      return `<div class="detail-edge-item" data-target-id="${e.source.id}">
        <span class="detail-edge-arrow">\u2190</span>
        <span class="detail-edge-name" data-node-id="${e.source.id}">${esc(name)}</span>
        ${relTags}
        <div class="detail-edge-annotation">${esc(e.label)}</div>
      </div>`;
    }).join('');
    addSection(card, `Dependents (${explain.incoming.length})`, `<div class="detail-edge-list">${incHtml}</div>`);
  }

  // ── 6. Cross-group connections (detailed) ──
  if (explain.crossGroupMap.size) {
    const myGroup = explain.group;
    let crossHtml = '';
    explain.crossGroupMap.forEach((files, groupLabel) => {
      crossHtml += `<div class="detail-cross-item">
        <span class="detail-cross-route">${esc(myGroup)} \u2192 ${esc(groupLabel)}</span>
        <span class="detail-cross-files">${files.map(f => esc(f)).join(', ')}</span>
      </div>`;
    });
    addSection(card, `Cross-group (${explain.crossGroupMap.size} boundaries)`, `<div class="detail-cross-list">${crossHtml}</div>`);
  }

  // ── 7. Summary (Claude-style insight) ──
  const summaryEl = document.createElement('div');
  summaryEl.className = 'detail-summary';
  summaryEl.innerHTML = explain.summary;
  card.appendChild(summaryEl);

  // No edges at all
  if (!explain.outgoing.length && !explain.incoming.length) {
    addSection(card, '', '<div class="detail-empty">No dependency edges found. This file is architecturally isolated.</div>');
  }

  nodesLayer.appendChild(card);
  activeDetailCard = card;

  // Wire up click handlers on edge names
  card.querySelectorAll('.detail-edge-name').forEach(el => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      highlightNode(el.dataset.nodeId);
    });
  });

  // Draw connecting edge from node to card
  drawDetailEdge(node, cardX, cardY, card);

  // Highlight the source node
  const sourceEl = nodesLayer.querySelector(`[data-node-id="${node.id}"]`);
  if (sourceEl) sourceEl.classList.add('node--selected');
}

// ============================================================
// Group Detail Card — render group-level analysis
// ============================================================
function showGroupDetailCard(node) {
  const explain = computeExplainGroup(node);
  const card = document.createElement('div');
  card.className = 'detail-card detail-card--group';

  const cardX = node.x + node.width + 60;
  const cardY = node.y - 20;
  card.style.left = cardX + 'px';
  card.style.top  = cardY + 'px';
  card.style.width = '360px';

  // ── Header ──
  const header = document.createElement('div');
  header.className = 'detail-header';
  header.innerHTML = `
    <div style="min-width:0">
      <div class="detail-title">${esc(node.displayLabel)}</div>
      ${explain.description ? `<div class="detail-path">${esc(explain.description)}</div>` : ''}
    </div>
    <button class="detail-close">&times;</button>
  `;
  card.appendChild(header);
  header.querySelector('.detail-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeDetailCard();
  });

  // ── 1. Type ──
  if (explain.type) {
    addSection(card, 'Type', `<div class="detail-role-text">${esc(explain.type)}</div>`);
  }

  // ── 2. Overview badges ──
  const coreCount = explain.files.filter(f => f.importance === 'core').length;
  const supportingCount = explain.files.filter(f => f.importance === 'supporting').length;
  const peripheralCount = explain.files.filter(f => f.importance === 'peripheral').length;
  const statsHtml = `
    <div class="detail-meta-row">
      <span class="detail-badge detail-badge--group">${explain.files.length} files</span>
      <span class="detail-badge detail-badge--group">${explain.internalEdgeCount} internal edges</span>
      ${coreCount ? `<span class="detail-badge detail-badge--core">${coreCount} core</span>` : ''}
      ${supportingCount ? `<span class="detail-badge detail-badge--supporting">${supportingCount} supporting</span>` : ''}
      ${peripheralCount ? `<span class="detail-badge detail-badge--peripheral">${peripheralCount} peripheral</span>` : ''}
    </div>`;
  addSection(card, 'Overview', statsHtml);

  // ── 3. Files list (two-row layout) ──
  if (explain.files.length) {
    const filesHtml = explain.files.map(f => {
      const impClass = f.importance ? `detail-badge--${f.importance}` : '';
      return `<div class="detail-file-item">
        <div class="detail-file-top">
          <span class="detail-edge-name" data-node-id="${f.id}">${esc(f.label)}</span>
          <span class="detail-badge ${impClass}">${f.importance}</span>
          ${f.language ? `<span class="detail-badge detail-badge--lang">${f.language}</span>` : ''}
        </div>
        <div class="detail-file-role">${esc(f.role)}</div>
      </div>`;
    }).join('');
    addSection(card, `Files (${explain.files.length})`, `<div class="detail-file-list">${filesHtml}</div>`);
  }

  // ── 4. Depends on ──
  if (explain.outgoingGroupMap.size) {
    let html = '';
    explain.outgoingGroupMap.forEach((files, groupLabel) => {
      const fileNames = files.map(f => esc(f.name)).join(', ');
      html += `<div class="detail-cross-item">
        <div class="detail-cross-route">${esc(node.label)} \u2192 ${esc(groupLabel)}</div>
        <div class="detail-cross-files">${fileNames}</div>
      </div>`;
    });
    addSection(card, `Depends on (${explain.outgoingGroupMap.size} groups)`, `<div class="detail-cross-list">${html}</div>`);
  }

  // ── 5. Depended on by ──
  if (explain.incomingGroupMap.size) {
    let html = '';
    explain.incomingGroupMap.forEach((files, groupLabel) => {
      const fileNames = files.map(f => esc(f.name)).join(', ');
      html += `<div class="detail-cross-item">
        <div class="detail-cross-route">${esc(groupLabel)} \u2192 ${esc(node.label)}</div>
        <div class="detail-cross-files">${fileNames}</div>
      </div>`;
    });
    addSection(card, `Depended on by (${explain.incomingGroupMap.size} groups)`, `<div class="detail-cross-list">${html}</div>`);
  }

  // ── 6. Summary ──
  const summaryEl = document.createElement('div');
  summaryEl.className = 'detail-summary';
  summaryEl.innerHTML = explain.summary;
  card.appendChild(summaryEl);

  nodesLayer.appendChild(card);
  activeDetailCard = card;

  // Wire up click handlers on file names
  card.querySelectorAll('.detail-edge-name').forEach(el => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const targetId = el.dataset.nodeId;
      if (node.collapsed) {
        toggleCollapse(node);
        setTimeout(() => highlightNode(targetId), 100);
      } else {
        highlightNode(targetId);
      }
    });
  });

  // Draw connecting edge from node to card
  drawDetailEdge(node, cardX, cardY, card);

  // Highlight the source node
  const srcEl = nodesLayer.querySelector(`[data-node-id="${node.id}"]`);
  if (srcEl) srcEl.classList.add('node--selected');
}

function closeDetailCard() {
  if (activeDetailCard) {
    activeDetailCard.remove();
    activeDetailCard = null;
  }
  if (activeDetailEdge) {
    activeDetailEdge.remove();
    activeDetailEdge = null;
  }
  // Remove all highlights
  nodesLayer.querySelectorAll('.node--selected').forEach(el => el.classList.remove('node--selected'));
  nodesLayer.querySelectorAll('.node--highlighted').forEach(el => el.classList.remove('node--highlighted'));
}

function highlightNode(nodeId) {
  // Remove previous highlights (but keep selected)
  nodesLayer.querySelectorAll('.node--highlighted').forEach(el => el.classList.remove('node--highlighted'));

  const el = nodesLayer.querySelector(`[data-node-id="${nodeId}"]`);
  if (el) {
    el.classList.add('node--highlighted');
    // Scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
}

// ============================================================
// Collapse / Expand
// ============================================================
function toggleCollapse(node) {
  if (!node._allChildren.length) return;
  node.collapsed = !node.collapsed;
  node.children = node.collapsed ? [] : [...node._allChildren];
  closeDetailCard();
  relayout();
}

function relayout() {
  nodesLayer.innerHTML = '';
  edgesSvg.innerHTML = '';

  computeSubtreeHeight(rootNode);
  computeXPositions(rootNode);
  computeYPositions(rootNode, CONFIG.padding);
  treeBounds = computeBounds(rootNode);

  canvas.style.width  = treeBounds.width  + 'px';
  canvas.style.height = treeBounds.height + 'px';
  edgesSvg.setAttribute('width',  treeBounds.width);
  edgesSvg.setAttribute('height', treeBounds.height);

  renderNodes(rootNode);
  renderEdges(rootNode);
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
  // Extra space for potential detail cards on the right
  return { width: maxX + CONFIG.padding + CONFIG.detailCard.width + 80, height: maxY + CONFIG.padding };
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
  el.dataset.nodeId = node.id;

  // Group nodes: two-line layout (label + description)
  if (node.kind === 'group') {
    const content = document.createElement('div');
    content.className = 'node-group-content';

    // Top row: label + toggle + badge
    const topRow = document.createElement('div');
    topRow.className = 'node-group-top';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'node-label';
    labelSpan.textContent = node.displayLabel;
    topRow.appendChild(labelSpan);

    const toggle = document.createElement('span');
    toggle.className = 'collapse-toggle' + (node.collapsed ? '' : ' collapse-toggle--open');
    toggle.textContent = '\u25B6';
    toggle.title = node.collapsed
      ? `Expand (${node._allChildren.length} files)`
      : 'Collapse';
    topRow.appendChild(toggle);

    if (node.collapsed) {
      const badge = document.createElement('span');
      badge.className = 'file-count-badge';
      badge.textContent = node._allChildren.length;
      topRow.appendChild(badge);
    }

    content.appendChild(topRow);

    // Bottom row: description
    const desc = node.metadata?.description;
    if (desc) {
      const descSpan = document.createElement('div');
      descSpan.className = 'node-group-desc';
      descSpan.textContent = desc;
      content.appendChild(descSpan);
    }

    el.appendChild(content);

    // Chevron: collapse/expand
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapse(node);
    });

    // Body: show group detail card
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showDetailCard(node);
    });
    el.classList.add('node--clickable');
  } else {
    // Non-group nodes: simple label
    const labelSpan = document.createElement('span');
    labelSpan.className = 'node-label';
    labelSpan.textContent = node.displayLabel;
    el.appendChild(labelSpan);
  }

  // File nodes: click to show detail card
  if (node.kind === 'file') {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showDetailCard(node);
    });
    el.classList.add('node--clickable');
  }

  // Chevron-out indicator (right side) for nodes with visible children
  if (node.children.length) {
    const chev = document.createElement('span');
    chev.className = 'chevron chevron--out';
    chev.textContent = '\u203A';
    chev.style.left = (node.width + 6) + 'px';
    chev.style.animationDelay = (node.depth * CONFIG.animStagger) + 's';
    el.appendChild(chev);
  }

  // Tooltip (only on hover, not on click)
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
  const sx = parent.x + parent.width + 26;
  const sy = parent.y + parent.height / 2;
  const tx = child.x;
  const ty = child.y + child.height / 2;
  const mx = (sx + tx) / 2;

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`);
  path.setAttribute('class', 'edge-path');

  edgesSvg.appendChild(path);

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
  if (node.metadata?.description)
    html += `<div class="tooltip-desc">${esc(node.metadata.description)}</div>`;

  const parts = [];
  if (node.metadata?.importance) parts.push(node.metadata.importance);
  if (node.metadata?.language)   parts.push(node.metadata.language);
  if (node.confidence != null)   parts.push(`confidence ${(node.confidence * 100).toFixed(0)}%`);
  if (node.kind === 'group' && node._allChildren.length)
    parts.push(`${node._allChildren.length} files`);
  if (node.kind === 'file' || node.kind === 'group')
    parts.push('click for details');
  if (parts.length) html += `<div class="tooltip-meta">${parts.join(' \u00B7 ')}</div>`;

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

// Close detail card when clicking empty space
viewport.addEventListener('click', (e) => {
  if (e.target === viewport || e.target === canvas || e.target === nodesLayer) {
    closeDetailCard();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDetailCard();
  if (e.key === 'f' || e.key === 'F') fitToScreen();
  if (e.key === '=' || e.key === '+') { setZoom(currentScale + CONFIG.zoom.step); e.preventDefault(); }
  if (e.key === '-')                  { setZoom(currentScale - CONFIG.zoom.step); e.preventDefault(); }
});

// ============================================================
// Init
// ============================================================
async function init() {
  try {
    rawData = await loadData();
    statsEl.textContent = `${rawData.nodes.length} nodes \u00B7 ${rawData.edges.length} edges`;

    rootNode = buildTree(rawData);

    computeSubtreeHeight(rootNode);
    computeXPositions(rootNode);
    computeYPositions(rootNode, CONFIG.padding);
    treeBounds = computeBounds(rootNode);

    canvas.style.width  = treeBounds.width  + 'px';
    canvas.style.height = treeBounds.height + 'px';
    edgesSvg.setAttribute('width',  treeBounds.width);
    edgesSvg.setAttribute('height', treeBounds.height);

    renderNodes(rootNode);
    renderEdges(rootNode);

    requestAnimationFrame(fitToScreen);

  } catch (err) {
    console.error(err);
    document.getElementById('app').innerHTML =
      `<div class="error-message"><p>${esc(err.message)}</p></div>`;
  }
}

init();
