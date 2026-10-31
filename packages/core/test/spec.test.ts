import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkConfigAgainstSpecs, loadSpec, parseConfig } from "../src/index.js";

const petstore = fileURLToPath(new URL("../../../examples/petstore/openapi.yaml", import.meta.url));

function tmpFile(name: string, text: string): string {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "kilngen-spec-")), name);
  writeFileSync(file, text);
  return file;
}

describe("loadSpec", () => {
  it("indexes operations and schemas", async () => {
    const { spec, diagnostics } = await loadSpec(petstore);
    expect(diagnostics).toEqual([]);
    expect([...spec!.operations].sort()).toEqual([
      "delete /pets/{pet_id}",
      "get /pets",
      "get /pets/{pet_id}",
      "post /pets",
    ]);
    expect(spec!.schemas).toEqual(new Set(["Pet", "PetCreate", "Error"]));
  });

  it("rejects Swagger 2.0 and non-OpenAPI files", async () => {
    const { diagnostics } = await loadSpec(tmpFile("swagger.yaml", "swagger: '2.0'\npaths: {}\n"));
    expect(diagnostics.map((d) => d.code)).toEqual(["K0102"]);
  });

  it("reports missing files", async () => {
    const { diagnostics } = await loadSpec("/nonexistent/openapi.yaml");
    expect(diagnostics.map((d) => d.code)).toEqual(["K0101"]);
  });

  it("accepts JSON specs", async () => {
    const { spec } = await loadSpec(
      tmpFile("openapi.json", JSON.stringify({ openapi: "3.0.3", paths: { "/a": { get: {} } } })),
    );
    expect(spec?.operations).toEqual(new Set(["get /a"]));
  });
});

describe("checkConfigAgainstSpecs", () => {
  it("reports unknown endpoints and models, and warns about unmapped operations", async () => {
    const { spec } = await loadSpec(petstore);
    const text = `version: 1
edition: 2026-11
project:
  name: petstore
resources:
  pets:
    models:
      pet: "#/components/schemas/Pett"
    methods:
      list: get /pets
      update: patch /pets/{pet_id}
`;
    const { config, source } = parseConfig(text, "kilngen.yml");
    const diagnostics = checkConfigAgainstSpecs(config!, [spec!], source);
    expect(diagnostics.map((d) => [d.code, d.location?.line])).toEqual([
      ["K0201", 11],
      ["K0202", 8],
      ["K0203", 5],
      ["K0203", 5],
      ["K0203", 5],
    ]);
  });
});
