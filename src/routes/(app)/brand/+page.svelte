<script lang="ts">
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import SectionTitle from '$lib/components/section-title.svelte';
	import Panel from '$lib/components/panel.svelte';
	import Swatch from '$lib/components/swatch.svelte';
	import { Button } from '$lib/components/ui/button';
	import Check from '@lucide/svelte/icons/check';
	import Download from '@lucide/svelte/icons/download';
	import X from '@lucide/svelte/icons/x';

	/**
	 * The brand kit, carried over from SyncVotes v1: the mark and its lockups as files, the
	 * palette (the light theme's values beside the dark ones), the type and the rules. The files
	 * in static/brand/ share their geometry with favicon.svg and brand-mark.svelte; the wordmark
	 * in them is outlines, so they render the same wherever they are opened, font or no font.
	 */

	const LOGOS = [
		{
			file: 'syncvotes-logo.svg',
			label: 'Full logo',
			note: 'Icon and wordmark lockup. Primary usage, on dark backgrounds.',
			height: 'h-14'
		},
		{
			file: 'syncvotes-icon.svg',
			label: 'Icon',
			note: 'For favicons, app icons and social avatars. The tile keeps it safe on any background.',
			height: 'h-20'
		},
		{
			file: 'syncvotes-wordmark.svg',
			label: 'Wordmark',
			note: 'Mark and name without the tile, for inline placements on dark surfaces.',
			height: 'h-9'
		}
	];

	const DARK = [
		{
			name: 'Accent orange',
			hex: '#ff4d00',
			usage: 'The single accent — CTAs, links, active states'
		},
		{ name: 'Warm black', hex: '#0b0a08', usage: 'Primary background — always flat, no gradients' },
		{ name: 'Ink', hex: '#ede8dc', usage: 'Primary text' },
		{ name: 'Green', hex: '#7be0a3', usage: 'Success states, passed proposals' },
		{ name: 'Red', hex: '#ff6b7e', usage: 'Errors, rejected proposals' },
		{ name: 'Amber', hex: '#f5a623', usage: 'Warnings, pending states' }
	];

	const LIGHT = [
		{ name: 'Accent on light', hex: '#d63c00', usage: 'The accent, deepened for light surfaces' },
		{ name: 'Bone', hex: '#f7f4ed', usage: 'Light theme background' },
		{ name: 'Ink on light', hex: '#201c15', usage: 'Light theme text' }
	];

	// Only the weights app.html loads: anything else the browser would synthesise.
	const FONTS: {
		family: string;
		generic: string;
		label: string;
		description: string;
		italic?: boolean;
		weights: [number, string][];
	}[] = [
		{
			family: 'Syne',
			generic: 'sans-serif',
			label: 'Headings & titles',
			description: 'Headings, titles, the brand name. Display sans with personality.',
			weights: [
				[600, 'SemiBold'],
				[700, 'Bold'],
				[800, 'ExtraBold']
			]
		},
		{
			family: 'Inter',
			generic: 'sans-serif',
			label: 'Body text',
			description: 'Body text and descriptions. Optimised for screen readability.',
			weights: [
				[400, 'Regular'],
				[500, 'Medium'],
				[600, 'SemiBold']
			]
		},
		{
			family: 'JetBrains Mono',
			generic: 'monospace',
			label: 'Code & labels',
			description: 'Code, labels, party ids. Sharp and technical.',
			weights: [
				[400, 'Regular'],
				[500, 'Medium'],
				[700, 'Bold']
			]
		},
		{
			family: 'Instrument Serif',
			generic: 'serif',
			label: 'Editorial accents',
			description: 'Pull-quotes and editorial moments. Single weight, roman and italic.',
			weights: [[400, 'Regular']]
		},
		{
			family: 'Newsreader',
			generic: 'serif',
			label: 'Landing italics',
			description: 'The landing’s italic accents, heavier than Instrument Serif at display sizes.',
			italic: true,
			weights: [
				[400, 'Regular'],
				[500, 'Medium']
			]
		}
	];

	const DO = [
		'Use the logo on dark backgrounds (#0b0a08 or darker)',
		'On a light surface use the tile, or the bare mark with the surface’s own ink for its dot — as the app does in its light theme',
		'Maintain clear space around the logo',
		'Use the colour values exactly as given',
		'Keep surfaces flat — hairline rules, square corners, pill buttons'
	];

	const DONT = [
		'Don’t set the lockup files on light or white backgrounds',
		'Don’t rotate, distort or add effects to the logo',
		'Don’t change the logo colours',
		'Don’t add gradients, glows or mesh overlays'
	];

	const specimen = (f: (typeof FONTS)[number], weight: number) =>
		`font-family: '${f.family}', ${f.generic}; font-weight: ${weight};${f.italic ? ' font-style: italic;' : ''}`;
</script>

<svelte:head>
	<title>Brand Kit — SyncVotes</title>
	<meta
		name="description"
		content="Official brand assets for SyncVotes — logos, colours, typography and usage guidelines."
	/>
</svelte:head>

<Page>
	<PageHeader
		eyebrow="Brand"
		title="Brand Kit"
		description="Official brand assets for SyncVotes — logos, colours, typography and usage guidelines. Everything you need to represent SyncVotes consistently across any medium."
	/>

	<div class="space-y-14">
		<section>
			<SectionTitle title="Logo" />
			<p class="mb-5 text-sm text-ink-mid">
				Three variants for different uses. The mark is an orange diamond ring with a ballot dot at
				its centre — the same geometry as the favicon and the app’s header.
			</p>
			<div class="grid gap-4 md:grid-cols-3">
				{#each LOGOS as logo (logo.file)}
					<Panel class="flex flex-col">
						<div class="eyebrow mb-4">{logo.label}</div>
						<div
							class="mb-4 flex min-h-[112px] items-center justify-center border border-border bg-[#14120d] p-6"
						>
							<img
								src="/brand/{logo.file}"
								alt="SyncVotes {logo.label}"
								class="{logo.height} w-auto max-w-full"
							/>
						</div>
						<p class="mb-4 flex-1 text-xs leading-snug text-ink-dim">{logo.note}</p>
						<div>
							<Button href="/brand/{logo.file}" download={logo.file} variant="outline" size="sm">
								<Download size={14} aria-hidden="true" /> Download SVG
							</Button>
						</div>
					</Panel>
				{/each}
			</div>
		</section>

		<section>
			<SectionTitle title="Colour palette" />
			<p class="mb-5 text-sm text-ink-mid">Click a swatch to copy its hex value.</p>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{#each DARK as c (c.hex)}<Swatch name={c.name} hex={c.hex} usage={c.usage} />{/each}
			</div>
			<p class="mt-6 mb-3 text-sm text-ink-mid">
				The app’s light theme deepens the accent and swaps warm black for bone; the mark keeps its
				orange.
			</p>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{#each LIGHT as c (c.hex)}<Swatch name={c.name} hex={c.hex} usage={c.usage} />{/each}
			</div>
		</section>

		<section>
			<SectionTitle title="Typography" />
			<p class="mb-5 text-sm text-ink-mid">
				Five typefaces, one hierarchy: a display face, a body face, a mono for labels, and two
				serifs for accents.
			</p>
			<div class="grid gap-4 md:grid-cols-2">
				{#each FONTS as f (f.family)}
					<Panel>
						<div class="eyebrow mb-1">{f.label}</div>
						<div
							class="text-[28px] leading-tight text-ink"
							style={specimen(f, f.weights[f.weights.length - 1][0])}
						>
							{f.family}
						</div>
						<p class="mt-1 mb-5 text-xs leading-snug text-ink-mid">{f.description}</p>
						<div class="space-y-3">
							{#each f.weights as [weight, name] (weight)}
								<div>
									<div class="eyebrow mb-1">{name} · {weight}</div>
									<div class="text-xl leading-snug text-ink" style={specimen(f, weight)}>
										Aa Bb Cc 123
									</div>
								</div>
							{/each}
						</div>
					</Panel>
				{/each}
			</div>
		</section>

		<section>
			<SectionTitle title="Usage guidelines" />
			<p class="mb-5 text-sm text-ink-mid">
				Follow these rules to keep the SyncVotes brand consistent and recognisable.
			</p>
			<Panel class="grid gap-8 md:grid-cols-2">
				<div>
					<div class="mb-4 flex items-center gap-2 font-display text-sm font-bold text-green">
						<Check size={16} aria-hidden="true" /> Do
					</div>
					<ul class="space-y-2.5">
						{#each DO as item (item)}
							<li class="flex gap-2.5 text-[13px] leading-5 text-ink-mid">
								<Check size={14} class="mt-[3px] shrink-0 text-green" aria-hidden="true" />
								<span>{item}</span>
							</li>
						{/each}
					</ul>
				</div>
				<div>
					<div class="mb-4 flex items-center gap-2 font-display text-sm font-bold text-red">
						<X size={16} aria-hidden="true" /> Don’t
					</div>
					<ul class="space-y-2.5">
						{#each DONT as item (item)}
							<li class="flex gap-2.5 text-[13px] leading-5 text-ink-mid">
								<X size={14} class="mt-[3px] shrink-0 text-red" aria-hidden="true" />
								<span>{item}</span>
							</li>
						{/each}
					</ul>
				</div>
			</Panel>
		</section>
	</div>
</Page>
