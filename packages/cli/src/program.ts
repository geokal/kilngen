import { Command, CommanderError, Option } from "commander";
import { lintCommand } from "./commands/lint.js";
import { workspaceInitCommand, workspaceStatusCommand } from "./commands/workspace.js";
import { processIo, type Io } from "./io.js";
import { VERSION } from "./version.js";

export type OutputFormat = "text" | "json";

const formatOption = () =>
  new Option("--format <format>", "output format").choices(["text", "json"]).default("text");

/** Runs the CLI and returns the process exit code. */
export async function run(argv: string[], io: Io = processIo): Promise<number> {
  let exitCode = 0;
  const program = new Command()
    .name("kilngen")
    .description("Generate SDKs, docs, CLIs, MCP servers and Terraform providers from OpenAPI, locally.")
    .version(VERSION)
    .option("--workspace <path>", "workspace.json file or directory (default: search upward from cwd)")
    .exitOverride()
    .configureOutput({ writeOut: io.out, writeErr: io.err });

  const globals = () => program.opts<{ workspace?: string }>();

  const workspace = program.command("workspace").description("manage the .kilngen workspace");
  workspace
    .command("init")
    .description("create .kilngen/workspace.json (and a starter kilngen.yml if missing)")
    .argument("[dir]", "directory to initialize", ".")
    .option("--name <name>", "workspace name (default: directory name)")
    .option("--spec <path...>", "OpenAPI spec path(s), relative to <dir>")
    .option("--config <path>", "kilngen.yml path, relative to <dir>")
    .option("--force", "overwrite an existing workspace.json")
    .action(
      async (dir: string, opts: { name?: string; spec?: string[]; config?: string; force?: boolean }) => {
        exitCode = await workspaceInitCommand(io, { dir, ...opts });
      },
    );
  workspace
    .command("status")
    .description("show the resolved workspace and the state of each target's output repo")
    .addOption(formatOption())
    .action(async (opts: { format: OutputFormat }) => {
      exitCode = await workspaceStatusCommand(io, { ...globals(), format: opts.format });
    });

  program
    .command("lint")
    .description("validate kilngen.yml, the workspace and the OpenAPI specs")
    .addOption(formatOption())
    .action(async (opts: { format: OutputFormat }) => {
      exitCode = await lintCommand(io, { ...globals(), format: opts.format });
    });

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (e) {
    if (e instanceof CommanderError) return e.exitCode;
    throw e;
  }
  return exitCode;
}
