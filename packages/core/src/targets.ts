export const TARGET_IDS = ["typescript", "go", "python", "mcp", "cli", "terraform", "docs"] as const;

export type TargetId = (typeof TARGET_IDS)[number];

/** Targets that are emitted on top of another target's output. */
export const TARGET_PREREQUISITES: Partial<Record<TargetId, TargetId>> = {
  mcp: "typescript",
  cli: "go",
  terraform: "go",
};
