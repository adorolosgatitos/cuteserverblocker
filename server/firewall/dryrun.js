// dry-run adapter: remembers rules in memory so the app can be
// developed and demoed on machines where we don't touch the real firewall.

const rules = new Map(); // token -> cidrs[]

export const mode = 'dry-run';
export const isAdmin = true;

export function apply(token, cidrs) {
  rules.set(token, cidrs);
  console.log(`  ~ dry-run: would block ${token} (${cidrs.length} ranges)`);
}

export function remove(token) {
  if (!rules.delete(token)) return; // nothing was there, stay quiet
  console.log(`  ~ dry-run: would unblock ${token}`);
}

export function current() {
  return new Map(rules);
}
