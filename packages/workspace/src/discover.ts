import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  diagnostic,
  SourceFile,
  zodIssuesToDiagnostics,
  type Diagnostic,
  type TargetId,
} from "@kilngen/core";
import type { z } from "zod";
import {
  CONFIG_FILE,
  IMPLICIT_SPEC_FILES,
  LOCAL_OVERRIDES_FILE,
  LocalOverridesSchema,
  WORKSPACE_DIR,
  WORKSPACE_FILE,
  WorkspaceSchema,
  type LocalOverrides,
  type WorkspaceFile,
} from "./schema.js";

export interface ResolvedTarget {
  outputPath: string;
  integrationBranch: string;
}

export interface ResolvedWorkspace {
  kind: "explicit" | "implicit";
  name: string;
  /** Directory that contains `.kilngen/` (explicit) or the spec and config (implicit). */
  root: string;
  workspaceFile?: string;
  localOverridesFile?: string;
  /** Absolute paths. */
  specPaths: string[];
  /** Absolute path. */
  configPath: string;
  targets: Partial<Record<TargetId, ResolvedTarget>>;
  toolchain: "host" | "docker";
  releaseProfile?: string;
}

export interface LoadWorkspaceOptions {
  cwd: string;
  /** `--workspace`: a workspace.json file, a `.kilngen` directory, or a directory containing `.kilngen/`. */
  workspace?: string;
}

export interface LoadWorkspaceResult {
  workspace?: ResolvedWorkspace;
  diagnostics: Diagnostic[];
}

const DEFAULT_INTEGRATION_BRANCH = "main";

/** Walks up from `startDir` to the nearest `.kilngen/workspace.json`. */
export function findWorkspaceFile(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, WORKSPACE_DIR, WORKSPACE_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function resolveExplicitPath(cwd: string, given: string): string {
  const abs = path.resolve(cwd, given);
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    return path.basename(abs) === WORKSPACE_DIR
      ? path.join(abs, WORKSPACE_FILE)
      : path.join(abs, WORKSPACE_DIR, WORKSPACE_FILE);
  }
  return abs;
}

/**
 * Discovery order: `--workspace`, then the nearest `.kilngen/workspace.json` above `cwd`,
 * then an implicit workspace (`openapi.{yaml,yml,json}` + `kilngen.yml` in `cwd`).
 * `.kilngen/local.json` is merged on top in every case.
 */
export async function loadWorkspace(options: LoadWorkspaceOptions): Promise<LoadWorkspaceResult> {
  const cwd = path.resolve(options.cwd);
  const file = options.workspace ? resolveExplicitPath(cwd, options.workspace) : findWorkspaceFile(cwd);

  if (file) {
    if (!existsSync(file)) {
      return {
        diagnostics: [diagnostic("K0101", `workspace file not found: ${file}`, { location: { file } })],
      };
    }
    return loadExplicit(file);
  }

  const implicit = await loadImplicit(cwd);
  if (implicit) return implicit;

  return {
    diagnostics: [
      diagnostic(
        "K0100",
        `no ${WORKSPACE_DIR}/${WORKSPACE_FILE} found in ${cwd} or any parent directory, and no ` +
          `${IMPLICIT_SPEC_FILES[0]} + ${CONFIG_FILE} in ${cwd}. Run \`kilngen workspace init\`.`,
      ),
    ],
  };
}

async function loadExplicit(file: string): Promise<LoadWorkspaceResult> {
  const parsed = await readJson(file, WorkspaceSchema);
  if (!parsed.value) return { diagnostics: parsed.diagnostics };
  const ws: WorkspaceFile = parsed.value;

  const baseDir = path.dirname(file);
  const localFile = path.join(baseDir, LOCAL_OVERRIDES_FILE);
  const local = await readLocalOverrides(localFile);
  if (local.diagnostics.length > 0) return { diagnostics: local.diagnostics };
  const merged = mergeOverrides(ws, local.value);

  const resolve = (p: string) => path.resolve(baseDir, p);
  return {
    workspace: {
      kind: "explicit",
      name: merged.name,
      root: path.basename(baseDir) === WORKSPACE_DIR ? path.dirname(baseDir) : baseDir,
      workspaceFile: file,
      ...(local.value && { localOverridesFile: localFile }),
      specPaths: merged.openapi_specs.map(resolve),
      configPath: resolve(merged.config),
      targets: resolveTargets(merged.targets ?? {}, resolve),
      toolchain: merged.toolchain ?? "host",
      ...(merged.release && { releaseProfile: merged.release.profile }),
    },
    diagnostics: [],
  };
}

async function loadImplicit(cwd: string): Promise<LoadWorkspaceResult | undefined> {
  const spec = IMPLICIT_SPEC_FILES.map((f) => path.join(cwd, f)).find((f) => existsSync(f));
  const config = path.join(cwd, CONFIG_FILE);
  if (!spec || !existsSync(config)) return undefined;

  const localFile = path.join(cwd, WORKSPACE_DIR, LOCAL_OVERRIDES_FILE);
  const local = await readLocalOverrides(localFile);
  if (local.diagnostics.length > 0) return { diagnostics: local.diagnostics };
  const o = local.value ?? {};
  const resolve = (p: string) => path.resolve(path.dirname(localFile), p);

  return {
    workspace: {
      kind: "implicit",
      name: o.name ?? path.basename(cwd),
      root: cwd,
      ...(local.value && { localOverridesFile: localFile }),
      specPaths: o.openapi_specs ? o.openapi_specs.map(resolve) : [spec],
      configPath: o.config ? resolve(o.config) : config,
      targets: resolveTargets(completeTargets(o.targets ?? {}), resolve),
      toolchain: o.toolchain ?? "host",
      ...(o.release && { releaseProfile: o.release.profile }),
    },
    diagnostics: [],
  };
}

type TargetEntries = WorkspaceFile["targets"];

function resolveTargets(
  targets: NonNullable<TargetEntries>,
  resolve: (p: string) => string,
): Partial<Record<TargetId, ResolvedTarget>> {
  const out: Partial<Record<TargetId, ResolvedTarget>> = {};
  for (const [id, t] of Object.entries(targets) as [
    TargetId,
    { output_path: string; integration_branch?: string },
  ][]) {
    out[id] = {
      outputPath: resolve(t.output_path),
      integrationBranch: t.integration_branch ?? DEFAULT_INTEGRATION_BRANCH,
    };
  }
  return out;
}

/** Drops override-only target entries that never got an output_path. */
function completeTargets(targets: NonNullable<LocalOverrides["targets"]>): NonNullable<TargetEntries> {
  const out: NonNullable<TargetEntries> = {};
  for (const [id, t] of Object.entries(targets) as [
    TargetId,
    { output_path?: string; integration_branch?: string },
  ][]) {
    if (t.output_path) out[id] = { ...t, output_path: t.output_path };
  }
  return out;
}

export function mergeOverrides(ws: WorkspaceFile, local: LocalOverrides | undefined): WorkspaceFile {
  if (!local) return ws;
  const targets: NonNullable<TargetEntries> = { ...ws.targets };
  for (const [id, t] of Object.entries(local.targets ?? {}) as [
    TargetId,
    Partial<{ output_path: string; integration_branch: string }>,
  ][]) {
    const base = targets[id];
    if (base) targets[id] = { ...base, ...t };
    else if (t.output_path) targets[id] = { ...t, output_path: t.output_path };
  }
  return {
    ...ws,
    ...(local.name !== undefined && { name: local.name }),
    ...(local.openapi_specs !== undefined && { openapi_specs: local.openapi_specs }),
    ...(local.config !== undefined && { config: local.config }),
    ...(local.toolchain !== undefined && { toolchain: local.toolchain }),
    ...(local.release !== undefined && { release: local.release }),
    targets,
  };
}

async function readLocalOverrides(
  file: string,
): Promise<{ value?: LocalOverrides; diagnostics: Diagnostic[] }> {
  if (!existsSync(file)) return { diagnostics: [] };
  return readJson(file, LocalOverridesSchema);
}

async function readJson<T>(
  file: string,
  schema: z.ZodType<T>,
): Promise<{ value?: T; diagnostics: Diagnostic[] }> {
  const text = await readFile(file, "utf8");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { diagnostics: [diagnostic("K0004", (e as Error).message, { location: { file } })] };
  }
  const result = schema.safeParse(data);
  if (result.success) return { value: result.data, diagnostics: [] };
  // JSON is valid YAML, so reuse the YAML source map for line/column positions.
  const { source } = SourceFile.parse(file, text);
  return { diagnostics: zodIssuesToDiagnostics(result.error.issues, source, "K0005") };
}
