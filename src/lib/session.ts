import type { Signer } from './wallet';

/**
 * How long an unlocked key stays in memory. It is disposed after a quiet quarter of an hour,
 * and the moment the tab is hidden for navigation or closed — a key that is not being used has
 * no business being around. The encrypted copy in storage is untouched, so unlocking brings it
 * back; nothing here is lost, only the convenience of not asking again.
 */

const TIMEOUT_MS = 15 * 60 * 1000;

let current: { signer: Signer; onLock: () => void; timer: ReturnType<typeof setTimeout> } | null =
	null;

const ACTIVITY = ['pointerdown', 'keydown', 'touchstart'] as const;

function arm() {
	if (!current) return;
	clearTimeout(current.timer);
	current.timer = setTimeout(lock, TIMEOUT_MS);
}

/** Holds the signer for the page, and takes it away on inactivity or unload. */
export function start(signer: Signer, onLock: () => void): void {
	stop();
	current = { signer, onLock, timer: setTimeout(lock, TIMEOUT_MS) };
	for (const event of ACTIVITY) window.addEventListener(event, arm, { passive: true });
	window.addEventListener('pagehide', lock);
}

/** Disposes the signer and tells the page. Safe to call when nothing is held. */
export function lock(): void {
	const held = current;
	stop();
	if (!held) return;
	held.signer.dispose();
	held.onLock();
}

function stop(): void {
	if (!current) return;
	clearTimeout(current.timer);
	for (const event of ACTIVITY) window.removeEventListener(event, arm);
	window.removeEventListener('pagehide', lock);
	current = null;
}
