#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(root, 'module-manifest.json');
const compositionsPath = join(root, 'compositions.json');
const canonicalPath = join(root, 'canonical-modules.svg');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const compositions = JSON.parse(readFileSync(compositionsPath, 'utf8'));
const canonical = readFileSync(canonicalPath, 'utf8');
const defsMatch = canonical.match(/<defs>([\s\S]*?)<\/defs>/);

if (!defsMatch) throw new Error('canonical-modules.svg must contain one <defs> block');

const defs = defsMatch[1];
const moduleById = new Map();

for (const module of manifest.modules) {
  if (moduleById.has(module.id)) throw new Error(`duplicate module ID: ${module.id}`);
  moduleById.set(module.id, module);
}

for (const module of manifest.modules) {
  for (const component of module.components ?? []) {
    if (!moduleById.has(component)) throw new Error(`${module.id} references missing component ${component}`);
  }
  for (const symbol of [module.symbol, ...Object.values(module.variants ?? {})].filter(Boolean)) {
    if (!canonical.includes(`id="${symbol}"`)) throw new Error(`${module.id} references missing symbol ${symbol}`);
  }
}

const xml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const sha256 = data => createHash('sha256').update(data).digest('hex');

function registry(name, width, height) {
  return {
    name,
    width,
    height,
    instances: [],
    directCounts: new Map(),
    expandedCounts: new Map(),
    unmappedVisibleObjects: 0
  };
}

function increment(map, key, count = 1) {
  map.set(key, (map.get(key) ?? 0) + count);
}

function expandCount(reg, moduleId, count = 1, stack = []) {
  if (stack.includes(moduleId)) throw new Error(`assembly cycle: ${[...stack, moduleId].join(' -> ')}`);
  increment(reg.expandedCounts, moduleId, count);
  const module = moduleById.get(moduleId);
  for (const child of module.components ?? []) expandCount(reg, child, count, [...stack, moduleId]);
}

function symbolFor(module, state) {
  if (module.renderer === 'text') return null;
  if (module.variants) {
    if (!state || !module.variants[state]) {
      throw new Error(`${module.id} requires one of states: ${Object.keys(module.variants).join(', ')}`);
    }
    return module.variants[state];
  }
  return module.symbol;
}

function emit(reg, spec) {
  const {
    moduleId, instanceId, x, y, width, height,
    state = 'default', accent = '#287d76', text = '',
    fontSize = 18, opacity = 1, groupOffset = null
  } = spec;
  const module = moduleById.get(moduleId);
  if (!module) {
    reg.unmappedVisibleObjects += 1;
    throw new Error(`visible instance ${instanceId} has unknown module ID ${moduleId}`);
  }
  if (reg.instances.some(item => item.instanceId === instanceId)) {
    throw new Error(`duplicate instance ID in ${reg.name}: ${instanceId}`);
  }
  if (module.states && !module.states.includes(state) && state !== 'default') {
    throw new Error(`${moduleId} does not support state ${state}`);
  }

  const symbol = symbolFor(module, state);
  reg.instances.push({ moduleId, instanceId, state, x, y, width, height, groupOffset });
  increment(reg.directCounts, moduleId);
  expandCount(reg, moduleId);

  const attrs = `data-instance-id="${xml(instanceId)}" data-module-id="${xml(moduleId)}" data-state="${xml(state)}"`;
  if (module.renderer === 'text') {
    return `<g ${attrs} style="color:${accent}" opacity="${opacity}"><text x="${x}" y="${y + fontSize}" font-family="Inter,DejaVu Sans,sans-serif" font-size="${fontSize}" font-weight="700" fill="#2d3538" letter-spacing=".4">${xml(text)}</text></g>`;
  }

  let overlay = '';
  if (moduleId === 'ui.team-sign') {
    overlay = `<text x="${x + 54}" y="${y + 42}" font-family="Inter,DejaVu Sans,sans-serif" font-size="23" font-weight="800" fill="#2d3538" letter-spacing=".5">${xml(text)}</text>`;
  } else if (moduleId === 'ui.lane-sign') {
    overlay = `<text x="${x + 25}" y="${y + 23}" font-family="Inter,DejaVu Sans,sans-serif" font-size="13" font-weight="800" fill="#fffaf1" letter-spacing="1.1">${xml(text)}</text>`;
  }

  const aspect = moduleId === 'surface.lane' ? 'none' : 'xMidYMid meet';
  return `<g ${attrs} style="color:${accent}" opacity="${opacity}"><use href="#${symbol}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${aspect}"/>${overlay}</g>`;
}

function svgDocument(width, height, title, content) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${xml(title)}</title>
  <desc>Deterministically composed from canonical module IDs. PNG is evidence; SVG and manifests are source.</desc>
  <defs>${defs}</defs>
  <g shape-rendering="geometricPrecision">${content}</g>
</svg>
`;
}

function laneLabel(lane) {
  return ({designer:'DESIGNER', advisor:'ADVISOR + BOARD', worker:'WORKERS', reviewer:'REVIEWERS'})[lane];
}

function renderTeamStrip(reg, proofName, proof, groupOffset = 0, prefix = proofName) {
  const g = compositions.geometry;
  const parts = [];
  const add = spec => parts.push(emit(reg, {...spec, groupOffset}));

  for (const [laneName, lane] of Object.entries(g.lanes)) {
    add({
      moduleId:'surface.lane', instanceId:`${prefix}/lane/${laneName}`,
      x:lane.x, y:groupOffset + lane.y, width:lane.width, height:lane.height,
      accent:proof.accent
    });
    add({
      moduleId:'ui.lane-sign', instanceId:`${prefix}/lane-sign/${laneName}`,
      x:lane.x + 14, y:groupOffset + 132, width:150, height:34,
      accent:proof.accent, text:laneLabel(laneName)
    });
  }

  add({
    moduleId:'ui.team-sign', instanceId:`${prefix}/team-sign`,
    x:44, y:groupOffset + 36, width:390, height:66,
    accent:proof.accent, text:proof.teamLabel
  });
  add({
    moduleId:'ui.state-indicator', instanceId:`${prefix}/sample-indicator`,
    x:2154, y:groupOffset + 42, width:56, height:56,
    state:'active'
  });
  add({
    moduleId:'ui.drag-handle', instanceId:`${prefix}/drag-handle`,
    x:2244, y:groupOffset + 40, width:80, height:58
  });
  add({moduleId:'prop.plant', instanceId:`${prefix}/plant/west`, x:30, y:groupOffset + 506, width:56, height:76});
  add({moduleId:'prop.plant', instanceId:`${prefix}/plant/east`, x:1870, y:groupOffset + 506, width:56, height:76});

  for (const slotId of ['D1','D2']) {
    const slot = g.slots[slotId];
    const state = proof.designers[slotId];
    if (state) {
      add({moduleId:'assembly.designer-station', instanceId:`${prefix}/${slotId}/station`, x:slot.x, y:groupOffset + slot.y, width:190, height:190, state:'working', accent:proof.accent});
      add({moduleId:'actor.designer', instanceId:`${prefix}/${slotId}/actor`, x:slot.x + 52, y:groupOffset + slot.y + 45, width:88, height:144, state:'working', accent:proof.accent});
    } else {
      add({moduleId:'ui.slot-anchor-empty', instanceId:`${prefix}/${slotId}/empty`, x:slot.x + 9, y:groupOffset + slot.y + 10, width:172, height:168});
    }
  }

  const advisorSlot = g.slots.A1;
  add({moduleId:'assembly.advisor-station', instanceId:`${prefix}/A1/station`, x:advisorSlot.x, y:groupOffset + advisorSlot.y, width:360, height:220, state:proof.advisorState, accent:proof.accent});
  add({moduleId:'actor.advisor', instanceId:`${prefix}/A1/actor`, x:advisorSlot.x + 236, y:groupOffset + advisorSlot.y + (proof.advisorState === 'idle' ? 48 : 20), width:88, height:144, state:proof.advisorState, accent:proof.accent});

  for (const slotId of ['W1','W2','W3','W4','W5']) {
    const slot = g.slots[slotId];
    const state = proof.workers[slotId];
    if (state) {
      add({moduleId:'assembly.worker-workstation', instanceId:`${prefix}/${slotId}/station`, x:slot.x, y:groupOffset + slot.y, width:190, height:190, state, accent:proof.accent});
      add({moduleId:'actor.worker', instanceId:`${prefix}/${slotId}/actor`, x:slot.x + 51, y:groupOffset + slot.y + 45, width:88, height:144, state, accent:proof.accent});
    } else {
      add({moduleId:'ui.slot-anchor-empty', instanceId:`${prefix}/${slotId}/empty`, x:slot.x + 9, y:groupOffset + slot.y + 10, width:172, height:168});
    }
  }

  for (const slotId of ['R1','R2']) {
    const slot = g.slots[slotId];
    const state = proof.reviewers[slotId];
    if (state) {
      add({moduleId:'assembly.reviewer-station', instanceId:`${prefix}/${slotId}/station`, x:slot.x, y:groupOffset + slot.y, width:190, height:190, state:'reviewing', accent:proof.accent});
      add({moduleId:'actor.reviewer', instanceId:`${prefix}/${slotId}/actor`, x:slot.x + 51, y:groupOffset + slot.y + 45, width:88, height:144, state:'reviewing', accent:proof.accent});
    } else {
      add({moduleId:'ui.slot-anchor-empty', instanceId:`${prefix}/${slotId}/empty`, x:slot.x + 9, y:groupOffset + slot.y + 10, width:172, height:168});
    }
  }

  if (proof.channy) {
    add({moduleId:'pet.channy', instanceId:`${prefix}/channy`, x:704, y:groupOffset + 496, width:112, height:96, state:'walking', accent:proof.accent});
  }

  return `<g data-team-proof="${xml(proofName)}" transform="translate(0 0)">${parts.join('')}</g>`;
}

function renderSingle(name) {
  const { width, height } = compositions.geometry.singleCanvas;
  const reg = registry(name, width, height);
  const floor = emit(reg, {moduleId:'surface.floor', instanceId:`${name}/floor`, x:0, y:0, width, height});
  const strip = renderTeamStrip(reg, name, compositions.proofs[name], 0, name);
  return {reg, svg:svgDocument(width, height, `Team Strip ${name}`, floor + strip)};
}

function renderFloorTiles(reg, prefix, width, height) {
  const parts = [];
  for (let y = 0, index = 1; y < height; y += 720, index += 1) {
    parts.push(emit(reg, {
      moduleId:'surface.floor', instanceId:`${prefix}/floor/${index}`,
      x:0, y, width, height:720
    }));
  }
  return parts.join('');
}

function renderStacked() {
  const { width, height } = compositions.geometry.stackedCanvas;
  const reg = registry('stacked', width, height);
  const parts = [];
  parts.push(renderFloorTiles(reg, 'stacked', width, height));
  const bounds = compositions.geometry.stripContentBounds;
  const offsets = compositions.proofs.stacked.offsets;

  for (let i = 0; i < offsets.length - 1; i += 1) {
    const y = offsets[i] + bounds.y + bounds.height;
    const nextTop = offsets[i + 1] + bounds.y;
    parts.push(emit(reg, {
      moduleId:'surface.corridor', instanceId:`stacked/corridor/${i + 1}`,
      x:0, y, width, height:nextTop - y
    }));
  }

  compositions.proofs.stacked.order.forEach((proofName, index) => {
    parts.push(renderTeamStrip(reg, proofName, compositions.proofs[proofName], offsets[index], `stacked/${index + 1}-${proofName}`));
  });

  if (compositions.proofs.stacked.continuation) {
    parts.push(emit(reg, {
      moduleId:'ui.continuation', instanceId:'stacked/continuation',
      x:1110, y:2350, width:180, height:64, accent:'#287d76'
    }));
  }

  return {reg, svg:svgDocument(width, height, 'Stacked modular Team Strips', parts.join(''))};
}

function stateForCatalog(module) {
  if (!module.variants) return module.states?.[0] ?? 'default';
  const preferred = ['working','coordinating','reviewing','active','idle','unknown'];
  return preferred.find(state => module.variants[state]) ?? Object.keys(module.variants)[0];
}

function renderCatalog() {
  const width = 2400;
  const height = 1400;
  const reg = registry('catalog', width, height);
  const parts = [];
  parts.push(renderFloorTiles(reg, 'catalog', width, height));
  parts.push(emit(reg, {moduleId:'ui.catalog-label', instanceId:'catalog/title', x:54, y:34, width:1300, height:56, text:'CANONICAL MODULE CATALOG', fontSize:34}));
  parts.push(emit(reg, {moduleId:'ui.catalog-label', instanceId:'catalog/subtitle', x:56, y:82, width:1600, height:38, text:'ONE SOURCE · FIXED ANCHORS · RESTRAINED TEAM TINT', fontSize:16, opacity:.72}));

  const cols = 7;
  const cardW = 318;
  const cardH = 226;
  const gapX = 18;
  const gapY = 18;
  const startX = 40;
  const startY = 132;

  manifest.modules.forEach((module, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    const accent = ['#287d76','#a45d3b','#5f62a7'][index % 3];
    parts.push(emit(reg, {moduleId:'ui.catalog-card', instanceId:`catalog/card/${module.id}`, x, y, width:cardW, height:cardH}));

    const [,,vbW,vbH] = module.viewBox;
    const maxW = 250;
    const maxH = 132;
    const scale = Math.min(maxW / vbW, maxH / vbH);
    const sampleW = Math.max(40, vbW * scale);
    const sampleH = Math.max(30, vbH * scale);
    const sampleX = x + (cardW - sampleW) / 2;
    const sampleY = y + 18 + (maxH - sampleH) / 2;
    const state = stateForCatalog(module);
    const text = module.id === 'ui.team-sign' ? 'TEAM · SAMPLE'
      : module.id === 'ui.lane-sign' ? 'ROLE LANE'
      : module.id === 'ui.catalog-label' ? 'MODULE LABEL'
      : '';
    parts.push(emit(reg, {
      moduleId:module.id, instanceId:`catalog/sample/${module.id}`,
      x:sampleX, y:sampleY, width:sampleW, height:sampleH,
      state, accent, text, fontSize:16
    }));
    parts.push(emit(reg, {
      moduleId:'ui.catalog-label', instanceId:`catalog/label/${module.id}`,
      x:x + 16, y:y + 182, width:cardW - 32, height:30,
      text:module.id, fontSize:15
    }));
  });

  return {reg, svg:svgDocument(width, height, 'Canonical module catalog', parts.join(''))};
}

function sortedObject(map) {
  return Object.fromEntries([...map.entries()].sort(([a],[b]) => a.localeCompare(b)));
}

function validateOccupancy() {
  const expected = {
    small:{designers:1,workers:1,reviewers:1},
    medium:{designers:1,workers:3,reviewers:1},
    large:{designers:2,workers:5,reviewers:2}
  };
  for (const [name, counts] of Object.entries(expected)) {
    const proof = compositions.proofs[name];
    for (const role of ['designers','workers','reviewers']) {
      if (Object.keys(proof[role]).length !== counts[role]) {
        throw new Error(`${name} ${role} occupancy mismatch`);
      }
    }
    const workerSlots = Object.keys(proof.workers);
    const expectedPrefix = Array.from({length:workerSlots.length}, (_, i) => `W${i + 1}`);
    if (workerSlots.join(',') !== expectedPrefix.join(',')) {
      throw new Error(`${name} Workers must fill nearest-Advisor slots first`);
    }
  }
}

function validateStacked(reg) {
  const geometry = compositions.geometry;
  const bounds = geometry.stripContentBounds;
  const offsets = compositions.proofs.stacked.offsets;
  const corridors = [];

  for (let i = 0; i < offsets.length - 1; i += 1) {
    const previousBottom = offsets[i] + bounds.y + bounds.height;
    const nextTop = offsets[i + 1] + bounds.y;
    const clearHeight = nextTop - previousBottom;
    corridors.push({index:i + 1, y:previousBottom, height:clearHeight, ratioToStandingSprite:Number((clearHeight / geometry.canonicalStandingCharacterHeight).toFixed(4))});
    if (clearHeight <= geometry.canonicalStandingCharacterHeight) throw new Error(`corridor ${i + 1} is not taller than standing sprite`);
    if (clearHeight < geometry.minimumCorridorHeight) throw new Error(`corridor ${i + 1} misses target height`);
    if (clearHeight / geometry.canonicalStandingCharacterHeight < geometry.minimumCorridorRatio) throw new Error(`corridor ${i + 1} misses ratio target`);
  }

  const exempt = new Set(['surface.floor','surface.corridor','ui.continuation']);
  for (const item of reg.instances) {
    if (item.groupOffset === null || exempt.has(item.moduleId)) continue;
    const top = item.groupOffset + bounds.y;
    const bottom = top + bounds.height;
    if (item.y < top || item.y + item.height > bottom) {
      throw new Error(`${item.instanceId} intrudes outside Team Strip content bounds`);
    }
  }
  return corridors;
}

function renderPng(svgPath, pngPath) {
  const command = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', svgPath, '-frames:v', '1', '-pix_fmt', 'rgba', pngPath
  ], {encoding:'utf8'});
  if (command.status !== 0) {
    throw new Error(`ffmpeg failed for ${svgPath}: ${command.stderr || command.stdout}`);
  }
}

validateOccupancy();

const rendered = {
  'module-catalog': renderCatalog(),
  'team-strip-small': renderSingle('small'),
  'team-strip-medium': renderSingle('medium'),
  'team-strip-large': renderSingle('large'),
  'stacked-team-strips': renderStacked()
};

const corridorChecks = validateStacked(rendered['stacked-team-strips'].reg);
const artifacts = {};

for (const [name, result] of Object.entries(rendered)) {
  if (result.reg.unmappedVisibleObjects !== 0) throw new Error(`${name} contains unmapped visible objects`);
  const svgPath = join(root, `${name}.svg`);
  const pngPath = join(root, `${name}.png`);
  writeFileSync(svgPath, result.svg);
  renderPng(svgPath, pngPath);
  const png = readFileSync(pngPath);
  artifacts[name] = {
    svg: `${name}.svg`,
    png: `${name}.png`,
    dimensions: [result.reg.width, result.reg.height],
    svgSha256: sha256(result.svg),
    pngSha256: sha256(png),
    visibleInstanceCount: result.reg.instances.length,
    unmappedVisibleObjects: result.reg.unmappedVisibleObjects,
    directModuleCounts: sortedObject(result.reg.directCounts),
    expandedModuleCounts: sortedObject(result.reg.expandedCounts)
  };
}

const validation = {
  status: 'PASS',
  sourceOfTruth: ['canonical-modules.svg','module-manifest.json','compositions.json','export-proofs.mjs'],
  sourceIdentity: {
    canonicalModulesSha256: sha256(readFileSync(canonicalPath)),
    moduleManifestSha256: sha256(readFileSync(manifestPath)),
    compositionsSha256: sha256(readFileSync(compositionsPath)),
    exporterSha256: sha256(readFileSync(fileURLToPath(import.meta.url)))
  },
  moduleIdCount: manifest.modules.length,
  moduleIds: manifest.modules.map(module => module.id),
  coverage: {
    visibleObjectsWithoutModuleId: 0,
    everyExportBuiltByRegisteredEmitter: true,
    assemblyComponentsResolveToCanonicalIds: true
  },
  geometry: {
    canonicalStandingCharacterHeight: compositions.geometry.canonicalStandingCharacterHeight,
    minimumCorridorRatio: compositions.geometry.minimumCorridorRatio,
    minimumCorridorHeight: compositions.geometry.minimumCorridorHeight,
    sharedStripContentBounds: compositions.geometry.stripContentBounds,
    sharedLanes: compositions.geometry.lanes,
    sharedSlotAnchors: compositions.geometry.slots,
    workerOrdering: 'W1 nearest Advisor, then W2-W5 in fixed order',
    corridorChecks
  },
  occupancy: {
    small:{designers:1,advisors:1,workers:1,reviewers:1},
    medium:{designers:1,advisors:1,workers:3,reviewers:1},
    large:{designers:2,advisors:1,workers:5,reviewers:2}
  },
  monitorStates: {
    working:'bright white UI',
    idle:'black/off',
    demonstratedIdleInstance:'team-strip-medium W3'
  },
  reorderProof: {
    stackedOrder: compositions.proofs.stacked.order,
    stripGeometryMutation: false,
    authorityMutation: false,
    operation: 'data order only'
  },
  artifacts
};

writeFileSync(join(root, 'validation-report.json'), `${JSON.stringify(validation, null, 2)}\n`);
console.log(JSON.stringify({status:validation.status, moduleIdCount:validation.moduleIdCount, corridorChecks, artifacts:Object.fromEntries(Object.entries(artifacts).map(([name,value]) => [name,{dimensions:value.dimensions,pngSha256:value.pngSha256,unmappedVisibleObjects:value.unmappedVisibleObjects}]))}, null, 2));
