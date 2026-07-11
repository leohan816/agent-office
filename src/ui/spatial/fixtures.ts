import { createSpatialOfficeFixtureInput } from '../../application/spatial-office/fixtures.js';
import { projectSpatialOffice } from '../../application/spatial-office/projector.js';
import type { SpatialOfficeProjectionV1 } from '../../application/spatial-office/types.js';
import {
  PROJECT_IDENTITY_CATALOG_VERSION,
  resolveProjectIdentity,
} from './project-identity.js';

export const STATIC_SPATIAL_OFFICE_FIXTURE_ID = 'ao12-b-static-shared-floor' as const;

export interface StaticSpatialOfficeFixture {
  readonly fixtureId: typeof STATIC_SPATIAL_OFFICE_FIXTURE_ID;
  readonly fixtureKind: 'SYNTHETIC_NON_OPERATIONAL_STATIC';
  readonly label: string;
  readonly projection: SpatialOfficeProjectionV1;
}

export function createStaticSpatialOfficeFixture(): StaticSpatialOfficeFixture {
  const source = createSpatialOfficeFixtureInput();
  const projects = source.projects.map((project) => {
    const identity = resolveProjectIdentity(project.projectId, project.displayName);
    return {
      ...project,
      projectIdentity: {
        catalogEntryId: identity.catalogEntryId,
        textId: identity.projectId,
        displayName: identity.displayName,
      },
    };
  });
  return {
    fixtureId: STATIC_SPATIAL_OFFICE_FIXTURE_ID,
    fixtureKind: 'SYNTHETIC_NON_OPERATIONAL_STATIC',
    label: 'AO12-B synthetic static shared floor',
    projection: projectSpatialOffice({
      ...source,
      identityCatalogVersion: PROJECT_IDENTITY_CATALOG_VERSION,
      projects,
    }),
  };
}

export const STATIC_SPATIAL_OFFICE_FIXTURE = createStaticSpatialOfficeFixture();
