import { text } from '@sveltejs/kit';
import { GIT_SHA } from '$app/env/private';

/** Which commit is running here. Deploys refuse uncommitted trees, so this is always a real one. */
export const GET = () => text(GIT_SHA);
