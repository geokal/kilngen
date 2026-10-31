import { readFile } from "node:fs/promises";
import { diagnostic, type Diagnostic } from "./diagnostics.js";
import { collectMethods } from "./config/semantics.js";
import { HTTP_METHODS, type KilngenConfig, type ResourceConfig } from "./config/schema.js";
import { SourceFile, type DocPath } from "./source.js";

export interface LoadedSpec {
  file: string;
  openapi: string;
  /** "get /pets/{pet_id}" */
  operations: Set<string>;
  schemas: Set<string>;
}

/** Minimal OpenAPI loading for lint: validates the version and indexes operations and schemas. */
export async function loadSpec(file: string): Promise<{ spec?: LoadedSpec; diagnostics: Diagnostic[] }> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return { diagnostics: [diagnostic("K0101", `OpenAPI spec not found: ${file}`, { location: { file } })] };
  }
  const { source, diagnostics } = SourceFile.parse(file, text);
  if (diagnostics.length > 0) return { diagnostics };

  const doc = source.toJS() as Record<string, unknown> | null;
  const version = doc && typeof doc === "object" ? doc.openapi : undefined;
  if (typeof version !== "string" || !/^3\.[01]\.\d+$/.test(version)) {
    return {
      diagnostics: [
        diagnostic(
          "K0102",
          `expected \`openapi: 3.0.x\` or \`3.1.x\`, found ${JSON.stringify(version ?? null)}`,
          {
            location: source.locate(["openapi"]),
          },
        ),
      ],
    };
  }

  const operations = new Set<string>();
  const paths = (doc!.paths ?? {}) as Record<string, Record<string, unknown> | null>;
  for (const [route, item] of Object.entries(paths)) {
    for (const verb of HTTP_METHODS) {
      if (item && typeof item === "object" && verb in item) operations.add(`${verb} ${route}`);
    }
  }
  const components = (doc!.components ?? {}) as { schemas?: Record<string, unknown> };
  const schemas = new Set(Object.keys(components.schemas ?? {}));
  return { spec: { file, openapi: version, operations, schemas }, diagnostics: [] };
}

/** Checks that every endpoint and model the config references exists in the specs. */
export function checkConfigAgainstSpecs(
  config: KilngenConfig,
  specs: LoadedSpec[],
  source: SourceFile,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const operations = new Set(specs.flatMap((s) => [...s.operations]));
  const schemas = new Set(specs.flatMap((s) => [...s.schemas]));
  const mapped = new Set<string>();

  for (const method of collectMethods(config)) {
    const key = `${method.verb} ${method.route}`;
    mapped.add(key);
    if (!operations.has(key)) {
      out.push(
        diagnostic("K0201", `${method.name}: endpoint "${key}" is not in the OpenAPI spec`, {
          path: method.path,
          location: source.locate(method.path),
        }),
      );
    }
  }

  const visitModels = (resources: Record<string, ResourceConfig>, basePath: DocPath) => {
    for (const [name, resource] of Object.entries(resources)) {
      for (const [model, ref] of Object.entries(resource.models ?? {})) {
        const schemaName = ref.slice("#/components/schemas/".length);
        if (!schemas.has(schemaName)) {
          const path = [...basePath, name, "models", model];
          out.push(
            diagnostic("K0202", `model "${model}" references "${ref}", which is not in the OpenAPI spec`, {
              path,
              location: source.locate(path),
            }),
          );
        }
      }
      if (resource.subresources) visitModels(resource.subresources, [...basePath, name, "subresources"]);
    }
  };
  visitModels(config.resources ?? {}, ["resources"]);

  if (config.resources) {
    for (const op of [...operations].sort()) {
      if (!mapped.has(op)) {
        out.push(
          diagnostic("K0203", `"${op}" is in the spec but not mapped to any resource method`, {
            location: source.locateKey([], "resources"),
          }),
        );
      }
    }
  }
  return out;
}
