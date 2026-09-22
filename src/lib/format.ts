/** "in 3d 4h", "2h ago" — enough precision for a voting deadline. */
export function relative(iso: string, now = Date.now()): string {
	const diff = new Date(iso).getTime() - now;
	const abs = Math.abs(diff);
	const d = Math.floor(abs / 86_400_000);
	const h = Math.floor((abs % 86_400_000) / 3_600_000);
	const m = Math.floor((abs % 3_600_000) / 60_000);
	if (abs < 60_000) return diff > 0 ? 'in under a minute' : 'just now';
	const span = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
	return diff > 0 ? `in ${span}` : `${span} ago`;
}

/** "Sep 15, 2026" */
export const dateOf = (iso: string) =>
	new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** The hint a party id carries: the part before the double colon. */
export const hintOf = (party: string) => party.split('::')[0];

/** "alice::1220ab12…" — how a party is named on screen: its own shape, cut short. */
export const label = (party: string) =>
	`${hintOf(party)}::${party.split('::')[1]?.slice(0, 8) ?? ''}…`;

/** 12,345 */
export const fmt = (n: number) => n.toLocaleString('en-US');

/** "12,345.67 CC" — coin, to the cents that matter on screen. */
export const coin = (n: number) =>
	`${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 })} CC`;
