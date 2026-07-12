import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseAuthenticatedSpatialPresentation } from '../../src/application/spatial-office/authenticated-projection.js';
import { authenticatedSpatialPresentationFixture } from '../helpers/authenticated-spatial.js';

describe('AO12-IWU-12 authenticated spatial redaction boundary', () => {
  it('contains no locator, path, credential, transport target, request body, or terminal prose field', () => {
    const serialized = JSON.stringify(parseAuthenticatedSpatialPresentation(
      authenticatedSpatialPresentationFixture(),
    ));
    for (const forbidden of [
      'paneId',
      'sessionId',
      'windowId',
      'workspaceRoot',
      'absolutePath',
      'credential',
      'csrfToken',
      'transportTarget',
      'requestBody',
      'terminalOutput',
      'send-keys',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('rejects polluted projection and cue slice objects rather than ignoring them', () => {
    const presentation = authenticatedSpatialPresentationFixture();
    expect(() => parseAuthenticatedSpatialPresentation({
      ...presentation,
      cueSlices: presentation.cueSlices.map((slice) => ({
        ...slice,
        terminalOutput: 'completed from pane prose',
      })),
    })).toThrow();
  });

  it('keeps the production adapter free of filesystem, process, auth, gateway, and transport capabilities', async () => {
    const source = await readFile(path.resolve(
      import.meta.dirname,
      '../../src/application/spatial-office/authenticated-projection.ts',
    ), 'utf8');
    expect(source).not.toMatch(/node:(?:fs|child_process|net|http)|send-keys|capture-pane|gateway|AuthenticationProvider/u);
    expect(source).not.toMatch(/\b(?:fetch|spawn|execFile|writeFile|appendFile)\s*\(/u);
  });
});
