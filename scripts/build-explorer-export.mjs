import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (status) throw new Error("Refusing explorer export from a dirty source tree");

const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error("Unable to resolve the immutable source commit");
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "xds-emission-export-"));
const cleanRoot = path.join(temporaryRoot, "source");
let worktreeAdded = false;

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  return result.status === 0;
};

try {
  execFileSync("git", [
    "-c",
    "core.autocrlf=false",
    "worktree",
    "add",
    "--detach",
    cleanRoot,
    sourceCommit,
  ], {
    cwd: root,
    stdio: "inherit",
  });
  worktreeAdded = true;

  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run the explorer export through npm");
  if (!run(process.execPath, [npmCli, "ci"], { cwd: cleanRoot, env: process.env })) {
    throw new Error("Clean npm install failed");
  }

  const nextBin = path.join(cleanRoot, "node_modules", "next", "dist", "bin", "next");
  if (
    !run(process.execPath, [nextBin, "build"], {
      cwd: cleanRoot,
      env: { ...process.env, XDS_SOURCE_COMMIT: sourceCommit },
    })
  ) {
    throw new Error("Explorer build failed");
  }

  const emissionData = JSON.parse(
    await readFile(path.join(cleanRoot, "data", "emission-decade.json"), "utf8"),
  );
  const cleanOutputRoot = path.join(cleanRoot, "out");
  const sourceDocument = `# XDS emission explorer source

This static export was built in a detached checkout of the immutable source commit:

https://github.com/MatthewFreeman/discrete-explorer/tree/${sourceCommit}

Rebuild from that clean checkout with:

\`\`\`text
npm ci
npm run explorer:build
\`\`\`

The build uses the committed npm lockfile, and the deterministic Next build ID is
the full source commit. The export manifest lists every generated file other than
the manifest itself with its SHA-256.

The emission model is pinned to Discrete consensus commit
\`${emissionData.meta.sourceCommit}\`. Exact block ranges are authoritative;
projected dates assume the ${emissionData.meta.blockTargetSeconds}-second target cadence.

The \`Today\` position is shown only when both fixed public Explorer RPC nodes
agree on the exact tip hash, height, timestamp, generated supply, and next
reward. On disagreement or single-node availability, the page fails closed to
the code-derived static model.
`;
  await writeFile(path.join(cleanOutputRoot, "SOURCE.md"), sourceDocument, "utf8");

  async function listFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...(await listFiles(absolute)));
      else if (entry.isFile()) files.push(absolute);
    }
    return files;
  }

  const manifestPath = path.join(cleanOutputRoot, "EXPORT-MANIFEST.sha256");
  const files = (await listFiles(cleanOutputRoot))
    .filter((file) => file !== manifestPath)
    .map((file) => ({
      absolute: file,
      relative: path.relative(cleanOutputRoot, file).split(path.sep).join("/"),
    }))
    .sort((left, right) =>
      left.relative < right.relative ? -1 : left.relative > right.relative ? 1 : 0,
    );
  const manifest = [];
  for (const file of files) {
    const digest = createHash("sha256")
      .update(await readFile(file.absolute))
      .digest("hex");
    manifest.push(`${digest}  ${file.relative}`);
  }
  await writeFile(manifestPath, `${manifest.join("\n")}\n`, "utf8");

  const outputRoot = path.join(root, "out");
  await rm(outputRoot, { recursive: true, force: true });
  await cp(cleanOutputRoot, outputRoot, { recursive: true });
} finally {
  if (worktreeAdded) {
    spawnSync("git", ["worktree", "remove", "--force", cleanRoot], {
      cwd: root,
      stdio: "inherit",
    });
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}

if (process.exitCode) process.exit(process.exitCode);
