import type { JsonValue, SourceArtifactRef } from '../../contracts/types.js';
import { DomainError } from '../../contracts/types.js';
import { canonicalize } from '../../persistence/file-store/canonical-json.js';
import { hashCanonical } from '../../persistence/file-store/hashing.js';

export const GPT_PACKAGE_FIELDS = [
  'TARGET_ACTOR',
  'MISSION',
  'REQUEST_ID',
  'SOURCE_ADVISOR_JOB',
  'READ_DECISION_REQUEST',
  'CONFIRMED_FACTS',
  'UNKNOWNS',
  'QUESTION',
  'OPTIONS',
  'ADVISOR_RECOMMENDATION',
  'SAFE_DEFAULT',
  'RETURN_RESULT_TO',
  'DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY',
] as const;

export interface ConfirmedFact {
  readonly factId: string;
  readonly value: JsonValue;
  readonly evidenceRefs: readonly SourceArtifactRef[];
}

export interface DecisionUnknown {
  readonly unknownId: string;
  readonly description: string;
}

export interface DecisionOption {
  readonly optionId: string;
  readonly label: string;
  readonly impact: string;
}

export interface AdvisorRecommendation {
  readonly optionId: string;
  readonly rationale: string;
}

export interface GptDecisionPackage {
  readonly TARGET_ACTOR: 'Leo/GPT';
  readonly MISSION: string;
  readonly REQUEST_ID: string;
  readonly SOURCE_ADVISOR_JOB: SourceArtifactRef;
  readonly READ_DECISION_REQUEST: SourceArtifactRef;
  readonly CONFIRMED_FACTS: readonly ConfirmedFact[];
  readonly UNKNOWNS: readonly DecisionUnknown[];
  readonly QUESTION: string;
  readonly OPTIONS: readonly DecisionOption[];
  readonly ADVISOR_RECOMMENDATION: AdvisorRecommendation | 'NONE';
  readonly SAFE_DEFAULT: string;
  readonly RETURN_RESULT_TO: 'Advisor';
  readonly DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY: true;
}

export type GptDecisionPackageInput = Omit<
  GptDecisionPackage,
  'CONFIRMED_FACTS' | 'UNKNOWNS' | 'RETURN_RESULT_TO' | 'DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY'
> & {
  readonly CONFIRMED_FACTS: readonly ConfirmedFact[];
  readonly UNKNOWNS: readonly DecisionUnknown[];
};

export interface GptPackageArtifact {
  readonly packageId: string;
  readonly canonicalJson: string;
  readonly markdown: string;
  readonly package: GptDecisionPackage;
}

export function buildGptDecisionPackage(input: GptDecisionPackageInput): GptPackageArtifact {
  const decisionPackage: GptDecisionPackage = {
    TARGET_ACTOR: input.TARGET_ACTOR,
    MISSION: input.MISSION,
    REQUEST_ID: input.REQUEST_ID,
    SOURCE_ADVISOR_JOB: input.SOURCE_ADVISOR_JOB,
    READ_DECISION_REQUEST: input.READ_DECISION_REQUEST,
    CONFIRMED_FACTS: [...input.CONFIRMED_FACTS].sort((left, right) => compareStableId(left.factId, right.factId)),
    UNKNOWNS: [...input.UNKNOWNS].sort((left, right) => compareStableId(left.unknownId, right.unknownId)),
    QUESTION: input.QUESTION,
    OPTIONS: [...input.OPTIONS],
    ADVISOR_RECOMMENDATION: input.ADVISOR_RECOMMENDATION,
    SAFE_DEFAULT: input.SAFE_DEFAULT,
    RETURN_RESULT_TO: 'Advisor',
    DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY: true,
  };
  assertGptDecisionPackage(decisionPackage);
  const canonicalJson = canonicalize(decisionPackage);
  return {
    packageId: hashCanonical(decisionPackage),
    canonicalJson,
    markdown: renderGptDecisionPackage(decisionPackage),
    package: decisionPackage,
  };
}

export function assertGptDecisionPackage(value: GptDecisionPackage): void {
  const keys = Object.keys(value);
  if (
    keys.length !== GPT_PACKAGE_FIELDS.length ||
    keys.some((key, index) => key !== GPT_PACKAGE_FIELDS[index])
  ) {
    throw new DomainError('UNKNOWN_FIELD', 'GPT package must contain the exact ordered v1 fields');
  }
  if (
    value.TARGET_ACTOR !== 'Leo/GPT' ||
    value.RETURN_RESULT_TO !== 'Advisor' ||
    value.DO_NOT_START_ANOTHER_MISSION_AUTOMATICALLY !== true
  ) {
    throw new DomainError('UNAUTHORIZED_ACTOR', 'GPT package authority fields are invalid');
  }
  const optionIds = new Set(value.OPTIONS.map((option) => option.optionId));
  if (
    value.ADVISOR_RECOMMENDATION !== 'NONE' &&
    !optionIds.has(value.ADVISOR_RECOMMENDATION.optionId)
  ) {
    throw new DomainError('INVALID_SCHEMA', 'Advisor recommendation must reference an approved option');
  }
}

export function renderGptDecisionPackage(value: GptDecisionPackage): string {
  return GPT_PACKAGE_FIELDS.map((field) => {
    const rendered = typeof value[field] === 'string' ? value[field] : canonicalize(value[field]);
    return `## ${field}\n\n${rendered}`;
  }).join('\n\n') + '\n';
}

function compareStableId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
