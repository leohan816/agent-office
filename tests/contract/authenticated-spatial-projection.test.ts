import { describe, expect, it } from 'vitest';

import {
  parseAuthenticatedSpatialPresentation,
} from '../../src/application/spatial-office/authenticated-projection.js';
import { authenticatedSpatialPresentationFixture } from '../helpers/authenticated-spatial.js';

describe('AO12-IWU-12 authenticated spatial presentation contract', () => {
  it('accepts one exact versioned projection and canonical UTC cue slice', () => {
    const presentation = authenticatedSpatialPresentationFixture();
    expect(parseAuthenticatedSpatialPresentation(presentation)).toEqual(presentation);
  });

  it.each([
    '2026-07-11T12:00:00Z',
    '2026-07-11T12:00:00.0000Z',
    '2026-07-11T12:00:00.000+00:00',
    '2026-07-11 12:00:00.000Z',
    'not-a-time',
  ])('rejects noncanonical authenticated evaluatedAt %s before cue projection', (timestamp) => {
    const presentation = authenticatedSpatialPresentationFixture();
    const malformed = {
      ...presentation,
      projection: { ...presentation.projection, evaluatedAt: timestamp },
      cueSlices: presentation.cueSlices.map((slice) => ({ ...slice, evaluatedAt: timestamp })),
    };
    expect(() => parseAuthenticatedSpatialPresentation(malformed)).toThrow();
  });

  it.each([
    '2026-07-11T12:00:00Z',
    '2026-07-11T12:00:00.0000Z',
    '2026-07-11T12:00:00.000+00:00',
    'invalid',
  ])('rejects noncanonical activity time %s before cue projection', (timestamp) => {
    const presentation = authenticatedSpatialPresentationFixture();
    const malformed = {
      ...presentation,
      cueSlices: presentation.cueSlices.map((slice) => ({
        ...slice,
        activityEffectiveFrom: timestamp,
      })),
    };
    expect(() => parseAuthenticatedSpatialPresentation(malformed)).toThrow();
  });

  it('rejects malformed or non-increasing activity expiry before cue projection', () => {
    const presentation = authenticatedSpatialPresentationFixture();
    for (const optionalExpiresAt of [
      '2026-07-11T12:00:01+00:00',
      presentation.projection.evaluatedAt,
      '2026-07-11T11:59:59.999Z',
    ]) {
      const malformed = {
        ...presentation,
        cueSlices: presentation.cueSlices.map((slice) => ({
          ...slice,
          fact: {
            ...slice.fact,
            activity: { ...slice.fact.activity, optionalExpiresAt },
          },
        })),
      };
      expect(() => parseAuthenticatedSpatialPresentation(malformed)).toThrow();
    }
  });

  it('rejects unknown fields and event/projection identity crossing', () => {
    const presentation = authenticatedSpatialPresentationFixture();
    expect(() => parseAuthenticatedSpatialPresentation({
      ...presentation,
      terminalOutput: 'untrusted prose',
    })).toThrow();
    expect(() => parseAuthenticatedSpatialPresentation({
      ...presentation,
      cueSlices: presentation.cueSlices.map((slice) => ({ ...slice, podId: 'pod:unknown' })),
    })).toThrow();
    expect(() => parseAuthenticatedSpatialPresentation({
      ...presentation,
      cueSlices: presentation.cueSlices.map((slice) => ({ ...slice, acceptedEventIds: [] })),
    })).toThrow();
  });
});
