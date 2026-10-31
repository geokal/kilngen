import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  applySeverityOverrides,
  checkConfigAgainstSpecs,
  diagnostic,
  hasErrors,
  loadSpec,
  parseConfig,
  type Diagnostic,
  type LoadedSpec,
} from "@kilngen/core";
import { loadWorkspace, type ResolvedWorkspace } from "@kilngen/workspace";
import type { Io } from "../io.js";
import type { OutputFormat } from "../program.js";
import { printDiagnostics, summarize } from "./print.js";

export interface LintOptions {
  cwd: string;
  workspace?: string;
}

export interface LintResult {
  workspace?: ResolvedWorkspace;
  diagnostics: Diagnostic[];
}

export async function lint(options: LintOptions): Promise<LintResult> {
  const loaded = await loadWorkspace(options);
  const workspace = loaded.workspace;
  if (!workspace) return { diagnostics: loaded.diagnostics };

  if (!existsSync(workspace.configPath)) {
    return {
      workspace,
      diagnostics: [
        diagnostic("K0101", `config not found: ${workspace.configPath}`, {
          location: { file: workspace.workspaceFile ?? workspace.configPath },
        }),
      ],
    };
  }
  const parsed = parseConfig(await readFile(workspace.configPath, "utf8"), workspace.configPath);
  const diagnostics = [...parsed.diagnostics];
  const config = parsed.config;
  if (!config) return { workspace, diagnostics };

  // An explicit workspace owns spec locations; an implicit one may take them from kilngen.yml.
  let specPaths = workspace.specPaths;
  const configSpecs = config.spec?.paths ?? (config.spec?.path ? [config.spec.path] : undefined);
  if (workspace.kind === "implicit" && configSpecs && !workspace.localOverridesFile) {
    specPaths = configSpecs.map((p) => path.resolve(path.dirname(workspace.configPath), p));
  }

  const specs: LoadedSpec[] = [];
  for (const file of specPaths) {
    const result = await loadSpec(file);
    diagnostics.push(...result.diagnostics);
    if (result.spec) specs.push(result.spec);
  }
  if (specs.length === specPaths.length) {
    diagnostics.push(...checkConfigAgainstSpecs(config, specs, parsed.source));
  }
  return { workspace, diagnostics: applySeverityOverrides(diagnostics, config.diagnostics) };
}

export async function lintCommand(
  io: Io,
  options: { workspace?: string; format: OutputFormat },
): Promise<number> {
  const result = await lint({
    cwd: io.cwd,
    ...(options.workspace !== undefined && { workspace: options.workspace }),
  });
  const failed = hasErrors(result.diagnostics);
  if (options.format === "json") {
    io.out(`${JSON.stringify({ ok: !failed, diagnostics: result.diagnostics }, null, 2)}\n`);
  } else {
    printDiagnostics(io, result.diagnostics);
    io.out(`${failed ? "lint failed" : "lint passed"}: ${summarize(result.diagnostics)}\n`);
  }
  return failed ? 1 : 0;
}
