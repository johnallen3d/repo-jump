// Installs (or refreshes) Repo Jump in the Cra browser, repeatably:
//  - links Cra/Extensions/<id> to this checkout's extension/ folder, so edits
//    here are what Cra loads
//  - enables it in every Cra profile (extension-profiles.json) and pins it
//  - registers the gh native-messaging host in Cra's Chromium user-data dir
//  - restarts Cra (it loads extensions at startup; windows are restored)
// Usage: node scripts/install-cra.js [--no-restart] [--uninstall]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installHost, EXTENSION_ID, HOST_NAME } from './install-host.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CRA = path.join(os.homedir(), 'Library/Application Support/Cra');
const CHROMIUM = path.join(CRA, 'Chromium');
const args = new Set(process.argv.slice(2));
const sh = (cmd) => execFileSync('/bin/sh', ['-c', cmd]).toString().trim();
const running = () => {
  try {
    sh('pgrep -x Cra');
    return true;
  } catch {
    return false;
  }
};

if (!fs.existsSync(CHROMIUM)) throw new Error(`Cra's Chromium data not found at ${CHROMIUM} — is the Chrome engine on?`);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(file, value) {
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value));
  fs.renameSync(`${file}.tmp`, file);
}

const restart = !args.has('--no-restart');
const wasRunning = running();
if (wasRunning && restart) {
  console.log('Quitting Cra…');
  sh(`osascript -e 'tell application "Cra" to quit'`);
  for (let i = 0; i < 60 && running(); i++) sh('sleep 0.5');
  if (running()) throw new Error('Cra did not quit; quit it and rerun');
} else if (wasRunning) {
  console.log('Cra is running; changes apply on its next start (Cra may also rewrite its JSON on quit).');
}

const link = path.join(CRA, 'Extensions', EXTENSION_ID);
const profilesFile = path.join(CRA, 'extension-profiles.json');
const pinnedFile = path.join(CRA, 'pinned-extensions.json');
const profilesMap = readJson(profilesFile, {});
const pinned = readJson(pinnedFile, []);

const st = fs.lstatSync(link, { throwIfNoEntry: false });
if (st && !st.isSymbolicLink()) throw new Error(`${link} exists and is not a symlink; refusing to replace it`);
if (st) fs.unlinkSync(link);

if (args.has('--uninstall')) {
  delete profilesMap[EXTENSION_ID];
  writeJson(profilesFile, profilesMap);
  writeJson(pinnedFile, pinned.filter((id) => id !== EXTENSION_ID));
  for (const f of ['json', 'sh', 'mjs']) fs.rmSync(path.join(CHROMIUM, 'NativeMessagingHosts', `${HOST_NAME}.${f}`), { force: true });
  console.log('Removed Repo Jump from Cra.');
} else {
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(path.join(root, 'extension'), link);
  const profiles = fs
    .readdirSync(CHROMIUM)
    .filter((d) => (d === 'Default' || d.startsWith('Profile ')) && fs.existsSync(path.join(CHROMIUM, d, 'Preferences')))
    .sort();
  profilesMap[EXTENSION_ID] = profiles;
  writeJson(profilesFile, profilesMap);
  if (!pinned.includes(EXTENSION_ID)) writeJson(pinnedFile, [...pinned, EXTENSION_ID]);
  installHost({ dir: CHROMIUM, gh: sh('command -v gh') });
  console.log(`Linked ${link} -> ${path.join(root, 'extension')}`);
  console.log(`Enabled in ${profiles.length} Cra profile(s); gh helper registered.`);
}

if (wasRunning && restart) {
  sh('open -a Cra');
  console.log('Cra relaunched.');
}
