// windows adapter: one outbound block rule per region, via netsh.
// (dropship uses the wfp api directly; netsh keeps this mini project
// dependency-free and is the same firewall underneath.)
import { execFile } from 'node:child_process';

export const mode = 'windows';

const PREFIX = 'cuteserverblocker';
const nameOf = (token) => `${PREFIX} ${token}`;

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { windowsHide: true, timeout: 20_000 },
      (err, stdout, stderr) => {
        resolve({
          code: err && typeof err.code === 'number' ? err.code : 0,
          out: `${stdout ?? ''}${stderr ?? ''}`.trim(),
        });
      },
    );
  });
}

const looksDenied = (out) =>
  /elevation|access is denied|access denied|denegado/i.test(out);

export async function isAdmin() {
  const { out } = await run('powershell', [
    '-NoProfile',
    '-Command',
    "[bool]([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)",
  ]);
  return out.trim().endsWith('True');
}

/** add (or re-add) the outbound block rule for one region */
export async function apply(token, cidrs) {
  const name = nameOf(token);
  // always delete first so repeats stay idempotent
  await run('netsh', ['advfirewall', 'firewall', 'delete', 'rule', `name=${name}`]);
  const { code, out } = await run('netsh', [
    'advfirewall',
    'firewall',
    'add',
    'rule',
    `name=${name}`,
    'dir=out',
    'action=block',
    `remoteip=${cidrs.join(',')}`,
    'profile=any',
    'enabled=yes',
    `description=blocked by ${PREFIX} <3`,
  ]);
  if (code !== 0 || looksDenied(out)) {
    throw new Error(
      looksDenied(out)
        ? 'windows says: the requested operation requires elevation (run as administrator)'
        : `netsh failed: ${out.split('\n').pop() ?? 'unknown error'}`,
    );
  }
}

/** remove the rule if it exists; missing rules are not an error */
export async function remove(token) {
  const { code, out } = await run('netsh', [
    'advfirewall',
    'firewall',
    'delete',
    'rule',
    `name=${nameOf(token)}`,
  ]);
  if (code !== 0 && looksDenied(out)) {
    throw new Error('windows says: run as administrator to change the firewall');
  }
}

/** relaunch this app elevated (uac prompt); the caller exits afterwards */
export async function elevate({ port, script }) {
  const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
  const scriptArg = `"${script}" --port ${Number(port)}`;
  await run('powershell', [
    '-NoProfile',
    '-Command',
    `Start-Process -FilePath ${q(process.execPath)} -ArgumentList ${q(
      scriptArg,
    )} -Verb RunAs`,
  ]);
}
