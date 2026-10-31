import { cpSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Io } from "../src/io.js";
import { run } from "../src/program.js";

const examples = fileURLToPath(new URL("../../../examples", import.meta.url));

function io(cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const value: Io = { cwd, out: (s) => out.push(s), err: (s) => err.push(s) };
  return { io: value, stdout: () => out.join(""), stderr: () => err.join("") };
}

function copyPetstore(): string {
  const dir = path.join(realpathSync(mkdtempSync(path.join(tmpdir(), "kilngen-cli-"))), "petstore");
  cpSync(path.join(examples, "petstore"), dir, { recursive: true });
  return dir;
}

describe("kilngen lint", () => {
  it("passes on the petstore example, found by walking up from a subdirectory", async () => {
    const t = io(path.join(examples, "petstore", ".kilngen"));
    expect(await run(["lint"], t.io)).toBe(0);
    expect(t.stdout()).toContain("lint passed: 0 errors, 0 warnings");
  });

  it("fails with located diagnostics when the config is wrong", async () => {
    const dir = copyPetstore();
    const config = path.join(dir, "kilngen.yml");
    writeFileSync(
      config,
      readFileSync(config, "utf8").replace("retrieve: get /pets/{pet_id}", "retrieve: get /pet/{id}"),
    );

    const t = io(dir);
    expect(await run(["lint"], t.io)).toBe(1);
    expect(t.stderr()).toMatch(
      /^kilngen\.yml:\d+:\d+ error K0201 pets\.retrieve: endpoint "get \/pet\/\{id\}"/m,
    );
    expect(t.stdout()).toContain("lint failed: 1 error, 1 warning");
  });

  it("emits JSON and honours diagnostics.ignore", async () => {
    const dir = copyPetstore();
    const config = path.join(dir, "kilngen.yml");
    writeFileSync(
      config,
      readFileSync(config, "utf8").replace("      delete: delete /pets/{pet_id}\n", "") +
        "\ndiagnostics:\n  ignore: [K0203]\n",
    );
    const t = io(dir);
    expect(await run(["lint", "--format", "json"], t.io)).toBe(0);
    expect(JSON.parse(t.stdout())).toEqual({ ok: true, diagnostics: [] });
  });

  it("reports a missing workspace", async () => {
    const t = io(realpathSync(mkdtempSync(path.join(tmpdir(), "kilngen-empty-"))));
    expect(await run(["lint"], t.io)).toBe(1);
    expect(t.stderr()).toContain("error K0100");
  });
});

describe("kilngen workspace", () => {
  it("init then status", async () => {
    const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "kilngen-cli-")));
    const t = io(dir);
    expect(await run(["workspace", "init", "--name", "acme"], t.io)).toBe(0);
    expect(t.stdout()).toContain("created .kilngen/workspace.json");
    expect(await run(["workspace", "init"], t.io)).toBe(1);

    const s = io(dir);
    expect(await run(["workspace", "status"], s.io)).toBe(0);
    expect(s.stdout()).toContain("workspace  acme (explicit)");
    expect(s.stdout()).toContain("spec       openapi.yaml  (missing)");
  });

  it("status --format json with --workspace", async () => {
    const t = io(examples);
    expect(await run(["--workspace", "petstore", "workspace", "status", "--format", "json"], t.io)).toBe(0);
    const json = JSON.parse(t.stdout());
    expect(json.workspace.name).toBe("petstore");
    expect(json.workspace.targets.typescript).toMatchObject({ exists: false, integrationBranch: "main" });
  });

  it("prints help and version", async () => {
    const t = io(examples);
    expect(await run(["--version"], t.io)).toBe(0);
    expect(t.stdout()).toBe("0.0.0\n");
  });
});
