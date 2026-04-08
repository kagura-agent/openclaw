import fs from "node:fs";
import path from "node:path";
import { openVerifiedFileSync } from "../../infra/safe-open-sync.js";
import { parseFrontmatter, resolveSkillInvocationPolicy } from "./frontmatter.js";
import { createSyntheticSourceInfo, type Skill } from "./skill-contract.js";

function isPathWithinRoot(rootRealPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootRealPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function readSkillFileSync(params: {
  rootRealPath: string;
  rootDir?: string;
  filePath: string;
  maxBytes?: number;
  allowSymlinks?: boolean;
  /** When allowSymlinks is true, the resolved symlink target must also be inside this directory. */
  allowedSymlinkTarget?: string;
}): string | null {
  const opened = openVerifiedFileSync({
    filePath: params.filePath,
    rejectPathSymlink: !params.allowSymlinks,
    maxBytes: params.maxBytes,
  });
  if (!opened.ok) {
    return null;
  }
  try {
    if (!isPathWithinRoot(params.rootRealPath, opened.path)) {
      // Fallback: accept if the logical (non-resolved) path is inside the logical root
      // AND the resolved path is within the allowed symlink target boundary.
      if (
        !params.allowSymlinks ||
        !params.rootDir ||
        !params.allowedSymlinkTarget ||
        !isPathWithinRoot(path.resolve(params.rootDir), path.resolve(params.filePath)) ||
        !isPathWithinRoot(path.resolve(params.allowedSymlinkTarget), opened.path)
      ) {
        return null;
      }
    }
    return fs.readFileSync(opened.fd, "utf8");
  } finally {
    fs.closeSync(opened.fd);
  }
}

function loadSingleSkillDirectory(params: {
  skillDir: string;
  source: string;
  rootRealPath: string;
  rootDir?: string;
  maxBytes?: number;
  allowSymlinks?: boolean;
  allowedSymlinkTarget?: string;
}): Skill | null {
  const skillFilePath = path.join(params.skillDir, "SKILL.md");
  const raw = readSkillFileSync({
    rootRealPath: params.rootRealPath,
    rootDir: params.rootDir,
    filePath: skillFilePath,
    maxBytes: params.maxBytes,
    allowSymlinks: params.allowSymlinks,
    allowedSymlinkTarget: params.allowedSymlinkTarget,
  });
  if (!raw) {
    return null;
  }

  let frontmatter: Record<string, string>;
  try {
    frontmatter = parseFrontmatter(raw);
  } catch {
    return null;
  }

  const fallbackName = path.basename(params.skillDir).trim();
  const name = frontmatter.name?.trim() || fallbackName;
  const description = frontmatter.description?.trim();
  if (!name || !description) {
    return null;
  }
  const invocation = resolveSkillInvocationPolicy(frontmatter);
  const filePath = path.resolve(skillFilePath);
  const baseDir = path.resolve(params.skillDir);

  return {
    name,
    description,
    filePath,
    baseDir,
    source: params.source,
    sourceInfo: createSyntheticSourceInfo(filePath, {
      source: params.source,
      baseDir,
      scope: "project",
      origin: "top-level",
    }),
    disableModelInvocation: invocation.disableModelInvocation,
  };
}

function listCandidateSkillDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules",
      )
      .map((entry) => path.join(dir, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

export function loadSkillsFromDirSafe(params: {
  dir: string;
  source: string;
  maxBytes?: number;
  allowSymlinks?: boolean;
  allowedSymlinkTarget?: string;
}): {
  skills: Skill[];
} {
  const rootDir = path.resolve(params.dir);
  let rootRealPath: string;
  try {
    rootRealPath = fs.realpathSync(rootDir);
  } catch {
    return { skills: [] };
  }

  const rootSkill = loadSingleSkillDirectory({
    skillDir: rootDir,
    source: params.source,
    rootRealPath,
    rootDir,
    maxBytes: params.maxBytes,
    allowSymlinks: params.allowSymlinks,
    allowedSymlinkTarget: params.allowedSymlinkTarget,
  });
  if (rootSkill) {
    return { skills: [rootSkill] };
  }

  const skills = listCandidateSkillDirs(rootDir)
    .map((skillDir) =>
      loadSingleSkillDirectory({
        skillDir,
        source: params.source,
        rootRealPath,
        rootDir,
        maxBytes: params.maxBytes,
        allowSymlinks: params.allowSymlinks,
        allowedSymlinkTarget: params.allowedSymlinkTarget,
      }),
    )
    .filter((skill): skill is Skill => skill !== null);

  return { skills };
}

export function readSkillFrontmatterSafe(params: {
  rootDir: string;
  filePath: string;
  maxBytes?: number;
}): Record<string, string> | null {
  let rootRealPath: string;
  try {
    rootRealPath = fs.realpathSync(path.resolve(params.rootDir));
  } catch {
    return null;
  }
  const raw = readSkillFileSync({
    rootRealPath,
    filePath: path.resolve(params.filePath),
    maxBytes: params.maxBytes,
  });
  if (!raw) {
    return null;
  }
  try {
    return parseFrontmatter(raw);
  } catch {
    return null;
  }
}
