import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findWorkspaceFile, loadWorkspace } from "../src/index.js";

function tmp(): string {
  return realpathSync(mkdtempSync(path.join(tmpdir(), "kilngen-ws-")));
}

function write(file: string, content: string | object): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

const workspaceJson = {
  version: 1,
  name: "acme",
  openapi_specs: ["../openapi/core.yaml"],
  config: "../kilngen.yml",
  targets: {
    typescript: { output_path: "../../sdks/acme-ts" },
    go: { output_path: "../../sdks/acme-go", integration_branch: "develop" },
  },
};

describe("loadWorkspace", () => {
  it("walks up to the nearest .kilngen/workspace.json and resolves paths relative to it", async () => {
    const root = tmp();
    const api = path.join(root, "api");
    write(path.join(api, ".kilngen/workspace.json"), workspaceJson);
    const nested = path.join(api, "openapi/deep/er");
    mkdirSync(nested, { recursive: true });

    expect(findWorkspaceFile(nested)).toBe(path.join(api, ".kilngen/workspace.json"));
    const { workspace, diagnostics } = await loadWorkspace({ cwd: nested });
    expect(diagnostics).toEqual([]);
    expect(workspace).toMatchObject({
      kind: "explicit",
      name: "acme",
      root: api,
      specPaths: [path.join(api, "openapi/core.yaml")],
      configPath: path.join(api, "kilngen.yml"),
      targets: {
        typescript: { outputPath: path.join(root, "sdks/acme-ts"), integrationBranch: "main" },
        go: { outputPath: path.join(root, "sdks/acme-go"), integrationBranch: "develop" },
      },
      toolchain: "host",
    });
  });

  it("accepts --workspace as a directory, a .kilngen directory, or a file", async () => {
    const root = tmp();
    write(path.join(root, "api/.kilngen/workspace.json"), workspaceJson);
    for (const given of ["api", "api/.kilngen", "api/.kilngen/workspace.json"]) {
      const { workspace } = await loadWorkspace({ cwd: root, workspace: given });
      expect(workspace?.name).toBe("acme");
    }
    const missing = await loadWorkspace({ cwd: root, workspace: "nope" });
    expect(missing.diagnostics.map((d) => d.code)).toEqual(["K0101"]);
  });

  it("merges .kilngen/local.json over the workspace file", async () => {
    const root = tmp();
    write(path.join(root, ".kilngen/workspace.json"), workspaceJson);
    write(path.join(root, ".kilngen/local.json"), {
      toolchain: "docker",
      targets: {
        typescript: { output_path: "/elsewhere/acme-ts" },
        go: { integration_branch: "my-branch" },
        cli: { output_path: "../cli" },
      },
    });
    const { workspace } = await loadWorkspace({ cwd: root });
    expect(workspace?.localOverridesFile).toBe(path.join(root, ".kilngen/local.json"));
    expect(workspace?.toolchain).toBe("docker");
    expect(workspace?.targets).toEqual({
      typescript: { outputPath: "/elsewhere/acme-ts", integrationBranch: "main" },
      go: { outputPath: path.join(path.dirname(root), "sdks/acme-go"), integrationBranch: "my-branch" },
      cli: { outputPath: path.join(root, "cli"), integrationBranch: "main" },
    });
  });

  it("falls back to an implicit workspace", async () => {
    const root = tmp();
    write(path.join(root, "openapi.yml"), "openapi: 3.1.0\n");
    write(path.join(root, "kilngen.yml"), "version: 1\n");
    const { workspace } = await loadWorkspace({ cwd: root });
    expect(workspace).toMatchObject({
      kind: "implicit",
      name: path.basename(root),
      specPaths: [path.join(root, "openapi.yml")],
      configPath: path.join(root, "kilngen.yml"),
      targets: {},
    });
  });

  it("reports when no workspace exists", async () => {
    const { workspace, diagnostics } = await loadWorkspace({ cwd: tmp() });
    expect(workspace).toBeUndefined();
    expect(diagnostics.map((d) => d.code)).toEqual(["K0100"]);
  });

  it("reports invalid JSON and schema errors with locations", async () => {
    const bad = tmp();
    write(path.join(bad, ".kilngen/workspace.json"), "{ nope");
    expect((await loadWorkspace({ cwd: bad })).diagnostics.map((d) => d.code)).toEqual(["K0004"]);

    const invalid = tmp();
    write(path.join(invalid, ".kilngen/workspace.json"), {
      ...workspaceJson,
      targets: { rust: { output_path: "x" } },
      extra: true,
    });
    const { diagnostics } = await loadWorkspace({ cwd: invalid });
    expect(diagnostics.map((d) => [d.code, d.path])).toEqual(
      expect.arrayContaining([
        ["K0003", ["extra"]],
        ["K0003", ["targets", "rust"]],
      ]),
    );
    expect(diagnostics.every((d) => d.location?.line !== undefined)).toBe(true);
  });
});
