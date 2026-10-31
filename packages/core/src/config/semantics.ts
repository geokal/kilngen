import { diagnostic, type Diagnostic } from "../diagnostics.js";
import type { SourceFile, DocPath } from "../source.js";
import { TARGET_PREREQUISITES, type TargetId } from "../targets.js";
import type { KilngenConfig, ResourceConfig } from "./schema.js";

export interface MethodRef {
  /** e.g. ["resources", "pets", "methods", "list"] */
  path: DocPath;
  /** Dotted name, e.g. "pets.list" or "projects.members.add" */
  name: string;
  verb: string;
  route: string;
  pagination?: string;
}

/** Every method in `resources`, depth first, with its location in the config. */
export function collectMethods(config: KilngenConfig): MethodRef[] {
  const out: MethodRef[] = [];
  const visit = (resources: Record<string, ResourceConfig>, basePath: DocPath, baseName: string[]) => {
    for (const [resourceName, resource] of Object.entries(resources)) {
      const resourcePath = [...basePath, resourceName];
      const names = resourceName === "$client" ? baseName : [...baseName, resourceName];
      for (const [methodName, method] of Object.entries(resource.methods ?? {})) {
        const endpoint = typeof method === "string" ? method : method.endpoint;
        const [verb = "", route = ""] = endpoint.trim().split(/\s+/, 2);
        const pagination = typeof method === "string" ? undefined : method.pagination;
        out.push({
          path: [...resourcePath, "methods", methodName],
          name: [...names, methodName].join("."),
          verb,
          route,
          ...(pagination !== undefined && { pagination }),
        });
      }
      if (resource.subresources) visit(resource.subresources, [...resourcePath, "subresources"], names);
    }
  };
  visit(config.resources ?? {}, ["resources"], []);
  return out;
}

/** Cross-field checks that the schema alone cannot express. */
export function checkConfigSemantics(config: KilngenConfig, source: SourceFile): Diagnostic[] {
  const out: Diagnostic[] = [];
  const at = (path: DocPath) => ({ path, location: source.locate(path) });

  const schemes = new Map<string, number>();
  (config.pagination ?? []).forEach((scheme, i) => {
    if (schemes.has(scheme.name)) {
      out.push(
        diagnostic(
          "K0104",
          `pagination scheme "${scheme.name}" is defined more than once`,
          at(["pagination", i, "name"]),
        ),
      );
    }
    schemes.set(scheme.name, i);
  });

  const seenEndpoints = new Map<string, string>();
  for (const method of collectMethods(config)) {
    if (method.pagination !== undefined && !schemes.has(method.pagination)) {
      const known = [...schemes.keys()];
      out.push(
        diagnostic(
          "K0103",
          `${method.name} uses pagination "${method.pagination}", which is not defined in \`pagination\`` +
            (known.length ? ` (known: ${known.join(", ")})` : ""),
          at([...method.path, "pagination"]),
        ),
      );
    }
    const key = `${method.verb} ${method.route}`;
    const previous = seenEndpoints.get(key);
    if (previous) {
      out.push(
        diagnostic("K0107", `${method.name} maps "${key}", which ${previous} already maps`, at(method.path)),
      );
    } else {
      seenEndpoints.set(key, method.name);
    }
  }

  const targets = config.targets ?? {};
  for (const [target, required] of Object.entries(TARGET_PREREQUISITES) as [TargetId, TargetId][]) {
    if (targets[target] && !targets[required]) {
      out.push(
        diagnostic(
          "K0105",
          `target "${target}" is built on the ${required} target; add targets.${required}`,
          at(["targets", target]),
        ),
      );
    }
  }

  const authSchemes = new Set(Object.keys(config.auth?.schemes ?? {}));
  if (authSchemes.size > 0) {
    (config.auth?.default ?? []).forEach((name, i) => {
      if (!authSchemes.has(name)) {
        out.push(
          diagnostic("K0106", `auth.default references unknown scheme "${name}"`, at(["auth", "default", i])),
        );
      }
    });
    for (const [optionName, option] of Object.entries(config.client?.options ?? {})) {
      if (option.auth && !authSchemes.has(option.auth.scheme)) {
        out.push(
          diagnostic(
            "K0106",
            `client option "${optionName}" references unknown auth scheme "${option.auth.scheme}"`,
            at(["client", "options", optionName, "auth", "scheme"]),
          ),
        );
      }
    }
  }

  return out;
}
