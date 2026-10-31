import { existsSync } from "node:fs";
import path from "node:path";
import {
  initWorkspace,
  inspectOutputPath,
  loadWorkspace,
  WorkspaceExistsError,
  type TargetRepoStatus,
} from "@kilngen/workspace";
import type { Io } from "../io.js";
import type { OutputFormat } from "../program.js";
import { printDiagnostics, relativeTo } from "./print.js";

export async function workspaceInitCommand(
  io: Io,
  options: { dir: string; name?: string; spec?: string[]; config?: string; force?: boolean },
): Promise<number> {
  const rel = relativeTo(io.cwd);
  try {
    const result = await initWorkspace({
      dir: path.resolve(io.cwd, options.dir),
      ...(options.name !== undefined && { name: options.name }),
      ...(options.spec !== undefined && { specs: options.spec }),
      ...(options.config !== undefined && { config: options.config }),
      ...(options.force !== undefined && { force: options.force }),
    });
    for (const file of result.created) io.out(`created ${rel(file)}\n`);
    return 0;
  } catch (e) {
    if (e instanceof WorkspaceExistsError) {
      io.err(`error: ${rel(e.file)} already exists (use --force to overwrite)\n`);
      return 1;
    }
    throw e;
  }
}

export async function workspaceStatusCommand(
  io: Io,
  options: { workspace?: string; format: OutputFormat },
): Promise<number> {
  const { workspace, diagnostics } = await loadWorkspace({
    cwd: io.cwd,
    ...(options.workspace !== undefined && { workspace: options.workspace }),
  });
  if (!workspace) {
    if (options.format === "json") io.out(`${JSON.stringify({ ok: false, diagnostics }, null, 2)}\n`);
    else printDiagnostics(io, diagnostics);
    return 1;
  }

  const targets: Record<string, { outputPath: string; integrationBranch: string } & TargetRepoStatus> = {};
  for (const [id, t] of Object.entries(workspace.targets)) {
    targets[id] = { ...t, ...(await inspectOutputPath(t.outputPath)) };
  }
  const specs = workspace.specPaths.map((p) => ({ path: p, exists: existsSync(p) }));
  const config = { path: workspace.configPath, exists: existsSync(workspace.configPath) };

  if (options.format === "json") {
    io.out(`${JSON.stringify({ ok: true, workspace: { ...workspace, specs, config, targets } }, null, 2)}\n`);
    return 0;
  }

  const rel = relativeTo(io.cwd);
  const mark = (exists: boolean) => (exists ? "" : "  (missing)");
  io.out(`workspace  ${workspace.name} (${workspace.kind})\n`);
  if (workspace.workspaceFile) io.out(`file       ${rel(workspace.workspaceFile)}\n`);
  if (workspace.localOverridesFile) io.out(`overrides  ${rel(workspace.localOverridesFile)}\n`);
  io.out(`config     ${rel(config.path)}${mark(config.exists)}\n`);
  for (const s of specs) io.out(`spec       ${rel(s.path)}${mark(s.exists)}\n`);
  io.out(`toolchain  ${workspace.toolchain}\n`);
  const entries = Object.entries(targets);
  if (entries.length === 0) io.out("targets    (none)\n");
  for (const [id, t] of entries) {
    const state = !t.exists
      ? "not created yet"
      : !t.isGitRepo
        ? "not a git repo"
        : `git ${t.branch}, ${t.clean ? "clean" : "uncommitted changes"}`;
    io.out(`target     ${id.padEnd(10)} ${rel(t.outputPath)}  [${state}]\n`);
  }
  return 0;
}
