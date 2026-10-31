import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface TargetRepoStatus {
  exists: boolean;
  isGitRepo: boolean;
  branch?: string;
  clean?: boolean;
}

/** Reports whether a target output directory exists and, if it is a git repo, its branch and cleanliness. */
export async function inspectOutputPath(outputPath: string): Promise<TargetRepoStatus> {
  if (!existsSync(outputPath)) return { exists: false, isGitRepo: false };
  try {
    const { stdout: top } = await exec("git", ["-C", outputPath, "rev-parse", "--show-toplevel"]);
    if (!top.trim()) return { exists: true, isGitRepo: false };
    const { stdout: branch } = await exec("git", ["-C", outputPath, "branch", "--show-current"]);
    const { stdout: status } = await exec("git", ["-C", outputPath, "status", "--porcelain"]);
    return {
      exists: true,
      isGitRepo: true,
      branch: branch.trim() || "(detached)",
      clean: status.trim() === "",
    };
  } catch {
    return { exists: true, isGitRepo: false };
  }
}
