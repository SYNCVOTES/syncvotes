import { MARKERS } from '$app/env/private';
import * as splice from './splice';

/**
 * Featured app activity markers (CIP-0047). Where they are on (`MARKERS=true`) and the provider
 * holds a featured app right, the choices that are the app's activity (creating a DAO, a
 * proposal, a vote, and carrying out a change) record one marker each in the same
 * transaction. Where they are off or the provider is not featured, nothing is recorded and the
 * choices take no right.
 */
export const on = () => (MARKERS ?? '') === 'true';

/** The provider's right, as a contract a transaction can use; null where markers are not recorded. */
export async function right(): Promise<splice.Disclosed | null> {
	if (!on()) return null;
	return splice.featuredAppRight();
}
