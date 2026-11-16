// Chrome native-messaging host: answers any request with the github.com
// accounts the `gh` CLI is signed into and a token for each. Tokens go
// straight back to the extension over stdio; nothing is written anywhere.
// Usage (from the generated launcher): node host.js /path/to/gh
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const GH = process.argv[2] || 'gh';

function send(msg) {
  const body = Buffer.from(JSON.stringify(msg));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([len, body]));
}

async function accounts() {
  // `gh auth status` exits non-zero if any account has a problem, but still
  // prints JSON for the rest.
  const { stdout } = await run(GH, ['auth', 'status', '--json', 'hosts']).catch((e) => e);
  let hosts;
  try {
    hosts = JSON.parse(stdout).hosts?.['github.com'] ?? [];
  } catch {
    throw new Error('gh is not signed in to github.com — run `gh auth login`');
  }
  const ok = hosts.filter((h) => h.state === 'success');
  if (!ok.length) throw new Error('gh is not signed in to github.com — run `gh auth login`');
  return Promise.all(
    ok.map(async (h) => {
      const { stdout: token } = await run(GH, ['auth', 'token', '--hostname', 'github.com', '--user', h.login]);
      return { login: h.login, active: !!h.active, token: token.trim() };
    }),
  );
}

// Read (and ignore) one framed request, reply once, exit.
process.stdin.once('readable', async () => {
  try {
    send({ ok: true, accounts: await accounts() });
  } catch (err) {
    send({ ok: false, error: String(err.message ?? err) });
  }
  process.exit(0);
});
