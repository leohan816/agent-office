import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const artifactRoot = path.join(repositoryRoot, 'artifacts/m1-2-visual-prototype');
const designBase = '9611d0da1479ca5e7a9677641fe767a6b39b4a38';
const visualPatchBase = 'c535877b61ad8a1e3d74dca5c6fec0ada4cac3f8';
const requiredFiles = [
  'agent-office-living-office-prototype.webm',
  'agent-office-living-office-prototype.mp4',
  'agent-office-living-office-prototype.gif',
  'full-office.png',
  'team-activity.png',
  'lounge.png',
  'channy.png',
  'mobile.png',
];
const livingPrototypeBaselinePaths = [
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v01-full-office.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v02-foundation-active.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v03-vibenews-active.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v04-advisor-handoff.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v05-reviewer-active.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v06-lounge-idle.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v07-channy-roam.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v08-channy-eat.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v09-channy-sleep.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v10-waiting-leo.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v11-blocked.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v12-mobile-foundation.png',
  'tests/e2e/baselines/living-pixel-prototype.spec.ts/pixel-v13-reduced-static.png',
];
const reconciledBaselinePaths = [
  'tests/e2e/baselines/office-scene.spec.ts/office-desktop-1440x900.png',
  'tests/e2e/baselines/office-scene.spec.ts/office-mobile-390x844.png',
  'tests/e2e/baselines/office-scene.spec.ts/office-reduced-motion-1440x900.png',
  'tests/e2e/baselines/spatial-office-accessibility.spec.ts/spatial-motion-forced-colors-1440x900.png',
  'tests/e2e/baselines/spatial-office-accessibility.spec.ts/spatial-motion-mobile-static-390x844.png',
  'tests/e2e/baselines/spatial-office-accessibility.spec.ts/spatial-motion-text-200-percent-390x844.png',
  'tests/e2e/baselines/spatial-office-motion.spec.ts/spatial-motion-full-desktop-1440x900.png',
  'tests/e2e/baselines/spatial-office-motion.spec.ts/spatial-motion-reduced-static-1440x900.png',
  'tests/e2e/baselines/spatial-office-motion.spec.ts/spatial-motion-restrained-desktop-1440x900.png',
  'tests/e2e/baselines/spatial-office-motion.spec.ts/spatial-motion-tablet-1024x768.png',
  'tests/e2e/baselines/spatial-office-static.spec.ts/spatial-static-desktop-1440x900.png',
  'tests/e2e/baselines/spatial-office-static.spec.ts/spatial-static-forced-colors-1440x900.png',
  'tests/e2e/baselines/spatial-office-static.spec.ts/spatial-static-mobile-390x844.png',
  'tests/e2e/baselines/spatial-office-static.spec.ts/spatial-static-reduced-motion-1440x900.png',
  'tests/e2e/baselines/spatial-office-static.spec.ts/spatial-static-tablet-1024x768.png',
  'tests/e2e/baselines/spatial-office-static.spec.ts/spatial-static-text-200-percent-390x844.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/application-office-desktop-1440x900.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/application-office-mobile-390x844.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/application-office-reduced-motion-1440x900.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/ao12-d-authenticated/application-spatial-320x720.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/ao12-d-authenticated/application-spatial-desktop-1440x900.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/ao12-d-authenticated/application-spatial-forced-colors-1440x900.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/ao12-d-authenticated/application-spatial-mobile-390x844.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/ao12-d-authenticated/application-spatial-reduced-motion-1440x900.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/ao12-d-authenticated/application-spatial-tablet-1024x768.png',
  'tests/e2e-composed/baselines/application-office-scene.spec.ts/ao12-d-authenticated/application-spatial-text-200-percent-390x844.png',
];
const acceptedBaselinePaths = [...livingPrototypeBaselinePaths, ...reconciledBaselinePaths];
const webmPath = path.join(artifactRoot, requiredFiles[0]);
const mp4Path = path.join(artifactRoot, requiredFiles[1]);
const gifPath = path.join(artifactRoot, requiredFiles[2]);
const recordingCommand = 'npx playwright test tests/e2e/living-pixel-prototype.recording.spec.ts --config playwright.pixel-prototype.config.ts --project=chromium --workers=1';
const mp4Command = `/usr/bin/ffmpeg -nostdin -hide_banner -loglevel error -y -i ${webmPath} -an -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart ${mp4Path}`;
const gifCommand = `/usr/bin/ffmpeg -nostdin -hide_banner -loglevel error -y -ss 00:00:06.000 -t 00:00:07.000 -i ${webmPath} -vf "fps=12,scale=720:-2:flags=neighbor,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=none" -loop 0 ${gifPath}`;
const descriptions = {
  'agent-office-living-office-prototype.webm': 'Continuous actual Playwright loopback run with camera-tracked actor labels, slow paused Channy sequence and Advisor handoff',
  'agent-office-living-office-prototype.mp4': 'H.264 yuv420p conversion of the exact captured WebM',
  'agent-office-living-office-prototype.gif': 'Continuous 6.0-13.0 second WebM segment with Worker walk, slow Channy walk-stop-sniff presentation and Advisor handoff',
  'full-office.png': 'PIXEL-V01 modern light shared office with all camera-tracked actor labels at 0ms, 1440x900',
  'team-activity.png': 'PIXEL-V02 Foundation accepted synthetic WORKING frame with role/model/session/state label at 4500ms, 1440x900',
  'lounge.png': 'PIXEL-V06 verified-idle coffee lounge at 16000ms, 1440x900',
  'channy.png': 'PIXEL-V07 focused close-up of original Bedlington Terrier slow eased walk at 18000ms, 1440x900',
  'mobile.png': 'PIXEL-V12 focused Foundation Pod with actor identity label at 4500ms, 390x844',
};

const rootStatus = await stat(artifactRoot);
assert(rootStatus.isDirectory(), 'artifact root is not a directory');
assert((rootStatus.mode & 0o777) === 0o700, 'artifact root must be mode 0700');
const actualFiles = (await readdir(artifactRoot)).sort();
assert(JSON.stringify(actualFiles) === JSON.stringify([...requiredFiles].sort()), 'artifact root does not contain exactly eight required files');

const ignored = run('git', ['check-ignore', '-q', '--', 'artifacts/m1-2-visual-prototype/.ignore-probe']);
assert(ignored.status === 0, 'artifact root is not ignored');
const tracked = run('git', ['ls-files', '--', 'artifacts/m1-2-visual-prototype/']);
assert(tracked.status === 0 && tracked.stdout.trim() === '', 'artifact root contains a tracked path');

const baselineRoots = ['tests/e2e/baselines', 'tests/e2e-composed/baselines'];
const acceptedBaselineSet = new Set(acceptedBaselinePaths);
const livingPrototypeBaselineSet = new Set(livingPrototypeBaselinePaths);
assert(acceptedBaselineSet.size === 39, 'accepted baseline contract must contain exactly 39 unique paths');
assert(livingPrototypeBaselinePaths.length === 13, 'living-prototype baseline contract must contain exactly 13 paths');
assert(reconciledBaselinePaths.length === 26, 'reconciled baseline contract must contain exactly 26 paths');

const livingBaselineRoot = path.join(repositoryRoot, 'tests/e2e/baselines/living-pixel-prototype.spec.ts');
const actualLivingEntries = await readdir(livingBaselineRoot, { withFileTypes: true });
assert(actualLivingEntries.every((entry) => entry.isFile()), 'living-prototype baseline directory must contain files only');
const actualLivingPaths = actualLivingEntries
  .map((entry) => path.posix.join('tests/e2e/baselines/living-pixel-prototype.spec.ts', entry.name))
  .sort();
assert(
  JSON.stringify(actualLivingPaths) === JSON.stringify([...livingPrototypeBaselinePaths].sort()),
  'living-prototype baseline directory does not equal the exact 13-path contract',
);
for (const baselinePath of acceptedBaselinePaths) {
  const baselineStatus = await stat(path.join(repositoryRoot, baselinePath));
  assert(baselineStatus.isFile(), `accepted baseline is not a file: ${baselinePath}`);
}

const changedFromDesignBase = checkedGitPaths(
  ['diff', '--name-only', designBase, '--', ...baselineRoots],
  'design-base baseline diff failed',
);
const changedFromVisualPatchBase = checkedGitPaths(
  ['diff', '--name-only', visualPatchBase, '--', ...baselineRoots],
  'visual-patch-base baseline diff failed',
);
const changedInWorkingTree = checkedGitPaths(
  ['diff', '--name-only', '--', ...baselineRoots],
  'working-tree baseline diff failed',
);
const stagedBaselinePaths = checkedGitPaths(
  ['diff', '--cached', '--name-only', '--', ...baselineRoots],
  'staged baseline diff failed',
);
const untrackedBaselinePaths = checkedGitPaths(
  ['ls-files', '--others', '--exclude-standard', '--', ...baselineRoots],
  'untracked baseline inspection failed',
);
const observedVisualPatchBaselinePaths = new Set([
  ...changedFromVisualPatchBase,
  ...changedInWorkingTree,
  ...stagedBaselinePaths,
  ...untrackedBaselinePaths,
]);
for (const baselinePath of observedVisualPatchBaselinePaths) {
  assert(livingPrototypeBaselineSet.has(baselinePath), `baseline outside exact 13-path visual patch contract: ${baselinePath}`);
}
assert(
  setsEqual(changedFromDesignBase, acceptedBaselineSet),
  'design-lineage baseline evidence does not equal the exact 39-path contract',
);
assert(
  setsEqual(changedFromVisualPatchBase, livingPrototypeBaselineSet),
  'visual patch must change exactly all 13 living-prototype baselines from c535877',
);
assert(
  setsEqual(observedVisualPatchBaselinePaths, livingPrototypeBaselineSet),
  'changed, staged, and untracked visual-patch baseline evidence does not equal the exact 13-path contract',
);
for (const baselinePath of reconciledBaselinePaths) {
  assert(changedFromDesignBase.has(baselinePath), `reconciled baseline unchanged from design base: ${baselinePath}`);
  const unchanged = run('git', ['diff', '--quiet', visualPatchBase, '--', baselinePath]);
  assert(unchanged.status === 0, `historical reconciled baseline changed from c535877: ${baselinePath}`);
}

const webmDuration = probeDuration(webmPath);
const mp4Duration = probeDuration(mp4Path);
const gifDuration = probeDuration(gifPath);
assert(webmDuration >= 20 && webmDuration <= 30, `WebM duration outside 20-30s: ${webmDuration}`);
assert(mp4Duration >= 20 && mp4Duration <= 30, `MP4 duration outside 20-30s: ${mp4Duration}`);
assert(gifDuration >= 6.5 && gifDuration <= 7.5, `GIF duration outside exact 7s segment tolerance: ${gifDuration}`);
assert(JSON.stringify(probeDimensions(webmPath)) === JSON.stringify([1440, 900]), 'WebM must be a direct 1440x900 capture');
assert(JSON.stringify(probeDimensions(mp4Path)) === JSON.stringify([1440, 900]), 'MP4 dimensions must remain 1440x900');
assert(JSON.stringify(probeDimensions(gifPath)) === JSON.stringify([720, 450]), 'GIF dimensions must be exact 720x450 nearest-neighbor output');

for (const png of requiredFiles.slice(3)) {
  const bytes = await readFile(path.join(artifactRoot, png));
  assert(bytes.subarray(1, 4).toString('ascii') === 'PNG', `${png}: invalid PNG signature`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const expected = png === 'mobile.png' ? [390, 844] : [1440, 900];
  assert(width === expected[0] && height === expected[1], `${png}: unexpected dimensions ${width}x${height}`);
}

const deliveryBaselinePaths = {
  'full-office.png': livingPrototypeBaselinePaths[0],
  'team-activity.png': livingPrototypeBaselinePaths[1],
  'lounge.png': livingPrototypeBaselinePaths[5],
  'channy.png': livingPrototypeBaselinePaths[6],
  'mobile.png': livingPrototypeBaselinePaths[11],
};
for (const [fileName, baselinePath] of Object.entries(deliveryBaselinePaths)) {
  assert(baselinePath !== undefined, `delivery baseline mapping missing: ${fileName}`);
  const mediaBytes = await readFile(path.join(artifactRoot, fileName));
  const baselineBytes = await readFile(path.join(repositoryRoot, baselinePath));
  assert(sha256(mediaBytes) === sha256(baselineBytes), `${fileName}: media bytes do not equal the exact current baseline`);
}

const actorOverlaySource = await readFile(path.join(repositoryRoot, 'src/ui/pixel/living-office-actor-overlay.tsx'), 'utf8');
for (const requiredField of [
  'Role', 'Project', 'Advisor Team', 'Reports-to Advisor', 'Session name',
  'Model', 'State', 'Mission', 'WorkUnit', 'Evidence freshness',
]) {
  assert(actorOverlaySource.includes(`label="${requiredField}"`), `actor detail field missing: ${requiredField}`);
}
assert(actorOverlaySource.includes('data-actor-fact-source={source}'), 'actor detail provenance marker missing');
assert(actorOverlaySource.includes('actorLabelFactSource(actor.factSources.state)'), 'always-visible actor state provenance marker missing');
const frameProjectorSource = await readFile(path.join(repositoryRoot, 'src/ui/pixel/frame-projector.ts'), 'utf8');
assert(frameProjectorSource.includes('PIXEL_ACTOR_UNKNOWN'), 'literal UNKNOWN fail-closed actor field gate missing');
assert(frameProjectorSource.includes("input.source === 'UNVERIFIED'"), 'unverified actor fact rejection gate missing');
assert(frameProjectorSource.includes("source: 'SYNTHETIC_FIXTURE' as const"), 'synthetic structured-state provenance gate missing');
assert(frameProjectorSource.includes("zoom: sceneId.startsWith('channy-') ? 3"), 'focused Channy evidence camera gate missing');
const fixturePath = path.join(repositoryRoot, 'src/ui/pixel/fixtures/prototype-projection.ts');
const fixtureSource = await readFile(fixturePath, 'utf8');
for (const sessionName of [
  'foundation-advisor', 'foundation-control', 'foundation', 'cosmile', 'siasiu',
  'agent-office', 'reviewer-fable5', 'VibeNews-advisor', 'VibeNews', 'VibeNews-designer',
]) {
  assert(
    fixtureSource.includes(`verifiedRegistryFact('${sessionName}')`),
    `verified actor session fact missing: ${sessionName}`,
  );
}
assert(
  (fixtureSource.match(/verifiedRegistryFact\('/gu) ?? []).length === 10,
  'prototype fixture must contain exactly ten verified registry session facts',
);
assert(
  (fixtureSource.match(/verifiedMissionArtifactFact\('/gu) ?? []).length === 2,
  'prototype fixture must contain exactly two mission-proven model facts',
);
for (const model of ['Codex 5.6 SOL', 'Fable5']) {
  assert(
    fixtureSource.includes(`verifiedMissionArtifactFact('${model}')`),
    `mission-proven model fact missing: ${model}`,
  );
}
for (const forbiddenSession of ['control', 'foundation-worker', 'cosmile-worker', 'siasiu-worker', 'vibenews-worker']) {
  assert(
    !fixtureSource.includes(`verifiedRegistryFact('${forbiddenSession}')`),
    `invented actor session fact present: ${forbiddenSession}`,
  );
}
for (const syntheticField of ['state:', 'mission:', 'workUnit:', 'evidenceFreshness:']) {
  assert(
    fixtureSource.includes(`${syntheticField} syntheticFixtureFact(`),
    `synthetic actor fact provenance missing: ${syntheticField}`,
  );
}
const timelineSource = await readFile(path.join(repositoryRoot, 'src/ui/pixel/fixtures/prototype-timeline.ts'), 'utf8');
for (const state of ['WALK', 'STOP', 'SNIFF', 'SIT', 'EAT', 'DRINK', 'SLEEP', 'PLAY']) {
  assert(timelineSource.includes(`'${state}'`), `Channy natural sequence state missing: ${state}`);
}
const paletteSource = await readFile(path.join(repositoryRoot, 'src/ui/pixel/assets/palette.ts'), 'utf8');
for (const token of ['wall: [247, 244, 236, 255]', 'floor: [215, 188, 151, 255]', 'glass: [157, 205, 220, 190]']) {
  assert(paletteSource.includes(token), `modern light-office palette token missing: ${token}`);
}

const packageDocument = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
assert(packageDocument.dependencies?.['pixi.js'] === '8.19.0', 'pixi.js pin mismatch');
assert(packageDocument.dependencies?.['@pixi/react'] === '8.0.5', '@pixi/react pin mismatch');
assert(packageDocument.dependencies?.react === '19.2.7', 'React pin changed');
assert(packageDocument.dependencies?.['react-dom'] === '19.2.7', 'React DOM pin changed');

const productionBuild = run('npm', ['run', 'build:dashboard'], { NO_COLOR: '1' });
assert(productionBuild.status === 0, `fresh production build failed: ${ascii(productionBuild.stderr)}`);
const productionJavaScript = await collectFiles(path.join(repositoryRoot, 'dist/dashboard'), '.js');
const bundleText = (await Promise.all(productionJavaScript.map((file) => readFile(file, 'utf8')))).join('\n');
for (const marker of [
  'agent-office.living-pixel-prototype.synthetic.v1',
  'SYNTHETIC PROTOTYPE',
  'prototype.full-office.v1',
  'Replay 26-second office tour',
  '@pixi/react',
  'pixi.js',
]) {
  assert(!bundleText.includes(marker), `fresh production bundle contains prototype marker: ${marker}`);
}

const listeners = run('ss', ['-ltn']);
assert(listeners.status === 0, 'listener inspection failed');
assert(!lines(listeners.stdout).some((line) => /127\.0\.0\.1:4173\s/u.test(line)), 'IPv4 prototype preview remains listening');

const fixtureSha256 = sha256(await readFile(fixturePath));
const targetCommit = run('git', ['rev-parse', 'HEAD']);
assert(targetCommit.status === 0, 'cannot resolve target commit');
const evidence = [];
for (const fileName of requiredFiles) {
  const absolutePath = path.join(artifactRoot, fileName);
  const bytes = await readFile(absolutePath);
  const video = fileName.endsWith('.webm') || fileName.endsWith('.mp4') || fileName.endsWith('.gif');
  evidence.push({
    absolutePath,
    sizeBytes: bytes.byteLength,
    sha256: sha256(bytes),
    scenarioDescription: descriptions[fileName],
    prototypeCommitSha: targetCommit.stdout.trim(),
    captureCommand: fileName.endsWith('.webm')
      ? recordingCommand
      : fileName.endsWith('.png')
        ? 'npx playwright test tests/e2e/living-pixel-prototype.spec.ts --config playwright.pixel-prototype.config.ts --project=chromium --workers=1'
        : 'DERIVED_FROM_CAPTURED_WEBM',
    conversionCommand: fileName.endsWith('.mp4')
      ? mp4Command
      : fileName.endsWith('.gif')
        ? gifCommand
        : 'NOT_APPLICABLE',
    durationSeconds: video ? probeDuration(absolutePath) : 'NOT_APPLICABLE',
    viewportAndLogicalTime: pngViewport(fileName),
  });
}

process.stdout.write(`PIXEL_PROTOTYPE_EVIDENCE ${JSON.stringify({
  schemaVersion: 'agent-office.living-pixel-prototype-visual-patch-evidence.v3',
  fixtureSha256,
  configuredRuntime: {
    browser: 'Playwright Chromium 1.61.1 configured local runtime',
    locale: 'ko-KR',
    processLocale: 'ko_KR.UTF-8',
    timezone: 'UTC',
    mediaColorScheme: 'dark',
    officeSurfaceTheme: 'light',
    deviceScaleFactor: 1,
  },
  artifactRoot,
  artifactRootMode: '0700',
  ignored: true,
  trackedPaths: 0,
  baselineContract: {
    schemaVersion: 'agent-office.living-pixel-prototype-visual-patch-baseline-contract.v2',
    designBase,
    visualPatchBase,
    acceptedPathCount: acceptedBaselinePaths.length,
    livingPrototypePathCount: livingPrototypeBaselinePaths.length,
    reconciledPathCount: reconciledBaselinePaths.length,
    livingPrototypePaths: livingPrototypeBaselinePaths,
    reconciledPaths: reconciledBaselinePaths,
    changedFromDesignBasePaths: [...changedFromDesignBase].sort(),
    changedFromVisualPatchBasePaths: [...changedFromVisualPatchBase].sort(),
    historicalReconciledByteIdenticalToVisualPatchBase: true,
    changedWorkingTreePaths: [...changedInWorkingTree].sort(),
    stagedPaths: [...stagedBaselinePaths].sort(),
    untrackedPaths: [...untrackedBaselinePaths].sort(),
  },
  webmDurationSeconds: webmDuration,
  mp4DurationSeconds: mp4Duration,
  gifDurationSeconds: gifDuration,
  files: evidence,
})}\n`);

function run(command, args, extraEnvironment = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnvironment },
  });
}

function probeDuration(file) {
  const result = run('/usr/bin/ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]);
  assert(result.status === 0, `ffprobe failed for ${file}: ${ascii(result.stderr)}`);
  const duration = Number(result.stdout.trim());
  assert(Number.isFinite(duration), `ffprobe returned invalid duration for ${file}`);
  return Math.round(duration * 1000) / 1000;
}

function probeDimensions(file) {
  const result = run('/usr/bin/ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0:s=x', file,
  ]);
  assert(result.status === 0, `ffprobe dimensions failed for ${file}: ${ascii(result.stderr)}`);
  const dimensions = result.stdout.trim().split('x').map(Number);
  assert(dimensions.length === 2 && dimensions.every(Number.isFinite), `ffprobe returned invalid dimensions for ${file}`);
  return dimensions;
}

async function collectFiles(root, extension) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(candidate, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(candidate);
  }
  return files.sort();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function lines(value) {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function checkedGitPaths(args, failureMessage) {
  const result = run('git', args);
  assert(result.status === 0, failureMessage);
  return new Set(lines(result.stdout));
}

function setsEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function ascii(value) {
  return String(value).replace(/[^\x20-\x7e\r\n\t]/gu, '?');
}

function pngViewport(fileName) {
  const values = {
    'full-office.png': '1440x900 DPR1 logicalTime=0ms PIXEL-V01',
    'team-activity.png': '1440x900 DPR1 logicalTime=4500ms PIXEL-V02',
    'lounge.png': '1440x900 DPR1 logicalTime=16000ms PIXEL-V06',
    'channy.png': '1440x900 DPR1 logicalTime=18000ms PIXEL-V07',
    'mobile.png': '390x844 DPR1 logicalTime=4500ms PIXEL-V12',
  };
  return values[fileName] ?? '1440x900 DPR1 continuous timeline';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
