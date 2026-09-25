import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The type scale's named sizes (layout.css), so merging knows `text-label` is a size and not a
 * colour: without it, `text-label text-green` would lose the size.
 */
export const twMergeConfig = {
	extend: { theme: { text: ['label', 'meta', 'body-sm', 'body', 'item', 'title', 'figure'] } }
};
const twMerge = extendTailwindMerge(twMergeConfig);

/** Tailwind classes, merged so that a later utility overrides an earlier one. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Helper types the shadcn-svelte components expect from this module.
export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T;
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
