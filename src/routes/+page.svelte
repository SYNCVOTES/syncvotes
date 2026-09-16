<script lang="ts">
	import { onMount } from 'svelte';
	import * as remote from '$lib/api.remote';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { NETWORK } from '$lib/network';
	import { startField } from './field';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';

	/**
	 * The "Consensus Engine" landing, carried over from SyncVotes v1 and set in Tailwind: a
	 * particle word-morph hero, a ticker, what this is, three moves, a manifesto that reveals on
	 * scroll, who sees a DAO, what is under the hood, and the finale. It is pinned dark whatever
	 * the app's theme, so the theme tokens here always resolve to the dark palette.
	 */

	const GITHUB = 'https://github.com/SYNCVOTES/syncvotes';

	const MOVES = [
		{
			num: '01',
			tag: 'Propose',
			title: 'A contract, not a post',
			body: 'A proposal is a Daml contract on Canton with a deadline of one to thirty days. Who may vote, until when, and what counts as passed are checked by the ledger, not by a moderator.'
		},
		{
			num: '02',
			tag: 'Vote',
			title: 'One key, one ballot',
			body: 'Your ballot is signed by a key only you hold, once. The DAO is private to its members: nobody else on the network can see it exists.'
		},
		{
			num: '03',
			tag: 'Settle',
			title: 'Settled by the ledger',
			body: 'More than half of all members say yes — the proposal passes, on-chain, in the very transaction that cast the deciding ballot. No tally in a spreadsheet.'
		}
	];

	const MANIFESTO: { t: string; a?: boolean; s?: boolean }[] = [
		{ t: 'Governance' },
		{ t: 'today' },
		{ t: 'is' },
		{ t: 'theatre', s: true },
		{ t: '—' },
		{ t: 'polls' },
		{ t: 'nobody' },
		{ t: 'enforces,' },
		{ t: 'forums' },
		{ t: 'nobody' },
		{ t: 'reads.' },
		{ t: 'We', a: true },
		{ t: 'made', a: true },
		{ t: 'the', a: true },
		{ t: 'vote', a: true },
		{ t: 'itself', a: true, s: true },
		{ t: 'the', a: true },
		{ t: 'execution.', a: true }
	];

	// Who sees a DAO: what Canton's sub-transaction privacy means for this app, stated plainly.
	const WHO = [
		{
			tag: 'Members',
			title: 'See everything',
			body: 'The DAO, its proposals, every ballot and the outcome — as contracts on their own party, not rows in a database.'
		},
		{
			tag: 'This validator',
			title: 'Co-signs, cannot act',
			body: 'Hosts your party and co-signs each contract so the ledger accepts it, so it sees what it signs. Only your key can act, and it never leaves your browser.'
		},
		{
			tag: 'The rest of Canton',
			title: 'Sees nothing',
			body: 'No names, no proposals, no votes, no member list. Other validators never receive the transaction; the synchronizer that orders it sees only encrypted views.'
		}
	];

	const HOOD = [
		{
			tag: 'Key',
			title: 'Yours, in the browser',
			body: 'A twelve-word phrase becomes an ed25519 key that never leaves your device. Touch ID or a password unlocks it here; the phrase brings it back anywhere.'
		},
		{
			tag: 'Party',
			title: 'Hosted, not held',
			body: 'Your key is a Canton external party on this app’s validator. The validator confirms your transactions and cannot sign one for you.'
		},
		{
			tag: 'Rules',
			title: 'Majority, deadline, done',
			body: 'A proposal passes when more than half of all members say yes, fails once that can no longer happen, and can be closed by any member after its deadline.'
		},
		{
			tag: 'Live',
			title: 'No refresh button',
			body: 'The app follows the ledger’s update stream. A ballot cast on another screen shows up on yours the moment it lands.'
		}
	];

	const stats = remote.stats();
	const counts = $derived(stats.error ? null : (stats.current ?? null));
	const ticker = $derived([
		{ k: 'DAOS', v: counts ? String(counts.daos) : 'SYNCING' },
		{ k: 'OPEN PROPOSALS', v: counts ? String(counts.openProposals) : 'SYNCING' },
		{ k: 'VOTES CAST', v: counts ? counts.votesCast.toLocaleString('en-US') : 'SYNCING' },
		{ k: 'MEMBERS', v: counts ? String(counts.members) : 'SYNCING' },
		{ k: 'NETWORK', v: `CANTON ${NETWORK.toUpperCase()}` },
		{ k: 'GOVERNANCE', v: 'DAML · LF 2.2' },
		{ k: 'KEYS', v: 'YOURS' }
	]);

	// Shared looks. `rv` and `in`, `w` and `on`, `scrolled` are the hooks the script below toggles.
	const reveal =
		'rv translate-y-[30px] opacity-0 transition-[opacity,translate] duration-800 ease-[cubic-bezier(0.2,0.8,0.2,1)] [&.in]:translate-y-0 [&.in]:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100';
	const btn =
		'inline-flex items-center gap-2.5 rounded-full border border-orange bg-orange px-7 py-4 font-mono text-sm font-bold tracking-[0.1em] text-background uppercase transition-transform hover:-translate-y-0.5 max-sm:px-[22px] max-sm:py-3.5 max-sm:text-[13px] max-sm:whitespace-nowrap';
	const ghost = 'border-border-hover bg-transparent text-ink hover:border-ink';
	const h2 =
		'font-display text-[clamp(36px,4vw,60px)] leading-[1.04] font-extrabold tracking-[-0.025em] [word-spacing:-0.08em] uppercase';
	const tag = 'font-mono text-xs tracking-[0.16em] text-ink-dim uppercase';
	const grid =
		'group/grid grid grid-cols-3 gap-px border border-border bg-border max-[900px]:grid-cols-1';
	const card =
		'group/card relative translate-y-10 overflow-hidden bg-background px-9 pt-11 pb-13 opacity-0 transition-[opacity,translate,background-color] duration-800 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-[.in]/grid:translate-y-0 group-[.in]/grid:opacity-100 hover:bg-surface motion-reduce:translate-y-0 motion-reduce:opacity-100 [&:nth-child(2)]:delay-150 [&:nth-child(3)]:delay-300';
	const body = 'mt-4 max-w-[320px] font-mono text-sm leading-[1.75] text-ink-mid';
	const navLink = 'opacity-65 transition-opacity hover:opacity-100';
	const drawerLink =
		'rounded-lg px-3.5 py-3 font-mono text-[15px] tracking-[0.1em] text-ink-mid uppercase hover:bg-orange-dim hover:text-ink';

	let root: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let menuOpen = $state(false);

	onMount(() => {
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const coarse = matchMedia('(pointer: coarse)').matches;
		const cleanups: (() => void)[] = [];

		// The landing is pinned dark, whatever the app's theme.
		const prevTheme = document.documentElement.dataset.theme;
		document.documentElement.dataset.theme = 'dark';
		cleanups.push(() => {
			if (prevTheme) document.documentElement.dataset.theme = prevTheme;
			else delete document.documentElement.dataset.theme;
		});

		cleanups.push(startField(canvas, reduced));

		// Custom cursor, fine pointers only.
		if (!reduced && !coarse) {
			const dot = root.querySelector<HTMLElement>('.cur-dot')!;
			const ring = root.querySelector<HTMLElement>('.cur-ring')!;
			let x = -100,
				y = -100,
				rx = -100,
				ry = -100,
				raf = 0;
			const onMove = (e: MouseEvent) => ((x = e.clientX), (y = e.clientY));
			const loop = () => {
				rx += (x - rx) * 0.16;
				ry += (y - ry) * 0.16;
				dot.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
				ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
			const onOver = (e: MouseEvent) =>
				root.classList.toggle('cur-hover', !!(e.target as Element | null)?.closest('a,button'));
			window.addEventListener('mousemove', onMove);
			root.addEventListener('mouseover', onOver);
			cleanups.push(() => {
				cancelAnimationFrame(raf);
				window.removeEventListener('mousemove', onMove);
				root.removeEventListener('mouseover', onOver);
			});
		}

		// Centre the hero copy by its measured height on the wide layout; the canvas reads it back.
		const hero = root.querySelector<HTMLElement>('.hero')!;
		const copy = root.querySelector<HTMLElement>('.hero-copy')!;
		const centre = () => {
			if (window.innerWidth < 1400) return hero.style.removeProperty('--hero-copy-top');
			const vh = window.innerHeight,
				navClear = 104,
				foldClear = 44,
				h = copy.offsetHeight;
			const centred = navClear + (vh - navClear - foldClear - h) / 2;
			const top = Math.round(
				Math.min(Math.max(centred, navClear), Math.max(navClear, vh - foldClear - h))
			);
			hero.style.setProperty('--hero-copy-top', `${top}px`);
		};
		centre();
		const ro = new ResizeObserver(centre);
		ro.observe(copy);
		window.addEventListener('resize', centre);
		document.fonts?.ready?.then(centre).catch(() => {});
		cleanups.push(() => {
			ro.disconnect();
			window.removeEventListener('resize', centre);
		});

		if (!reduced) {
			// Scroll-reveal below the fold.
			const io = new IntersectionObserver(
				(entries) =>
					entries.forEach((e) => {
						if (e.isIntersecting) {
							e.target.classList.add('in');
							io.unobserve(e.target);
						}
					}),
				{ threshold: 0.18 }
			);
			root.querySelectorAll('.rv, .group\\/grid').forEach((el) => io.observe(el));
			cleanups.push(() => io.disconnect());

			// Manifesto — words light up as the block scrolls through.
			const m = root.querySelector<HTMLElement>('.manif')!;
			const words = m.querySelectorAll('.w');
			const onScroll = () => {
				const r = m.getBoundingClientRect();
				const prog = Math.min(
					1,
					Math.max(0, (window.innerHeight * 0.8 - r.top) / (r.height + window.innerHeight * 0.3))
				);
				const k = Math.floor(prog * words.length * 1.15);
				words.forEach((w, i) => w.classList.toggle('on', i < k));
			};
			onScroll();
			window.addEventListener('scroll', onScroll, { passive: true });
			cleanups.push(() => window.removeEventListener('scroll', onScroll));
		}

		// The nav is transparent over the hero and becomes a bar once the page scrolls.
		const nav = root.querySelector('nav');
		if (nav) {
			const onNav = () => nav.classList.toggle('scrolled', window.scrollY > 24);
			onNav();
			window.addEventListener('scroll', onNav, { passive: true });
			cleanups.push(() => window.removeEventListener('scroll', onNav));
		}

		return () => cleanups.forEach((c) => c());
	});
</script>

<svelte:head>
	<title>SyncVotes — On-chain Governance for the Canton Network</title>
	<meta
		name="description"
		content="Create private DAOs on Canton Network and vote with a key only you hold. Proposals are Daml contracts; the ledger settles the outcome."
	/>
</svelte:head>

<div
	bind:this={root}
	class="relative z-0 min-h-screen overflow-x-hidden bg-background font-display text-ink selection:bg-orange selection:text-background motion-reduce:cursor-auto pointer-fine:cursor-none pointer-fine:[&_button]:cursor-none"
>
	<div
		class="pointer-events-none fixed top-0 left-0 z-[999] hidden motion-reduce:hidden pointer-fine:block"
	>
		<div
			class="cur-ring size-9 rounded-full border border-orange opacity-50 transition-[width,height,opacity] duration-250 [.cur-hover_&]:size-16 [.cur-hover_&]:opacity-90"
		></div>
	</div>
	<div
		class="pointer-events-none fixed top-0 left-0 z-[999] hidden motion-reduce:hidden pointer-fine:block"
	>
		<div class="cur-dot size-2 rounded-full bg-orange"></div>
	</div>

	<nav
		class="fixed inset-x-0 top-0 z-50 flex items-center gap-8 border-b border-transparent px-edge py-5 transition-[padding,background-color,border-color] duration-300 max-sm:flex-wrap max-sm:gap-x-4 max-sm:gap-y-2.5 max-sm:px-5 max-sm:py-3.5 [&.scrolled]:border-border [&.scrolled]:bg-[rgba(11,10,8,0.86)] [&.scrolled]:py-3 [&.scrolled]:backdrop-blur-[18px]"
	>
		<button
			class="inline-flex items-center gap-2 font-mono text-sm font-bold tracking-[0.22em] max-sm:gap-1.5 max-sm:text-xs max-sm:tracking-[0.16em]"
			type="button"
			onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
		>
			<BrandMark size={15} /> SYNCVOTES
		</button>
		<div
			class="ml-auto hidden gap-7 font-mono text-[13px] tracking-[0.12em] uppercase min-[1121px]:flex"
		>
			<a href="#what" class={navLink}>What</a>
			<a href="#moves" class={navLink}>Protocol</a>
			<a href="#privacy" class={navLink}>Privacy</a>
			<a href="/my-daos" class={navLink}>DAOs</a>
			<a href="https://docs.canton.network" target="_blank" rel="noopener" class={navLink}>Canton</a
			>
		</div>
		<div class="flex items-center gap-3 max-[1120px]:ml-auto max-sm:gap-2">
			<a
				class="rounded-full border border-current px-4 py-[9px] font-mono text-[13px] tracking-[0.12em] whitespace-nowrap uppercase max-sm:px-[13px] max-sm:py-2 max-sm:text-xs max-sm:tracking-[0.08em]"
				href="/my-daos"
			>
				<!-- eslint-disable-next-line svelte/no-useless-mustaches -- a bare space here is dropped -->
				Launch<span class="max-sm:hidden">{' '}App</span>
			</a>
			<button
				class="hidden size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-hover max-[1120px]:inline-flex"
				type="button"
				aria-label={menuOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				{#if menuOpen}<X size={18} />{:else}<Menu size={18} />{/if}
			</button>
		</div>
	</nav>

	{#if menuOpen}
		<div
			class="fixed top-[88px] right-edge left-edge z-[49] flex flex-col gap-1 rounded-[14px] border border-border bg-surface p-3 shadow-[0_24px_60px_rgba(0,0,0,0.55)] max-sm:top-[104px]"
			role="presentation"
			onclick={() => (menuOpen = false)}
		>
			<a href="#what" class={drawerLink}>What</a>
			<a href="#moves" class={drawerLink}>Protocol</a>
			<a href="#privacy" class={drawerLink}>Privacy</a>
			<a href="/my-daos" class={drawerLink}>DAOs</a>
			<a href="https://docs.canton.network" target="_blank" rel="noopener" class={drawerLink}
				>Canton</a
			>
		</div>
	{/if}

	<!-- Exactly one screen: the copy centred inside it, the ticker at the fold. -->
	<section
		class="hero relative h-svh min-h-[640px] overflow-hidden max-sm:h-[124svh] max-sm:min-h-[920px]"
	>
		<canvas id="field" bind:this={canvas} class="absolute inset-0 h-full w-full"></canvas>
		<div
			class="hero-copy absolute top-[clamp(400px,46vh,500px)] left-edge z-5 max-w-[min(1100px,calc(100vw-var(--spacing-edge)-40px))] max-sm:inset-x-6 max-sm:top-[clamp(420px,52vh,470px)] max-sm:max-w-none min-[1400px]:top-[var(--hero-copy-top,clamp(88px,calc(50vh-260px),calc(100vh-560px)))] min-[3300px]:left-[max(40px,calc((100vw-2400px)/2))] [@media(min-width:901px)_and_(max-width:1399px)_and_(max-height:860px)]:top-[clamp(300px,46vh,380px)]"
		>
			<h1
				class="font-display text-[clamp(44px,min(6.4vw,10vh),100px)] leading-[1.02] font-extrabold tracking-[-0.03em] uppercase max-sm:text-[clamp(20px,calc((100vw-52px)/10.8),44px)] [@media(min-width:901px)_and_(max-height:860px)]:text-[clamp(44px,6.6vh,76px)]"
			>
				{#each ['Consensus', 'is a', 'Start it.'] as row, i (row)}
					<span
						class="-mx-[0.05em] -my-[0.04em] block overflow-hidden px-[0.05em] py-[0.04em] whitespace-nowrap"
					>
						<span
							class="block translate-y-[110%] animate-rise motion-reduce:translate-y-0 motion-reduce:animate-none"
							style="animation-delay: {i * 0.12}s"
						>
							{row}
							{#if i === 1}<span
									class="font-editorial text-[1.18em] font-medium tracking-normal text-orange normal-case italic"
									>machine.</span
								>{/if}
						</span>
					</span>
				{/each}
			</h1>
			<p
				class="mt-[26px] max-w-[540px] animate-fade-in font-mono text-[15px] leading-[1.75] text-ink-mid opacity-0 [animation-delay:0.6s] motion-reduce:animate-none motion-reduce:opacity-100 max-sm:max-w-none max-sm:text-sm"
			>
				Private DAOs. One key, one ballot. Proposals that are contracts and outcomes the ledger
				settles — no Snapshot, no Telegram polls, no spreadsheets.
			</p>
			<div
				class="mt-7 flex animate-fade-in gap-3.5 opacity-0 [animation-delay:0.8s] motion-reduce:animate-none motion-reduce:opacity-100 max-sm:flex-wrap max-sm:gap-2.5"
			>
				<a class={btn} href="/my-daos">Launch App <ArrowRight size={16} strokeWidth={2.5} /></a>
				<a class="{btn} {ghost}" href="#moves">How it works</a>
			</div>
		</div>
	</section>

	<div class="group overflow-hidden border-y border-border bg-surface py-3.5" aria-hidden="true">
		<ul
			class="flex w-max animate-tape list-none whitespace-nowrap group-hover:[animation-play-state:paused] motion-reduce:animate-none"
		>
			{#each [...ticker, ...ticker] as it, i (i)}
				<li class="mr-12 flex gap-2.5 font-mono text-[13px] tracking-[0.06em]">
					<span class="text-ink-dim">{it.k}</span><span>{it.v}</span>
				</li>
			{/each}
		</ul>
	</div>

	<section
		id="what"
		class="grid gap-12 px-edge pt-[120px] pb-[40px] lg:grid-cols-[1fr_1.1fr] lg:gap-20"
	>
		<div>
			<div class="{tag} mb-[18px]">// What this is</div>
			<h2 class="{h2} {reveal}">Governance that settles itself</h2>
		</div>
		<div class="{reveal} space-y-5 font-mono text-[15px] leading-[1.75] text-ink-mid lg:pt-2">
			<p>
				SyncVotes is a governance app on the Canton Network. A DAO is a Daml contract signed by its
				admin and this app; a proposal is another, with a deadline; a ballot is a choice on it,
				signed by the member's own key. When more than half of all members have said yes — or no has
				made that impossible — the outcome is written to the ledger by the very ballot that settled
				it.
			</p>
			<p>
				There is no database of DAOs and no server that votes for anyone. This app hosts your party,
				prepares transactions and forwards what you signed; the ledger checks the rest.
			</p>
		</div>
	</section>

	<section id="moves" class="px-edge pt-[100px] pb-[110px]">
		<h2 class="{h2} {reveal}">Three moves. Nothing in between.</h2>
		<div class="{grid} mt-[60px]">
			{#each MOVES as m (m.num)}
				<div class={card}>
					<div
						class="absolute top-2 right-4 font-editorial text-[120px] leading-none text-orange/15 italic transition-colors duration-400 group-hover/card:text-orange"
					>
						{m.num}
					</div>
					<div class={tag}>{m.tag}</div>
					<h3 class="mt-14 font-display text-[30px] font-bold tracking-[-0.02em] uppercase">
						{m.title}
					</h3>
					<p class={body}>{m.body}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- An editorial pause: the words light up as the block scrolls through. -->
	<section class="manif mx-auto max-w-[calc(1200px+2*var(--spacing-edge))] px-edge py-[72px]">
		<p
			class="font-display text-[clamp(34px,4.6vw,72px)] leading-[1.1] font-bold tracking-[-0.02em] uppercase [word-spacing:0.04em]"
		>
			<!-- eslint-disable svelte/no-useless-mustaches -- a bare space between the spans is dropped -->
			{#each MANIFESTO as w, i (i)}
				<span
					><span
						class="w opacity-[0.13] transition-opacity duration-400 motion-reduce:opacity-100 [&.on]:opacity-100 {w.a
							? 'text-orange'
							: ''} {w.s
							? 'mx-[0.06em] font-editorial text-[1.08em] font-medium normal-case italic'
							: ''}">{w.t}</span
					>{' '}</span
				>
			{/each}
			<!-- eslint-enable svelte/no-useless-mustaches -->
		</p>
	</section>

	<section id="privacy" class="border-t border-border px-edge pt-[120px] pb-[140px]">
		<div class="mb-12 flex items-start justify-between gap-6 max-sm:flex-col">
			<div>
				<div class="{tag} mb-[18px]">// Privacy</div>
				<h2 class="{h2} {reveal} max-sm:text-[clamp(28px,8.6vw,44px)]">
					Every DAO here <span class="whitespace-nowrap">is private</span>
				</h2>
			</div>
			<p class="{reveal} mt-2 max-w-[460px] font-mono text-[14.5px] leading-[1.75] text-ink-mid">
				Canton delivers a transaction only to the parties in it. A DAO's name, proposals, ballots
				and members reach the members and the validator that hosts them — nobody else.
			</p>
		</div>
		<div class="border-t border-border">
			{#each WHO as w, i (w.tag)}
				<div
					class="{reveal} grid gap-4 border-b border-border py-9 md:grid-cols-[200px_1fr_1fr] md:gap-10 md:py-11"
					style="transition-delay: {i * 0.12}s"
				>
					<div class="{tag} text-orange">{w.tag}</div>
					<h3
						class="font-display text-[clamp(24px,2.4vw,34px)] leading-[1.05] font-bold tracking-[-0.02em] uppercase"
					>
						{w.title}
					</h3>
					<p class="max-w-[440px] font-mono text-sm leading-[1.75] text-ink-mid">{w.body}</p>
				</div>
			{/each}
		</div>
		<a class="{btn} mt-12" href="/daos/create"
			>Deploy your DAO <ArrowRight size={16} strokeWidth={2.5} /></a
		>
	</section>

	<section id="hood" class="border-t border-border px-edge pt-[120px] pb-[140px]">
		<div class="{tag} mb-[18px]">// Under the hood</div>
		<h2 class="{h2} {reveal}">What actually runs</h2>
		<ol class="mt-12 grid gap-x-16 border-t border-border lg:grid-cols-2">
			{#each HOOD as h, i (h.tag)}
				<li
					class="{reveal} grid grid-cols-[72px_1fr] gap-6 border-b border-border py-9 md:grid-cols-[96px_1fr]"
					style="transition-delay: {i * 0.1}s"
				>
					<span class="font-editorial text-[56px] leading-none text-orange italic md:text-[72px]"
						>0{i + 1}</span
					>
					<div>
						<div class={tag}>{h.tag}</div>
						<h3
							class="mt-2 font-display text-[24px] leading-[1.1] font-bold tracking-[-0.02em] uppercase"
						>
							{h.title}
						</h3>
						<p class="mt-3 max-w-[420px] font-mono text-sm leading-[1.75] text-ink-mid">{h.body}</p>
					</div>
				</li>
			{/each}
		</ol>
		<p class="{reveal} mt-10 font-mono text-[13px] tracking-[0.06em] text-ink-dim">
			Open source, Daml and SvelteKit —
			<a
				href={GITHUB}
				target="_blank"
				rel="noopener"
				class="inline-flex items-center gap-0.5 text-ink hover:text-orange"
				>read the code<ArrowUpRight size={13} /></a
			>.
		</p>
	</section>

	<section
		class="relative overflow-hidden border-t border-border px-edge pt-[180px] pb-[160px] text-center"
	>
		<div
			class="pointer-events-none absolute top-1/2 left-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(255,77,0,0.13),transparent_60%)]"
		></div>
		<h2
			class="{reveal} pb-[0.12em] font-display text-[clamp(52px,8.4vw,132px)] leading-none font-extrabold tracking-[-0.03em] uppercase"
		>
			Stop polling.<br /><span
				class="inline-block font-editorial text-[1.04em] leading-[1.15] font-medium text-orange normal-case italic"
				>Start governing.</span
			>
		</h2>
		<a class="{btn} {reveal} mt-12" href="/daos/create"
			>Deploy your DAO <ArrowRight size={16} strokeWidth={2.5} /></a
		>
		<p
			class="mt-8 flex items-center justify-center gap-2.5 font-mono text-xs tracking-[0.16em] text-ink-dim uppercase"
		>
			<span class="size-1.5 animate-pulse-soft rounded-full bg-amber motion-reduce:animate-none"
			></span>
			Beta · Canton {NETWORK}
		</p>
	</section>

	<footer
		class="flex flex-wrap justify-between gap-4 border-t border-border px-edge py-7 font-mono text-[12.5px] tracking-[0.12em] text-ink-dim uppercase [&_a:hover]:text-ink"
	>
		<span class="inline-flex items-center gap-2"
			><BrandMark size={12} /> SyncVotes · Canton Network</span
		>
		<span
			>Daml-native governance · <a href={GITHUB} target="_blank" rel="noopener">GitHub</a> ·
			<a href="/version">build</a></span
		>
		<span>© {new Date().getFullYear()}</span>
	</footer>
</div>
