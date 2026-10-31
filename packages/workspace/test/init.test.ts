import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initWorkspace, inspectOutputPath, loadWorkspace, WorkspaceExistsError } from "../src/index.js";

const tmp = () => realpathSync(mkdtempSync(path.join(tmpdir(), "kilngen-init-")));

describe("initWorkspace", () => {
  it("creates a workspace that loadWorkspace resolves back to the same files", async () => {
    const dir = path.join(tmp(), "My API");
    mkdirSync(dir);
    writeFileSync(path.join(dir, "openapi.json"), "{}");

    const result = await initWorkspace({ dir });
    expect(result.created.map((f) => path.relative(dir, f)).sort()).toEqual([
      ".kilngen/.gitignore",
      ".kilngen/workspace.json",
      "kilngen.yml",
    ]);
    const json = JSON.parse(readFileSync(result.workspaceFile, "utf8"));
    expect(json).toMatchObject({
      version: 1,
      name: "my-api",
      openapi_specs: ["../openapi.json"],
      config: "../kilngen.yml",
    });
    expect(readFileSync(path.join(dir, "kilngen.yml"), "utf8")).toContain("name: my-api");

    const { workspace } = await loadWorkspace({ cwd: dir });
    expect(workspace?.specPaths).toEqual([path.join(dir, "openapi.json")]);
    expect(workspace?.configPath).toBe(path.join(dir, "kilngen.yml"));
  });

  it("refuses to overwrite without force and keeps an existing config", async () => {
    const dir = tmp();
    writeFileSync(path.join(dir, "kilngen.yml"), "custom: true\n");
    await initWorkspace({ dir, name: "acme" });
    await expect(initWorkspace({ dir })).rejects.toBeInstanceOf(WorkspaceExistsError);
    const again = await initWorkspace({ dir, force: true, specs: ["specs/a.yaml"] });
    expect(again.created).toEqual([again.workspaceFile]);
    expect(readFileSync(path.join(dir, "kilngen.yml"), "utf8")).toBe("custom: true\n");
  });
});

describe("inspectOutputPath", () => {
  it("distinguishes missing, plain and git directories", async () => {
    const root = tmp();
    expect(await inspectOutputPath(path.join(root, "missing"))).toEqual({ exists: false, isGitRepo: false });
    expect(await inspectOutputPath(root)).toEqual({ exists: true, isGitRepo: false });

    const repo = path.join(root, "repo");
    mkdirSync(repo);
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    expect(await inspectOutputPath(repo)).toEqual({
      exists: true,
      isGitRepo: true,
      branch: "main",
      clean: true,
    });
    writeFileSync(path.join(repo, "x.txt"), "x");
    expect(await inspectOutputPath(repo)).toMatchObject({ clean: false });
  });
});
