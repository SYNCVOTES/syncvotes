/**
 * The landing's shared looks, as strings the landing components and the page compose. `rv`/`in`,
 * `w`/`on` and `scrolled` are the hooks the page's script toggles.
 */
export const reveal =
	'rv translate-y-[30px] opacity-0 transition-[opacity,translate] duration-800 ease-[cubic-bezier(0.2,0.8,0.2,1)] [&.in]:translate-y-0 [&.in]:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100';
export const tag = 'font-mono text-xs tracking-[0.16em] text-ink-dim uppercase';
// Paragraphs in Inter: long mono lines are hard to read; mono stays for labels and figures.
export const body = 'font-sans text-body leading-[1.7] text-ink-mid';
