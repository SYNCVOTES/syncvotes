import { redirect } from '@sveltejs/kit';

// The landing page is not ported yet; the app home stands in for it.
export const load = () => {
	redirect(307, '/my-daos');
};
