/** "in 3d 4h", "2h ago" — enough precision for a voting deadline. */
export function relative(iso: string, now = Date.now()): string {
	const diff = new Date(iso).getTime() - now;
	const abs = Math.abs(diff);
	const d = Math.floor(abs / 86_400_000);
	const h = Math.floor((abs % 86_400_000) / 3_600_000);
	const m = Math.floor((abs % 3_600_000) / 60_000);
	const span = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(m, 1)}m`;
	return diff > 0 ? `in ${span}` : `${span} ago`;
}

export const shortParty = (party: string) =>
	`${party.split('::')[0]}::${party.split('::')[1]?.slice(0, 8)}…`;

/** "Sep 15, 2026" */
export const dateOf = (iso: string) =>
	new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
