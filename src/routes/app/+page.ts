import { redirect } from '@sveltejs/kit';

/** The app opens on the DAOs one belongs to. */
export const load = () => redirect(307, '/app/my-daos');
