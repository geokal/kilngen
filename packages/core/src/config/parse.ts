import type { z } from "zod";
import { diagnostic, type Diagnostic } from "../diagnostics.js";
import { SourceFile, type DocPath } from "../source.js";
import { KilngenConfigSchema, type KilngenConfig } from "./schema.js";
import { checkConfigSemantics } from "./semantics.js";

export interface ParseConfigResult {
  config?: KilngenConfig;
  source: SourceFile;
  diagnostics: Diagnostic[];
}

/** Parse and validate a kilngen.yml file. Does not read the OpenAPI spec. */
export function parseConfig(text: string, file: string): ParseConfigResult {
  const { source, diagnostics } = SourceFile.parse(file, text);
  if (diagnostics.length > 0) return { source, diagnostics };

  const result = KilngenConfigSchema.safeParse(source.toJS() ?? {});
  if (!result.success) {
    return { source, diagnostics: zodIssuesToDiagnostics(result.error.issues, source) };
  }
  return { config: result.data, source, diagnostics: checkConfigSemantics(result.data, source) };
}

export function zodIssuesToDiagnostics(
  issues: z.core.$ZodIssue[],
  source: SourceFile,
  schemaCode: "K0002" | "K0005" = "K0002",
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const issue of issues) {
    const path = issue.path.filter((p): p is string | number => typeof p !== "symbol");
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        out.push(
          diagnostic("K0003", `unknown key "${key}"${where(path)}`, {
            path: [...path, key],
            location: source.locateKey(path, key),
          }),
        );
      }
      continue;
    }
    out.push(
      diagnostic(schemaCode, `${where(path, "at ")}${describeIssue(issue)}`, {
        path,
        location: source.locate(path),
      }),
    );
  }
  return out;
}

function where(path: DocPath, prefix = " in "): string {
  return path.length === 0 ? "" : `${prefix}${path.join(".")}${prefix === "at " ? ": " : ""}`;
}

function describeIssue(issue: z.core.$ZodIssue): string {
  if (issue.code === "invalid_type" && issue.input === undefined) return "required";
  if (issue.code === "invalid_union") {
    const messages = new Set(issue.errors.flat().map((e) => e.message));
    return messages.size === 1 ? [...messages][0]! : issue.message;
  }
  return issue.message;
}
