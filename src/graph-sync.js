const fs = require('fs');
const path = require('path');
const { MEMORY_BASE, loadConfig } = require('./utils');

const GRAPH_DIR = path.join(MEMORY_BASE, 'graph');
const GRAPH_FILE = path.join(GRAPH_DIR, 'connections.yaml');

let _graphDirExists = false;
let _graphCache = null;
let _canvasDirExists = false;

const COLOR_MAP = { blocked:'1','in-progress':'2',planned:'3',completed:'4',active:'4',decision:'5',agent:'6' };
const ROW_Y = { project:0, decision:150, task:300, agent:0 };
const NODE_DIMS = { project:{width:200,height:80}, decision:{width:160,height:60}, task:{width:120,height:50}, agent:{width:160,height:60} };

function serializeYaml(graph) {
  const lines = [`version: ${graph.version}`, `last_updated: ${graph.last_updated}`, '', 'nodes:'];
  for (const n of graph.nodes || []) {
    lines.push(`  - id: "${n.id}"`, `    type: ${n.type}`, `    label: "${n.label}"`);
    if (n.status) lines.push(`    status: ${n.status}`);
    if (n.project) lines.push(`    project: "${n.project}"`);
    if (n.date) lines.push(`    date: ${n.date}`);
    if (n.memory_id) lines.push(`    memory_id: "${n.memory_id}"`);
    if (n.created) lines.push(`    created: ${n.created}`);
  }
  lines.push('', 'edges:');
  for (const e of graph.edges || []) {
    lines.push(`  - id: "${e.id}"`, `    from: "${e.from}"`, `    to: "${e.to}"`, `    relationship: ${e.relationship}`);
    if (e.label) lines.push(`    label: "${e.label}"`);
  }
  return lines.join('\n') + '\n';
}

function parseGraphYaml(content) {
  const graph = { version: 1, last_updated: '', nodes: [], edges: [] };
  if (!content) return graph;
  const vM = content.match(/^version:\s*(\d+)/m);
  if (vM) graph.version = parseInt(vM[1], 10);
  const dM = content.match(/^last_updated:\s*(.+)/m);
  if (dM) graph.last_updated = dM[1].trim();
  const nS = content.match(/^nodes:\s*\n([\s\S]*?)(?=^edges:)/m) || content.match(/^nodes:\s*\n([\s\S]*)$/m);
  if (nS) graph.nodes = parseItems(nS[1]);
  const eS = content.match(/^edges:\s*\n([\s\S]*)$/m);
  if (eS) graph.edges = parseItems(eS[1]);
  return graph;
}

function parseItems(block) {
  const items = [];
  let cur = null;
  for (const line of block.split('\n')) {
    if (/^\s+-\s+\w+:/.test(line)) { if (cur) items.push(cur); cur = {}; }
    const kv = line.replace(/^\s*-\s+/, '  ').match(/^\s+(\w[\w_]*):\s*"?([^"]*)"?\s*$/);
    if (kv && cur) cur[kv[1]] = kv[2];
  }
  if (cur) items.push(cur);
  return items;
}

function loadGraph() {
  if (_graphCache) return _graphCache;
  try { _graphCache = parseGraphYaml(fs.readFileSync(GRAPH_FILE, 'utf8')); }
  catch { _graphCache = { version: 1, last_updated: '', nodes: [], edges: [] }; }
  return _graphCache;
}

function saveGraph(graph) {
  if (!_graphDirExists) { fs.mkdirSync(GRAPH_DIR, { recursive: true }); _graphDirExists = true; }
  graph.last_updated = new Date().toISOString().slice(0, 10);
  _graphCache = graph;
  fs.writeFileSync(GRAPH_FILE, serializeYaml(graph), 'utf8');
}

function detectCycles(graph) {
  const adj = {};
  for (const e of graph.edges) { if (!adj[e.from]) adj[e.from] = []; adj[e.from].push(e.to); }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  const cycles = [];
  for (const n of graph.nodes) {
    if ((color[n.id] || WHITE) !== WHITE) continue;
    const stack = [{ node: n.id, idx: 0 }];
    color[n.id] = GRAY;
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adj[frame.node] || [];
      if (frame.idx >= neighbors.length) { color[frame.node] = BLACK; stack.pop(); continue; }
      const next = neighbors[frame.idx++];
      const c = color[next] || WHITE;
      if (c === GRAY) cycles.push(`${frame.node} -> ${next}`);
      else if (c === WHITE) { color[next] = GRAY; stack.push({ node: next, idx: 0 }); }
    }
  }
  return cycles;
}

function updateGraph(digest) {
  const graph = loadGraph();
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const edgeIds = new Set(graph.edges.map((e) => e.id));
  const projectId = `proj-${digest.project}`;
  if (!nodeIds.has(projectId)) {
    graph.nodes.push({ id: projectId, type: 'project', label: digest.project, status: 'active', created: digest.date });
    nodeIds.add(projectId);
  }
  if (digest.type === 'decision' || digest.type === 'session') {
    const decId = `dec-${digest.id}`;
    if (!nodeIds.has(decId)) {
      graph.nodes.push({ id: decId, type: 'decision', label: (digest.title || '').slice(0, 60), project: projectId, date: digest.date, memory_id: digest.id });
      const edgeId = `e-${decId}-${projectId}`;
      if (!edgeIds.has(edgeId)) graph.edges.push({ id: edgeId, from: decId, to: projectId, relationship: 'informed_by', label: 'belongs to project' });
    }
  }
  const cycles = detectCycles(graph);
  saveGraph(graph);
  return { graph, cycles };
}

function generateCanvas(graph, existingPositions) {
  const pos = existingPositions || {};
  const canvas = { nodes: [], edges: [] };
  const counts = { project: 0, decision: 0, task: 0, agent: 0 };
  for (const n of graph.nodes) {
    const type = n.type || 'task';
    const dims = NODE_DIMS[type] || NODE_DIMS.task;
    const existing = pos[n.id];
    let x, y;
    if (existing && existing.x != null) { x = existing.x; y = existing.y; }
    else if (type === 'agent') { x = 700; y = counts.agent * 80; }
    else { x = counts[type] * (dims.width + 40); y = ROW_Y[type] || 0; }
    counts[type]++;
    const color = type === 'decision' ? COLOR_MAP.decision : type === 'agent' ? COLOR_MAP.agent : COLOR_MAP[n.status] || COLOR_MAP.planned;
    canvas.nodes.push({ id: n.id, type: 'text', text: `${n.label}\n(${n.status || type})`, x, y, width: dims.width, height: dims.height, color });
  }
  for (const e of graph.edges) canvas.edges.push({ id: e.id, fromNode: e.from, toNode: e.to, label: (e.label || e.relationship || '').slice(0, 40), fromSide: 'bottom', toSide: 'top' });
  return canvas;
}

function syncAndGenerate(digest) {
  const { graph, cycles } = updateGraph(digest);
  const config = loadConfig();
  const canvas = generateCanvas(graph, (config && config.node_positions) || {});
  const outputPath = config && config.canvas_output_path;
  if (!outputPath) return { graph, canvas, cycles, outputPath: null };
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const resolved = path.resolve(outputPath);
  if (home && !resolved.startsWith(path.resolve(home))) return { graph, canvas, cycles, outputPath: null };
  try {
    if (!_canvasDirExists) { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); _canvasDirExists = true; }
    fs.writeFileSync(outputPath, JSON.stringify(canvas, null, 2), 'utf8');
  } catch (err) { _canvasDirExists = false; }
  return { graph, canvas, cycles, outputPath };
}

module.exports = { loadGraph, saveGraph, updateGraph, detectCycles, generateCanvas, syncAndGenerate, parseGraphYaml, serializeYaml };
