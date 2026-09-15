<script lang="ts">
	import './landing.css';
	import { onMount } from 'svelte';
	import * as remote from '$lib/api.remote';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { startField } from './field';

	/*
	 * The "Consensus Engine" landing, carried over from v1: full-bleed, its own nav and footer,
	 * a particle word-morph hero, a ticker, three moves, a manifesto that reveals on scroll.
	 * The one honest change: DAOs are private, so the live feed became live counts.
	 */

	const MOVES = [
		{
			num: '01',
			tag: 'Propose',
			title: 'A contract, not a post',
			body: 'A proposal is a Daml contract on Canton. Who may vote, until when, and what counts as passed are checked by the ledger, not by a moderator.'
		},
		{
			num: '02',
			tag: 'Vote',
			title: 'One key, one ballot',
			body: 'Your ballot is signed by a key only you hold. The DAO is private to its members: nobody else on the network can see it exists.'
		},
		{
			num: '03',
			tag: 'Close',
			title: 'Settled by the ledger',
			body: 'A majority of members says yes — the proposal passes, on-chain, as soon as the outcome is settled. No tally in a spreadsheet.'
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

	const stats = remote.stats();
	const counts = $derived(stats.error ? null : (stats.current ?? null));
	const ready = $derived(counts !== null);
	const ticker = $derived([
		{ k: 'DAOS', v: counts ? String(counts.daos) : 'SYNCING' },
		{ k: 'OPEN PROPOSALS', v: counts ? String(counts.openProposals) : 'SYNCING' },
		{ k: 'VOTES CAST', v: counts ? counts.votesCast.toLocaleString('en-US') : 'SYNCING' },
		{ k: 'MEMBERS', v: counts ? String(counts.members) : 'SYNCING' },
		{ k: 'NETWORK', v: 'CANTON TESTNET' },
		{ k: 'GOVERNANCE', v: 'DAML · LF 2.2' },
		{ k: 'KEYS', v: 'YOURS' }
	]);

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
			root.querySelectorAll('.rv, .moves-grid').forEach((el) => io.observe(el));
			cleanups.push(() => io.disconnect());

			// Manifesto — words light up as the block scrolls through.
			const m = root.querySelector<HTMLElement>('.manif p')!;
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

<div class="sv-landing" bind:this={root}>
	<div class="cur"><div class="cur-ring"></div></div>
	<div class="cur"><div class="cur-dot"></div></div>

	<nav>
		<button
			class="logo"
			type="button"
			onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
		>
			<BrandMark size={15} /> SYNCVOTES
		</button>
		<div class="links">
			<a href="#moves">Protocol</a>
			<a href="#feed">Live</a>
			<a href="/my-daos">DAOs</a>
			<a href="https://docs.canton.network" target="_blank" rel="noopener">Canton</a>
		</div>
		<div class="nav-right">
			<a class="nav-cta" href="/my-daos">Launch<span class="hide-sm">{' '}App</span></a>
			<button
				class="nav-burger"
				type="button"
				aria-label={menuOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				{menuOpen ? '✕' : '☰'}
			</button>
		</div>
	</nav>

	{#if menuOpen}
		<div class="nav-drawer open" role="presentation" onclick={() => (menuOpen = false)}>
			<a href="#moves">Protocol</a>
			<a href="#feed">Live</a>
			<a href="/my-daos">DAOs</a>
			<a href="https://docs.canton.network" target="_blank" rel="noopener">Canton</a>
		</div>
	{/if}

	<section class="hero">
		<canvas id="field" bind:this={canvas}></canvas>
		<div class="hero-copy">
			<h1 class="hero-h">
				<span class="row"><span>Consensus</span></span>
				<span class="row"><span>is a <span class="ser acc">machine.</span></span></span>
				<span class="row"><span>Start it.</span></span>
			</h1>
			<p class="hero-sub">
				Private DAOs. One key, one ballot. Proposals that are contracts and outcomes the ledger
				settles — no Snapshot, no Telegram polls, no spreadsheets.
			</p>
			<div class="hero-ctas">
				<a class="btn" href="/my-daos">Launch App →</a>
				<a class="btn gh" href="#moves">How it works</a>
			</div>
		</div>
	</section>

	<div class="tape" aria-hidden="true">
		<ul>
			{#each [...ticker, ...ticker] as it, i (i)}
				<li><span class="k">{it.k}</span><span>{it.v}</span></li>
			{/each}
		</ul>
	</div>

	<section class="moves" id="moves">
		<h2 class="rv">Three moves. Nothing in between.</h2>
		<div class="moves-grid">
			{#each MOVES as m (m.num)}
				<div class="move">
					<div class="num">{m.num}</div>
					<div class="tag">{m.tag}</div>
					<h3>{m.title}</h3>
					<p>{m.body}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="manif">
		<p>
			{#each MANIFESTO as w, i (i)}
				<span><span class="w{w.a ? ' a' : ''}{w.s ? ' s' : ''}">{w.t}</span>{' '}</span>
			{/each}
		</p>
	</section>

	<section class="feed" id="feed">
		<div class="feed-head">
			<div><h2 class="rv">The floor <span class="nw">is private</span></h2></div>
			<div class="feed-meter">
				<div class="feed-live">
					<span class="d"></span>{ready ? 'Live · Canton TestNet' : 'Syncing…'}
				</div>
				<div class="lbl">Votes cast on-chain</div>
				{#if counts}
					<div class="odo">
						{#each String(counts.votesCast) as d, i (i)}
							<span class="digit"
								><span class="reel" style="transform: translateY({-Number(d) * 10}%)"
									>0<br />1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9</span
								></span
							>
						{/each}
					</div>
				{:else}
					<div class="odo-empty">SYNCING</div>
				{/if}
			</div>
		</div>
		<div class="feed-empty">
			<span class="fe-hl">Every DAO here is private</span>
			<p>
				Members see their proposals; the network sees nothing. What you get is the count — and a
				door.
			</p>
			<a class="btn" href="/daos/create">Deploy your DAO →</a>
		</div>
	</section>

	<section class="finale">
		<div class="halo"></div>
		<h2 class="rv">Stop polling.<br /><span class="ser acc">Start governing.</span></h2>
		<a class="btn rv" href="/daos/create">Deploy your DAO →</a>
	</section>

	<footer>
		<span class="foot-brand"><BrandMark size={12} /> SyncVotes · Canton Network</span>
		<span>Daml-native governance · <a href="/version">build</a></span>
		<span>© {new Date().getFullYear()}</span>
	</footer>
</div>
