/**
 * How long an unlocked key stays in memory: a quiet quarter of an hour, or until the tab is
 * hidden for navigation or closed. The encrypted copy in storage is untouched, so unlocking
 * brings it back.
 */

const TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY = ['pointerdown', 'keydown', 'touchstart'] as const;

let timer: ReturnType<typeof setTimeout> | undefined;
let expire: (() => void) | undefined;

const rearm = () => {
	clearTimeout(timer);
	timer = setTimeout(() => expire?.(), TIMEOUT_MS);
};

/** Calls `onExpire` after the quiet period or on `pagehide`, once; `stop` cancels. */
export function start(onExpire: () => void): void {
	stop();
	expire = () => {
		stop();
		onExpire();
	};
	rearm();
	for (const event of ACTIVITY) window.addEventListener(event, rearm, { passive: true });
	window.addEventListener('pagehide', expire);
}

export function stop(): void {
	clearTimeout(timer);
	for (const event of ACTIVITY) window.removeEventListener(event, rearm);
	if (expire) window.removeEventListener('pagehide', expire);
	expire = undefined;
}
