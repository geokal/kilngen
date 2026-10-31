/**
 * Writes JSON Schemas for kilngen.yml and .kilngen/workspace.json from the zod schemas.
 * `--check` fails instead of writing when the committed files are stale.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { KilngenConfigSchema } from "@kilngen/core";
import { WorkspaceSchema } from "@kilngen/workspace";

const outputs: { file: string; id: string; title: string; schema: z.ZodType }[] = [
  {
    file: "kilngen.schema.json",
    id: "https://kilngen.dev/schema/v1/kilngen.schema.json",
    title: "kilngen.yml",
    schema: KilngenConfigSchema,
  },
  {
    file: "workspace.schema.json",
    id: "https://kilngen.dev/schema/v1/workspace.schema.json",
    title: ".kilngen/workspace.json",
    schema: WorkspaceSchema,
  },
];

const check = process.argv.includes("--check");
let stale = 0;
for (const { file, id, title, schema } of outputs) {
  const json = { $id: id, title, ...z.toJSONSchema(schema, { io: "input" }) };
  const text = `${JSON.stringify(json, null, 2)}\n`;
  const target = fileURLToPath(new URL(`../schemas/${file}`, import.meta.url));
  if (check) {
    const current = await readFile(target, "utf8").catch(() => "");
    if (current !== text) {
      console.error(`schemas/${file} is out of date; run \`pnpm schemas\``);
      stale++;
    }
  } else {
    await writeFile(target, text);
    console.log(`wrote schemas/${file}`);
  }
}
process.exitCode = stale ? 1 : 0;
