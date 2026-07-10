import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

import { ObservationError } from '../../adapters/observations/errors.js';

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export const ROOT_CAPABILITIES = ['GIT', 'MANIFEST', 'ARTIFACT', 'WORKSPACE'] as const;
export type RootCapability = (typeof ROOT_CAPABILITIES)[number];

export interface TrustedRootRegistration {
  readonly rootId: string;
  readonly absolutePath: string;
  readonly capabilities: readonly RootCapability[];
}

export interface LocalProjectRegistration {
  readonly projectId: string;
  readonly displayName: string;
  readonly hostId: string;
  readonly roots: readonly TrustedRootRegistration[];
}

export interface TrustedRoot {
  readonly projectId: string;
  readonly rootId: string;
  readonly canonicalPath: string;
  readonly capabilities: readonly RootCapability[];
}

export interface ProjectSummary {
  readonly projectId: string;
  readonly displayName: string;
  readonly hostId: string;
  readonly rootIds: readonly string[];
}

export class LocalProjectRegistry {
  readonly #projects: ReadonlyMap<string, ProjectSummary>;
  readonly #roots: ReadonlyMap<string, TrustedRoot>;

  private constructor(projects: ReadonlyMap<string, ProjectSummary>, roots: ReadonlyMap<string, TrustedRoot>) {
    this.#projects = projects;
    this.#roots = roots;
  }

  public static async create(
    registrations: readonly LocalProjectRegistration[],
  ): Promise<LocalProjectRegistry> {
    const { projects, roots } = await validateRegistrations(registrations);
    return new LocalProjectRegistry(projects, roots);
  }

  public listProjects(): readonly ProjectSummary[] {
    return [...this.#projects.values()].sort((left, right) => left.projectId.localeCompare(right.projectId));
  }

  public getProject(projectId: string): ProjectSummary {
    const project = this.#projects.get(projectId);
    if (project === undefined) {
      throw new ObservationError('PROJECT_NOT_FOUND', `project ID is not registered: ${projectId}`);
    }
    return project;
  }

  public getTrustedRoot(
    projectId: string,
    rootId: string,
    requiredCapability: RootCapability,
  ): TrustedRoot {
    this.getProject(projectId);
    const root = this.#roots.get(rootKey(projectId, rootId));
    if (root?.capabilities.includes(requiredCapability) !== true) {
      throw new ObservationError(
        'ROOT_NOT_ALLOWED',
        `root ID is not registered for ${requiredCapability}: ${projectId}/${rootId}`,
      );
    }
    return root;
  }
}

export async function createLocalProjectRegistry(
  registrations: readonly LocalProjectRegistration[],
): Promise<LocalProjectRegistry> {
  return LocalProjectRegistry.create(registrations);
}

async function validateRegistrations(
  registrations: readonly LocalProjectRegistration[],
): Promise<{
  readonly projects: ReadonlyMap<string, ProjectSummary>;
  readonly roots: ReadonlyMap<string, TrustedRoot>;
}> {
  if (registrations.length === 0) {
    throw new ObservationError('CONFIG_INVALID', 'at least one local project must be registered');
  }
  const projects = new Map<string, ProjectSummary>();
  const roots = new Map<string, TrustedRoot>();
  const rootsByProject: { readonly projectId: string; readonly canonicalPath: string }[] = [];

  for (const registration of registrations) {
    assertStableId(registration.projectId, 'projectId');
    assertStableId(registration.hostId, 'hostId');
    if (registration.displayName.trim().length === 0 || registration.roots.length === 0) {
      throw new ObservationError('CONFIG_INVALID', 'project display name and roots are required');
    }
    if (projects.has(registration.projectId)) {
      throw new ObservationError('CONFIG_INVALID', `duplicate project ID: ${registration.projectId}`);
    }
    const rootIds = new Set<string>();
    for (const rootRegistration of registration.roots) {
      assertStableId(rootRegistration.rootId, 'rootId');
      if (rootIds.has(rootRegistration.rootId)) {
        throw new ObservationError('CONFIG_INVALID', `duplicate root ID: ${rootRegistration.rootId}`);
      }
      rootIds.add(rootRegistration.rootId);
      if (!path.isAbsolute(rootRegistration.absolutePath) || rootRegistration.capabilities.length === 0) {
        throw new ObservationError('CONFIG_INVALID', 'trusted roots must be absolute and have capabilities');
      }
      if (rootRegistration.capabilities.some((item) => !ROOT_CAPABILITIES.includes(item))) {
        throw new ObservationError('CONFIG_INVALID', 'trusted root has an unknown capability');
      }
      const info = await lstat(rootRegistration.absolutePath).catch((error: unknown) => {
        throw new ObservationError('CONFIG_INVALID', 'trusted root is unavailable', { cause: error });
      });
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new ObservationError('CONFIG_INVALID', 'trusted root must be a non-symlink directory');
      }
      const canonicalPath = await realpath(rootRegistration.absolutePath);
      for (const existing of rootsByProject) {
        if (
          existing.projectId !== registration.projectId &&
          pathsOverlap(existing.canonicalPath, canonicalPath)
        ) {
          throw new ObservationError('CONFIG_INVALID', 'trusted roots cannot overlap across projects');
        }
      }
      rootsByProject.push({ projectId: registration.projectId, canonicalPath });
      roots.set(rootKey(registration.projectId, rootRegistration.rootId), {
        projectId: registration.projectId,
        rootId: rootRegistration.rootId,
        canonicalPath,
        capabilities: [...new Set(rootRegistration.capabilities)],
      });
    }
    projects.set(registration.projectId, {
      projectId: registration.projectId,
      displayName: registration.displayName,
      hostId: registration.hostId,
      rootIds: [...rootIds].sort(),
    });
  }
  return { projects, roots };
}

export function assertStableId(value: string, label: string): void {
  if (!STABLE_ID.test(value)) {
    throw new ObservationError('CONFIG_INVALID', `${label} is not a stable ID`);
  }
}

function rootKey(projectId: string, rootId: string): string {
  return `${projectId}\u0000${rootId}`;
}

function pathsOverlap(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}${path.sep}`) ||
    right.startsWith(`${left}${path.sep}`)
  );
}
