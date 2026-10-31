export type Severity = "error" | "warning" | "info";

export interface SourceLocation {
  file: string;
  /** 1-based */
  line?: number;
  /** 1-based */
  column?: number;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  /** Path inside the file, e.g. ["resources", "pets", "methods", "list"]. */
  path?: (string | number)[];
  location?: SourceLocation;
}

export interface DiagnosticRule {
  severity: Severity;
  title: string;
}

/**
 * K00xx: input files (syntax, schema). K01xx: config semantics. K02xx: config vs spec.
 * Codes are stable: never reuse a retired code.
 */
export const DIAGNOSTIC_RULES = {
  K0001: { severity: "error", title: "YAML syntax error" },
  K0002: { severity: "error", title: "Config does not match the kilngen.yml schema" },
  K0003: { severity: "error", title: "Unknown key" },
  K0004: { severity: "error", title: "Invalid JSON" },
  K0005: { severity: "error", title: "Workspace file does not match the workspace schema" },
  K0100: { severity: "error", title: "No workspace found" },
  K0101: { severity: "error", title: "File not found" },
  K0102: { severity: "error", title: "Not an OpenAPI 3.0/3.1 document" },
  K0103: { severity: "error", title: "Unknown pagination scheme" },
  K0104: { severity: "error", title: "Duplicate pagination scheme name" },
  K0105: { severity: "error", title: "Target requires another target" },
  K0106: { severity: "error", title: "Unknown auth scheme" },
  K0107: { severity: "warning", title: "Endpoint mapped more than once" },
  K0201: { severity: "error", title: "Endpoint not found in spec" },
  K0202: { severity: "error", title: "Schema not found in spec" },
  K0203: { severity: "warning", title: "Spec operation not mapped to any resource" },
} as const satisfies Record<string, DiagnosticRule>;

export type DiagnosticCode = keyof typeof DIAGNOSTIC_RULES;

export function diagnostic(
  code: DiagnosticCode,
  message: string,
  extra: Pick<Diagnostic, "path" | "location"> = {},
): Diagnostic {
  return { code, severity: DIAGNOSTIC_RULES[code].severity, message, ...extra };
}

export interface SeverityOverrides {
  ignore?: string[];
  error?: string[];
  warn?: string[];
}

export function applySeverityOverrides(
  diagnostics: Diagnostic[],
  overrides: SeverityOverrides = {},
): Diagnostic[] {
  const ignore = new Set(overrides.ignore);
  const error = new Set(overrides.error);
  const warn = new Set(overrides.warn);
  return diagnostics
    .filter((d) => !ignore.has(d.code))
    .map((d) => {
      if (error.has(d.code)) return { ...d, severity: "error" };
      if (warn.has(d.code)) return { ...d, severity: "warning" };
      return d;
    });
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

export function formatLocation(
  location: SourceLocation | undefined,
  relativeTo?: (file: string) => string,
): string {
  if (!location) return "";
  const file = relativeTo ? relativeTo(location.file) : location.file;
  if (location.line === undefined) return file;
  return `${file}:${location.line}:${location.column ?? 1}`;
}

export function formatDiagnostic(d: Diagnostic, relativeTo?: (file: string) => string): string {
  const where = formatLocation(d.location, relativeTo);
  return `${where ? `${where} ` : ""}${d.severity} ${d.code} ${d.message}`;
}
