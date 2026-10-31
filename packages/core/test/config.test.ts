import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applySeverityOverrides, parseConfig } from "../src/index.js";

const example = readFileSync(new URL("../../../examples/petstore/kilngen.yml", import.meta.url), "utf8");

const minimal = (extra = "") => `version: 1
edition: 2026-11
project:
  name: acme
${extra}`;

describe("parseConfig", () => {
  it("accepts the petstore example", () => {
    const result = parseConfig(example, "kilngen.yml");
    expect(result.diagnostics).toEqual([]);
    expect(result.config?.resources?.pets?.methods?.list).toEqual({
      endpoint: "get /pets",
      pagination: "cursor_page",
    });
  });

  it("reports YAML syntax errors with a location", () => {
    const { diagnostics, config } = parseConfig("version: 1\nproject: [\n", "kilngen.yml");
    expect(config).toBeUndefined();
    expect(diagnostics[0]).toMatchObject({
      code: "K0001",
      severity: "error",
      location: { file: "kilngen.yml" },
    });
  });

  it("reports unknown keys at the key's line and column", () => {
    const text = minimal("resources:\n  pets:\n    methodz:\n      list: get /pets\n");
    const { diagnostics } = parseConfig(text, "kilngen.yml");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "K0003",
        path: ["resources", "pets", "methodz"],
        location: { file: "kilngen.yml", line: 7, column: 5 },
      }),
    ]);
  });

  it("rejects malformed endpoint shorthand", () => {
    const text = minimal("resources:\n  pets:\n    methods:\n      list: GET pets\n");
    const { diagnostics } = parseConfig(text, "kilngen.yml");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "K0002",
      path: ["resources", "pets", "methods", "list"],
      location: { line: 8, column: 13 },
    });
    expect(diagnostics[0]!.message).toContain('expected "<verb> /path"');
  });

  it("reports missing required fields", () => {
    const { diagnostics } = parseConfig("version: 1\nproject:\n  name: acme\n", "kilngen.yml");
    expect(diagnostics).toEqual([expect.objectContaining({ code: "K0002", path: ["edition"] })]);
    expect(diagnostics[0]!.message).toContain("required");
  });

  it("validates nested subresources", () => {
    const text = minimal(
      "resources:\n  projects:\n    subresources:\n      members:\n        methods:\n          add: bogus\n",
    );
    const { diagnostics } = parseConfig(text, "kilngen.yml");
    expect(diagnostics[0]?.path).toEqual([
      "resources",
      "projects",
      "subresources",
      "members",
      "methods",
      "add",
    ]);
  });
});

describe("config semantics", () => {
  it("flags unknown pagination schemes", () => {
    const text = minimal(
      "resources:\n  pets:\n    methods:\n      list: { endpoint: get /pets, pagination: nope }\n",
    );
    const { diagnostics } = parseConfig(text, "kilngen.yml");
    expect(diagnostics.map((d) => d.code)).toEqual(["K0103"]);
  });

  it("requires the typescript target for mcp and go for cli/terraform", () => {
    const text = minimal(
      "targets:\n  mcp: { package: '@acme/mcp' }\n  cli: { binary: acme, module: example.com/acme-cli }\n",
    );
    const { diagnostics } = parseConfig(text, "kilngen.yml");
    expect(diagnostics.map((d) => [d.code, d.path])).toEqual([
      ["K0105", ["targets", "mcp"]],
      ["K0105", ["targets", "cli"]],
    ]);
  });

  it("flags references to undefined auth schemes", () => {
    const text = minimal(
      "auth:\n  default: [oauth]\n  schemes:\n    bearer: { type: http, scheme: bearer }\n",
    );
    const { diagnostics } = parseConfig(text, "kilngen.yml");
    expect(diagnostics).toEqual([expect.objectContaining({ code: "K0106", path: ["auth", "default", 0] })]);
  });

  it("warns when an endpoint is mapped twice", () => {
    const text = minimal(
      "resources:\n  a:\n    methods: { list: get /x }\n  b:\n    methods: { list: get /x }\n",
    );
    const { diagnostics } = parseConfig(text, "kilngen.yml");
    expect(diagnostics).toEqual([expect.objectContaining({ code: "K0107", severity: "warning" })]);
  });
});

describe("applySeverityOverrides", () => {
  it("ignores, promotes and demotes by code", () => {
    const diags = [
      { code: "K0107", severity: "warning" as const, message: "a" },
      { code: "K0203", severity: "warning" as const, message: "b" },
      { code: "K0201", severity: "error" as const, message: "c" },
    ];
    const out = applySeverityOverrides(diags, { ignore: ["K0203"], error: ["K0107"], warn: ["K0201"] });
    expect(out.map((d) => [d.code, d.severity])).toEqual([
      ["K0107", "error"],
      ["K0201", "warning"],
    ]);
  });
});
