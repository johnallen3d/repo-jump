// Registers the `gh` native-messaging host for a browser profile.
//   node scripts/install-host.js                -> real Google Chrome (~/Library/Application Support/Google/Chrome)
//   node scripts/install-host.js --dir DIR      -> a specific user-data dir (dev/test Chromium)
//   [--gh PATH]                                 -> gh binary to use (default: the one on PATH)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HOST_NAME = 'com.repojump.gh';
export const EXTENSION_ID = 'mginlchbajjkclmddldllddifhidgiba';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function installHost({ dir, gh }) {
  const hostsDir = path.join(dir, 'NativeMessagingHosts');
  fs.mkdirSync(hostsDir, { recursive: true });
  const launcher = path.join(hostsDir, `${HOST_NAME}.sh`);
  // Copy the host so it keeps working if this checkout (e.g. a worktree) goes
  // away. Chrome starts hosts with a minimal environment, so bake in absolute paths.
  const host = path.join(hostsDir, `${HOST_NAME}.mjs`);
  fs.copyFileSync(path.join(root, 'native-host/host.js'), host);
  fs.writeFileSync(launcher, `#!/bin/sh\nexec "${process.execPath}" "${host}" "${gh}"\n`, { mode: 0o755 });
  fs.writeFileSync(
    path.join(hostsDir, `${HOST_NAME}.json`),
    JSON.stringify(
      {
        name: HOST_NAME,
        description: 'Repo Jump: GitHub tokens from the gh CLI',
        path: launcher,
        type: 'stdio',
        allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
      },
      null,
      2,
    ),
  );
  return hostsDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i === -1 ? null : process.argv[i + 1];
  };
  const dir = arg('--dir') ?? path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
  const gh = arg('--gh') ?? execFileSync('/bin/sh', ['-c', 'command -v gh']).toString().trim();
  console.log(`Installed ${HOST_NAME} -> ${installHost({ dir, gh })} (gh: ${gh})`);
}
