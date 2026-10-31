import path from "node:path";
import { formatDiagnostic, type Diagnostic } from "@kilngen/core";
import type { Io } from "../io.js";

export function relativeTo(cwd: string) {
  return (file: string) => {
    const rel = path.relative(cwd, file);
    return rel && !rel.startsWith("..") ? rel : file;
  };
}

export function printDiagnostics(io: Io, diagnostics: Diagnostic[]): void {
  const rel = relativeTo(io.cwd);
  for (const d of diagnostics) {
    const line = `${formatDiagnostic(d, rel)}\n`;
    if (d.severity === "error") io.err(line);
    else io.out(line);
  }
}

export function summarize(diagnostics: Diagnostic[]): string {
  const count = (s: Diagnostic["severity"]) => diagnostics.filter((d) => d.severity === s).length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${plural(count("error"), "error")}, ${plural(count("warning"), "warning")}`;
}
