import { describe, expect, it } from 'vitest';

import {
  GPT_PACKAGE_FIELDS,
  buildGptDecisionPackage,
} from '../../src/domain/decisions/gpt-package.js';
import { MISSION_ID, uuidV7 } from '../helpers/fixtures.js';

const source = {
  repository: 'foundation-docs',
  commit: 'a'.repeat(40),
  path: 'advisor/jobs/example/decision.md',
  sha256: `sha256:${'1'.repeat(64)}`,
};

describe('deterministic GPT decision package snapshot', () => {
  it('renders exactly 13 ordered fields with sorted facts/unknowns and no execution field', () => {
    const artifact = buildGptDecisionPackage({
      TARGET_ACTOR: 'Leo/GPT',
      MISSION: MISSION_ID,
      REQUEST_ID: uuidV7(1),
      SOURCE_ADVISOR_JOB: source,
      READ_DECISION_REQUEST: { ...source, path: 'artifacts/decision-request.json' },
      CONFIRMED_FACTS: [
        { factId: 'F-2', value: 'second', evidenceRefs: [] },
        { factId: 'F-1', value: 'first', evidenceRefs: [source] },
      ],
      UNKNOWNS: [
        { unknownId: 'U-2', description: 'second unknown' },
        { unknownId: 'U-1', description: 'first unknown' },
      ],
      QUESTION: 'Choose the bounded safe option?',
      OPTIONS: [
        { optionId: 'HOLD', label: 'Hold', impact: 'No mutation' },
        { optionId: 'PROCEED', label: 'Proceed', impact: 'Use approved scope' },
      ],
      ADVISOR_RECOMMENDATION: { optionId: 'HOLD', rationale: 'Fail closed' },
      SAFE_DEFAULT: 'HOLD',
    });
    expect(Object.keys(artifact.package)).toEqual(GPT_PACKAGE_FIELDS);
    expect(artifact.package.CONFIRMED_FACTS.map((fact) => fact.factId)).toEqual(['F-1', 'F-2']);
    expect(artifact.package.UNKNOWNS.map((unknown) => unknown.unknownId)).toEqual(['U-1', 'U-2']);
    expect(artifact.packageId).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(artifact.markdown.match(/^## /gmu)).toHaveLength(13);
    expect(artifact.markdown).not.toContain('EXECUTE');
    expect(artifact.markdown).toMatchInlineSnapshot(`
      "## TARGET_ACTOR

      Leo/GPT

      ## MISSION

      AGENT_OFFICE_M01_ADVISOR_MANAGED_OFFICE_WEB_CONTROL_PLANE

      ## REQUEST_ID

      018f0000-0000-7000-8000-000000000001

      ## SOURCE_ADVISOR_JOB

      {\"commit\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"path\":\"advisor/jobs/example/decision.md\",\"repository\":\"foundation-docs\",\"sha256\":\"sha256:1111111111111111111111111111111111111111111111111111111111111111\"}

      ## READ_DECISION_REQUEST

      {\"commit\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"path\":\"artifacts/decision-request.json\",\"repository\":\"foundation-docs\",\"sha256\":\"sha256:1111111111111111111111111111111111111111111111111111111111111111\"}

      ## CONFIRMED_FACTS

      [{\"evidenceRefs\":[{\"commit\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"path\":\"advisor/jobs/example/decision.md\",\"repository\":\"foundation-docs\",\"sha256\":\"sha256:1111111111111111111111111111111111111111111111111111111111111111\"}],\"factId\":\"F-1\",\"value\":\"first\"},{\"evidenceRefs\":[],\"factId\":\"F-2\",\"value\":\"second\"}]

      ## UNKNOWNS

      [{\"description\":\"first unknown\",\"unknownId\":\"U-1\"},{\"description\":\"second unknown\",\"unknownId\":\"U-2\"}]

      ## QUESTION

      Choose the bounded safe option?

      ## OPTIONS

      [{\"impact\":\"No mutation\",\"label\":\"Hold\",\"optionId\":\"HOLD\"},{\"impact\":\"Use approved scope\",\"label\":\"Proceed\",\"optionId\":\"PROCEED\"}]

      ## ADVISOR_RECOMMENDATION

      {\"optionId\":\"HOLD\",\"rationale\":\"Fail closed\"}

      ## SAFE_DEFAULT

      HOLD

      ## RETURN_RESULT_TO

      Advisor

      ## DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY

      true
      "
    `);
  });
});
