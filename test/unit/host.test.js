import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Drives native-host/host.js over the Chrome stdio framing with a fake gh.
function ask(gh) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['native-host/host.js', gh]);
    const chunks = [];
    p.stdout.on('data', (c) => chunks.push(c));
    p.on('error', reject);
    p.on('close', () => {
      const buf = Buffer.concat(chunks);
      resolve(JSON.parse(buf.subarray(4, 4 + buf.readUInt32LE(0)).toString()));
    });
    const body = Buffer.from('{"type":"accounts"}');
    const len = Buffer.alloc(4);
    len.writeUInt32LE(body.length);
    p.stdin.write(Buffer.concat([len, body]));
  });
}

function fakeGh(script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rj-gh-'));
  const f = path.join(dir, 'gh');
  fs.writeFileSync(f, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  return f;
}

test('returns a token for each signed-in account', async () => {
  const gh = fakeGh(`case "$*" in
  "auth status --json hosts") echo '{"hosts":{"github.com":[{"state":"success","active":true,"login":"a"},{"state":"error","login":"b"},{"state":"success","login":"c"}]}}'; exit 1 ;;
  *"--user a") echo tok-a ;;
  *"--user c") echo tok-c ;;
esac`);
  const res = await ask(gh);
  assert.deepEqual(res, { ok: true, accounts: [{ login: 'a', active: true, token: 'tok-a' }, { login: 'c', active: false, token: 'tok-c' }] });
});

test('reports when gh is not signed in', async () => {
  const res = await ask(fakeGh('exit 1'));
  assert.equal(res.ok, false);
  assert.match(res.error, /gh auth login/);
});
