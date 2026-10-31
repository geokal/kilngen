import { TARGET_IDS } from "@kilngen/core";
import { z } from "zod";

export const WORKSPACE_DIR = ".kilngen";
export const WORKSPACE_FILE = "workspace.json";
export const LOCAL_OVERRIDES_FILE = "local.json";
export const CONFIG_FILE = "kilngen.yml";
export const IMPLICIT_SPEC_FILES = ["openapi.yaml", "openapi.yml", "openapi.json"] as const;

export const WorkspaceTargetSchema = z.strictObject({
  output_path: z.string().min(1),
  integration_branch: z.string().min(1).optional(),
});

const workspaceFields = {
  $schema: z.string().optional(),
  version: z.literal(1),
  name: z.string().min(1),
  openapi_specs: z.array(z.string().min(1)).min(1),
  config: z.string().min(1),
  targets: z.partialRecord(z.enum(TARGET_IDS), WorkspaceTargetSchema).optional(),
  toolchain: z.enum(["host", "docker"]).optional(),
  release: z.strictObject({ profile: z.string().min(1) }).optional(),
};

/** `.kilngen/workspace.json`: where the inputs and output repos live. Paths are relative to this file. */
export const WorkspaceSchema = z.strictObject(workspaceFields);

/** `.kilngen/local.json`: per-developer overrides, merged over the workspace file. Not committed. */
export const LocalOverridesSchema = z.strictObject({
  ...workspaceFields,
  version: workspaceFields.version.optional(),
  name: workspaceFields.name.optional(),
  openapi_specs: workspaceFields.openapi_specs.optional(),
  config: workspaceFields.config.optional(),
  targets: z.partialRecord(z.enum(TARGET_IDS), WorkspaceTargetSchema.partial()).optional(),
});

export type WorkspaceFile = z.infer<typeof WorkspaceSchema>;
export type LocalOverrides = z.infer<typeof LocalOverridesSchema>;
