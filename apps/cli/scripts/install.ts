#!/usr/bin/env bun
/**
 * Compile `invoicey` and put it on PATH the same way Bun does:
 * `~/.invoicey/bin/invoicey` plus a PATH line in the shell rc.
 */
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const compiled = join(cliRoot, "dist", "invoicey");
const binDir = join(homedir(), ".invoicey", "bin");
const dest = join(binDir, "invoicey");
const PATH_EXPORT = 'export PATH="$HOME/.invoicey/bin:$PATH"';
const PATH_MARK = "# invoicey";

function say(line: string) {
  process.stdout.write(`${line}\n`);
}

async function compile() {
  const proc = Bun.spawn(
    [
      "bun",
      "build",
      "--compile",
      "--outfile",
      compiled,
      join(cliRoot, "src", "bin.ts"),
    ],
    { cwd: cliRoot, stdout: "inherit", stderr: "inherit" },
  );
  const code = await proc.exited;
  if (code !== 0) process.exit(code);
}

function rcPath(shell: string): string {
  if (shell.endsWith("/bash")) return join(homedir(), ".bashrc");
  if (shell.endsWith("/fish"))
    return join(homedir(), ".config/fish/config.fish");
  return join(homedir(), ".zshrc");
}

function pathBlock(shell: string): string {
  if (shell.endsWith("/fish")) {
    return `\n${PATH_MARK}\nfish_add_path $HOME/.invoicey/bin\n`;
  }
  return `\n${PATH_MARK}\n${PATH_EXPORT}\n`;
}

async function ensurePath(shell: string): Promise<string | null> {
  const file = rcPath(shell);
  let existing = "";
  try {
    existing = await readFile(file, "utf8");
  } catch {
    existing = "";
  }
  if (existing.includes(".invoicey/bin")) return null;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${existing}${pathBlock(shell)}`, "utf8");
  return file;
}

async function main() {
  await compile();
  await mkdir(binDir, { recursive: true });
  await copyFile(compiled, dest);
  await chmod(dest, 0o755);

  const shell = process.env.SHELL ?? "/bin/zsh";
  const patched = await ensurePath(shell);

  say(`Installed ${dest}`);
  say("Reload PATH for this terminal:");
  say(`  export PATH="$HOME/.invoicey/bin:$PATH"`);
  if (patched) {
    say(`Added PATH to ${patched} for new terminals.`);
  }
  say("Then: invoicey login");
}

await main();
