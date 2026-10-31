import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONFIG_FILE,
  IMPLICIT_SPEC_FILES,
  WORKSPACE_DIR,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from "./schema.js";

export interface InitWorkspaceOptions {
  /** Directory that will contain `.kilngen/`. */
  dir: string;
  name?: string;
  /** Spec paths relative to `dir`. Defaults to an `openapi.*` file found in `dir`, else `openapi.yaml`. */
  specs?: string[];
  /** Config path relative to `dir`. Defaults to `kilngen.yml`. */
  config?: string;
  force?: boolean;
}

export interface InitWorkspaceResult {
  workspaceFile: string;
  created: string[];
}

export class WorkspaceExistsError extends Error {
  constructor(readonly file: string) {
    super(`${file} already exists (use --force to overwrite)`);
  }
}

export async function initWorkspace(options: InitWorkspaceOptions): Promise<InitWorkspaceResult> {
  const dir = path.resolve(options.dir);
  const wsDir = path.join(dir, WORKSPACE_DIR);
  const workspaceFile = path.join(wsDir, WORKSPACE_FILE);
  if (existsSync(workspaceFile) && !options.force) throw new WorkspaceExistsError(workspaceFile);

  const specs = options.specs ?? [
    IMPLICIT_SPEC_FILES.find((f) => existsSync(path.join(dir, f))) ?? IMPLICIT_SPEC_FILES[0],
  ];
  const config = options.config ?? CONFIG_FILE;
  const name = options.name ?? toProjectName(path.basename(dir));

  // Paths in workspace.json are relative to the .kilngen directory.
  const fromWsDir = (p: string) => toPosix(path.relative(wsDir, path.resolve(dir, p)));
  const workspace: WorkspaceFile = {
    version: 1,
    name,
    openapi_specs: specs.map(fromWsDir),
    config: fromWsDir(config),
    targets: {},
    toolchain: "host",
  };

  const created: string[] = [];
  await mkdir(path.join(wsDir, "state"), { recursive: true });
  await writeFile(workspaceFile, `${JSON.stringify(workspace, null, 2)}\n`);
  created.push(workspaceFile);

  const gitignore = path.join(wsDir, ".gitignore");
  if (!existsSync(gitignore)) {
    await writeFile(gitignore, "local.json\ncache/\nbuilds/\n");
    created.push(gitignore);
  }

  const configPath = path.resolve(dir, config);
  if (!existsSync(configPath)) {
    await writeFile(configPath, starterConfig(name));
    created.push(configPath);
  }
  return { workspaceFile, created };
}

function toProjectName(base: string): string {
  const name = base
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^[^a-z]+/, "")
    .replace(/-+$/, "");
  return name || "api";
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function starterConfig(name: string): string {
  const now = new Date();
  const edition = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `version: 1
edition: ${edition}

project:
  name: ${name}

resources: {}

targets: {}
`;
}
