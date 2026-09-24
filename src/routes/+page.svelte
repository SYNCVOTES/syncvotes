<script lang="ts">
	import { onMount } from 'svelte';
	import * as remote from '$lib/api.remote';
	import { NETWORK } from '$app/env/public';
	import { startField } from './field';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import LandingNav from '$lib/components/landing-nav.svelte';
	import LandingCursor from '$lib/components/landing-cursor.svelte';
	import LandingSection from '$lib/components/landing-section.svelte';
	import LandingKicker from '$lib/components/landing-kicker.svelte';
	import LandingHeading from '$lib/components/landing-heading.svelte';
	import LandingButton from '$lib/components/landing-button.svelte';
	import LandingCards from '$lib/components/landing-cards.svelte';
	import LandingCard from '$lib/components/landing-card.svelte';
	import LandingRow from '$lib/components/landing-row.svelte';
	import LandingNumbered from '$lib/components/landing-numbered.svelte';
	import LandingTicker from '$lib/components/landing-ticker.svelte';
	import LandingManifesto from '$lib/components/landing-manifesto.svelte';
	import LandingFooter from '$lib/components/landing-footer.svelte';
	import { reveal, body } from '$lib/components/landing-classes';

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
			body: 'A proposal is a Daml contract on Canton that says what it does: a decision, who is in and with what share, the name, the settings, dissolution. What it takes to pass and how long the vote is open come from the DAO’s own settings, set at the founding and changed only by vote — not by the proposer, not by a moderator.'
		},
		{
			num: '02',
			tag: 'Vote',
			title: 'One key, one ballot',
			body: 'Your ballot weighs your share of the vote and is signed by a key only you hold. Where the DAO allows it, you may change it until the deadline. A DAO is private to its members unless it chose to be public — then anyone signed in can read it, and only members act.'
		},
		{
			num: '03',
			tag: 'Settle',
			title: 'Settled by the ledger',
			body: 'The ledger checks every ballot it is handed: right DAO, cast in time, by a member of the moment. A proposal settles the moment its outcome can no longer change, or at the deadline, and what it decided is carried out with the DAO’s own authority. No tally in a spreadsheet.'
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
			body: 'The DAO, its proposals, every ballot and the outcome — as contracts on their own party, not rows in a database. A DAO that chose to be public is readable by anyone signed in, through this app; who voted how stays with the members.'
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
			title: 'Yours, set at the founding',
			body: 'Anything that changes the DAO is voted on under rules the DAO chose — an open or secret ballot, votes final or changeable, a majority or two thirds of the whole vote or of votes cast, a quorum, one to ninety days. A decision or a choice runs under rules its proposer sets.'
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
		{ k: 'PUBLIC', v: counts ? String(counts.publicDaos) : 'SYNCING' },
		{ k: 'OPEN PROPOSALS', v: counts ? String(counts.openProposals) : 'SYNCING' },
		{ k: 'VOTES CAST', v: counts ? counts.votesCast.toLocaleString('en-US') : 'SYNCING' },
		{ k: 'MEMBERS', v: counts ? String(counts.members) : 'SYNCING' },
		{ k: 'NETWORK', v: `CANTON ${NETWORK.toUpperCase()}` },
		{ k: 'GOVERNANCE', v: 'DAML · LF 2.2' },
		{ k: 'KEYS', v: 'YOURS' }
	]);

	const LINKS = [
		{ href: '#what', label: 'What' },
		{ href: '#moves', label: 'Protocol' },
		{ href: '#privacy', label: 'Privacy' },
		{ href: '/my-daos', label: 'DAOs' },
		{ href: 'https://docs.canton.network', label: 'Canton', external: true }
	];

	let root: HTMLDivElement;
	let canvas: HTMLCanvasElement;

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
	<LandingCursor />
	<LandingNav links={LINKS} />

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
				class="{body} mt-[26px] max-w-[540px] animate-fade-in text-[15px] opacity-0 [animation-delay:0.6s] motion-reduce:animate-none motion-reduce:opacity-100 max-sm:max-w-none max-sm:text-sm"
			>
				Private DAOs, by membership or by shares. One key, one ballot. Proposals that are contracts
				and outcomes the ledger settles — no Snapshot, no Telegram polls, no spreadsheets.
			</p>
			<div
				class="mt-7 flex animate-fade-in gap-3.5 opacity-0 [animation-delay:0.8s] motion-reduce:animate-none motion-reduce:opacity-100 max-sm:flex-wrap max-sm:gap-2.5"
			>
				<LandingButton href="/my-daos" arrow>Launch App</LandingButton>
				<LandingButton href="#moves" variant="ghost">How it works</LandingButton>
			</div>
		</div>
	</section>

	<LandingTicker items={ticker} />

	<LandingSection id="what" class="grid gap-12 pb-[40px] lg:grid-cols-[1fr_1.1fr] lg:gap-20">
		<div>
			<LandingKicker text="What this is" />
			<LandingHeading>Governance that settles itself</LandingHeading>
		</div>
		<div class="{reveal} {body} space-y-5 text-[15px] lg:pt-2">
			<p>
				SyncVotes is a governance app on the Canton Network. A DAO is a Daml contract signed by its
				creator and this app, run by nobody: everything it changes about itself it decides by vote.
				A proposal is another contract, under the DAO's own settings; a ballot is a member's choice
				on it, weighing their share of the vote, signed by their own key. This app counts the
				ballots in batches, the ledger checks every one, and once the rule is met — or the deadline
				comes — the outcome is written to the ledger and carried out.
			</p>
			<p>
				There is no database of DAOs and no server that votes for anyone. This app hosts your party,
				prepares transactions and forwards what you signed; the ledger checks the rest. A DAO holds
				no coin: what it does costs network traffic, paid from a balance anyone tops up by sending
				Canton Coin to the app with the DAO's memo.
			</p>
		</div>
	</LandingSection>

	<LandingSection id="moves" class="pt-[100px] pb-[110px]">
		<LandingHeading>Three moves. Nothing in between.</LandingHeading>
		<LandingCards class="mt-[60px]">
			{#each MOVES as m (m.num)}<LandingCard
					num={m.num}
					tag={m.tag}
					title={m.title}
					text={m.body}
				/>{/each}
		</LandingCards>
	</LandingSection>

	<LandingManifesto words={MANIFESTO} />

	<LandingSection id="privacy" rule>
		<div class="mb-12 flex items-start justify-between gap-6 max-sm:flex-col">
			<div>
				<LandingKicker text="Privacy" />
				<LandingHeading class="max-sm:text-[clamp(28px,8.6vw,44px)]">
					Private by default, <span class="whitespace-nowrap">public by choice</span>
				</LandingHeading>
			</div>
			<p class="{reveal} {body} mt-2 max-w-[460px] text-[14.5px]">
				Canton delivers a transaction only to the parties in it. A DAO's name, proposals, ballots
				and members reach the members and the validator that hosts them — nobody else, unless the
				DAO chose to be public, and then only readers of this app.
			</p>
		</div>
		<div class="border-t border-border">
			{#each WHO as w, i (w.tag)}<LandingRow
					tag={w.tag}
					title={w.title}
					text={w.body}
					delay={i * 0.12}
				/>{/each}
		</div>
		<LandingButton href="/daos/create" arrow class="mt-12">Deploy your DAO</LandingButton>
	</LandingSection>

	<LandingSection id="hood" rule>
		<LandingKicker text="Under the hood" />
		<LandingHeading>What actually runs</LandingHeading>
		<ol class="mt-12 grid gap-x-16 border-t border-border lg:grid-cols-2">
			{#each HOOD as h, i (h.tag)}<LandingNumbered
					index={i}
					tag={h.tag}
					title={h.title}
					text={h.body}
				/>{/each}
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
	</LandingSection>

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
		<LandingButton href="/daos/create" arrow class="{reveal} mt-12">Deploy your DAO</LandingButton>
		<p
			class="mt-8 flex items-center justify-center gap-2.5 font-mono text-xs tracking-[0.16em] text-ink-dim uppercase"
		>
			<span class="size-1.5 animate-pulse-soft rounded-full bg-amber motion-reduce:animate-none"
			></span>
			Beta · Canton {NETWORK}
		</p>
	</section>

	<LandingFooter github={GITHUB} />
</div>
