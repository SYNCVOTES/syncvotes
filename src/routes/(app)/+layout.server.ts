import { GIT_SHA } from '$app/env/private';

/** The running commit, for the footer — the same answer `/version` gives. */
export const load = () => ({ build: GIT_SHA });
