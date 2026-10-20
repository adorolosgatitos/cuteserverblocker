// picks the adapter: real windows netsh on win32, dry-run otherwise
import * as dryrun from './dryrun.js';
import * as win from './win.js';

/**
 * @param {{dryRun?: boolean}} opts
 * @returns {Promise<{
 *   mode: string, isAdmin: boolean,
 *   apply: (t: string, c: string[]) => Promise<void>,
 *   remove: (t: string) => Promise<void>,
 *   elevate?: (o: {port: number|string, script: string}) => Promise<void>,
 * }>}
 */
export async function createFirewall({ dryRun = false } = {}) {
  const useWin = process.platform === 'win32' && !dryRun;
  const impl = useWin ? win : dryrun;
  const admin = useWin ? await win.isAdmin() : true;
  return {
    mode: impl.mode,
    isAdmin: admin,
    apply: impl.apply,
    remove: impl.remove,
    elevate: useWin ? win.elevate : undefined,
  };
}

/** make reality match the desired set of blocked tokens (parallel, all regions) */
export async function syncAll(firewall, regions, cidrsFor, blockedTokens) {
  const want = new Set(blockedTokens);
  const results = await Promise.allSettled(
    regions.map((region) =>
      want.has(region.token)
        ? firewall.apply(region.token, cidrsFor(region))
        : firewall.remove(region.token),
    ),
  );
  const errors = results.flatMap((r, i) =>
    r.status === 'rejected'
      ? [{ token: regions[i].token, message: String(r.reason?.message ?? r.reason) }]
      : [],
  );
  return errors;
}
