/**
 * The site's navigation, shared by the app and the docs so both carry the same header and
 * footer. `wide` items show in the header only where there is room (not on phones).
 */
export type NavItem = { href: string; label: string; wide?: boolean };
export type FooterLink = { href: string; label: string; external?: boolean };

export const NAV: NavItem[] = [
	{ href: '/app/my-daos', label: 'My DAOs' },
	{ href: '/app/daos', label: 'Public DAOs' },
	{ href: '/app/wallet', label: 'Wallet' },
	{ href: '/docs', label: 'Docs' }
];

export const GITHUB = 'https://github.com/SYNCVOTES/syncvotes';
export const X = 'https://x.com/syncvotes';

/** Where to ask for an invite code while sign-up is by invitation; the subject is filled in. */
export const INVITE_EMAIL = 'invite@syncvotes.com';
export const INVITE_MAILTO = `mailto:${INVITE_EMAIL}?subject=${encodeURIComponent('SyncVotes invite')}`;

export const FOOTER_LINKS: FooterLink[] = [
	{ href: '/docs', label: 'Docs' },
	{ href: '/terms', label: 'Terms' },
	{ href: '/privacy', label: 'Privacy' },
	{ href: '/brand', label: 'Brand kit' },
	{ href: '/version', label: 'Build' },
	{ href: 'https://docs.canton.network', label: 'Canton docs', external: true }
];
