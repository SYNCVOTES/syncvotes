/**
 * The hero particle field, carried over from v1 as is: a cloud of points that keeps re-forming
 * into the next word. Returns a teardown that cancels every loop, timer and listener.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  j: number;
  sz: number;
  hot: boolean;
}

/** Boots the hero particle field. Returns a teardown that cancels every
 *  loop / timer / listener so SPA navigation off "/" leaks nothing. */
export function startField(cv: HTMLCanvasElement, reduced: boolean): () => void {
  const ctx = cv.getContext("2d");
  if (!ctx) return () => {};
  const g = ctx;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  const WORDS = ["VOTE", "SYNC", "DAO", "EXEC", "⏻"];
  // 1800–2199px draws the stacked word nearly twice as large — denser
  // particle cloud keeps the strokes solid. ≥2200px the word moves into
  // the narrower right column, where the base count is already dense.
  const w0 = cv.clientWidth;
  const N = w0 >= 1800 && w0 < 2200 ? 5200 : 3900;
  const pts: Particle[] = [];
  const mouse = { x: -9999, y: -9999 };
  let wi = 0;

  const resize = () => {
    W = cv.clientWidth;
    H = cv.clientHeight;
    cv.width = W * DPR;
    cv.height = H * DPR;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  resize();

  for (let i = 0; i < N; i++) {
    pts.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      j: Math.random() * Math.PI * 2,
      sz: 0.8 + Math.random() * 1.6,
      hot: Math.random() < 0.12,
    });
  }

  const target = (word: string) => {
    const off = document.createElement("canvas");
    const ow = 1200;
    const oh = 560;
    off.width = ow;
    off.height = oh;
    const o = off.getContext("2d");
    if (!o) return;
    o.fillStyle = "#fff";
    o.textAlign = "center";
    o.textBaseline = "middle";
    let fs = 420;
    o.font = `800 ${fs}px Syne, sans-serif`;
    const w0 = o.measureText(word).width;
    if (w0 > ow * 0.92) fs = Math.floor((fs * (ow * 0.92)) / w0);
    o.font = `800 ${fs}px Syne, sans-serif`;
    o.fillText(word, ow / 2, oh / 2 + 20);
    const data = o.getImageData(0, 0, ow, oh).data;
    const spots: [number, number][] = [];
    for (let y = 0; y < oh; y += 4) {
      for (let x = 0; x < ow; x += 4) {
        if (data[(y * ow + x) * 4 + 3] > 128) spots.push([x, y]);
      }
    }
    if (!spots.length) return;
    // Real pixel bounds of the rasterised word — sizing off these (instead
    // of the whole offscreen canvas) lets the word fill its band exactly,
    // whatever the glyph shape (VOTE vs DAO vs ⏻).
    let bx0 = Infinity;
    let bx1 = -Infinity;
    let by0 = Infinity;
    let by1 = -Infinity;
    for (const s of spots) {
      if (s[0] < bx0) bx0 = s[0];
      if (s[0] > bx1) bx1 = s[0];
      if (s[1] < by0) by0 = s[1];
      if (s[1] > by1) by1 = s[1];
    }
    const wordW = Math.max(bx1 - bx0, 1);
    const wordH = Math.max(by1 - by0, 1);
    let scale: number;
    let cx: number;
    let cy: number;
    // Offscreen anchor the particles map from: word-bounds centre on
    // desktop, canvas centre on mobile (keeps the tuned mobile layout as-is).
    let ocx = ow / 2;
    let ocy = oh / 2;
    // copyTop mirrors the .hero-copy clamps in landing.css (standard +
    // short-desktop variants) — both desktop layouts derive from it, so the
    // gap to the headline holds by construction and nothing ever overlaps.
    const vh = window.innerHeight || H;
    // Wide screens use the right-column word, so the copy no longer needs the
    // tall top band the stacked layout leaves for the word — CENTRE the whole
    // composition (~500px tall) in the viewport (50vh − 250) instead of
    // pinning it ~46% down, which left a big void above the fold on normal
    // MacBooks. Stacked (<1500) keeps the top-band pin. Mirrors landing.css.
    const copyTopFallback =
      W >= 1400
        ? Math.max(88, Math.min(0.5 * vh - 260, vh - 560))
        : vh <= 860
          ? Math.min(Math.max(300, 0.46 * vh), 380)
          : Math.min(Math.max(400, 0.46 * vh), 500);
    // On the wide right-column layout, READ the copy's real rendered top from
    // the DOM instead of re-deriving it — the layout effect centres .hero-copy
    // by its measured height, and reading offsetTop makes the canvas mirror
    // landing.css exactly (no formula to drift out of sync, which is what kept
    // stranding the word high/low per resolution). Fallback until it mounts.
    const copyEl = cv.closest(".hero")?.querySelector<HTMLElement>(".hero-copy") ?? null;
    const copyTop =
      W >= 1400 && copyEl && copyEl.offsetHeight > 0 ? copyEl.offsetTop : copyTopFallback;
    if (W >= 1400) {
      // Laptops + monitors (1500px and up): the word lives in the free column
      // to the RIGHT of the headline, flanking it — a compact, balanced hero
      // that fits one viewport (the old stacked full-width word overflowed
      // FHD, pushing the CTAs off-screen). Below 1500px the right column gets
      // too narrow, so small laptops keep the stacked layout. Geometry
      // mirrors landing.css: copy left = --edge = max(40px, (100vw−1400px)/2),
      // headline width = 10.59em of the h1 font clamp.
      // Ultra-wide (>3300px): --edge keeps centering a 1400px column, which
      // strands the copy far from the word column's far edge — the word ends
      // up hugging the right viewport edge with a ~1000px void on the left
      // (user report at 3562×2588). Above 3300px we center the whole
      // composition (~2400px of copy + gap + word) instead. Mirrors the
      // .hero-copy override in landing.css.
      const edge =
        W >= 3300 ? Math.max(40, (W - 2400) / 2) : Math.max(40, (W - 1400) / 2);
      // Mirror the h1 clamp in landing.css — including the short-desktop
      // (≤860px tall) variant, or the word floats right of a headline that's
      // actually narrower than JS assumes (matters now the right column
      // reaches down to 1500px, which includes short 16:9 laptops).
      const h1fs =
        vh <= 860
          ? Math.min(Math.max(0.066 * vh, 44), 76)
          : Math.min(Math.max(Math.min(0.064 * W, 0.1 * vh), 44), 100);
      // Start the word closer to the headline (9.4em ≈ just past the shorter
      // "IS A machine." / "START IT." rows it sits beside, not the widest
      // CONSENSUS row) so it reads LEFTer and gets a wider column → bigger.
      const copyRight = edge + 9.4 * h1fs;
      const gapText = 28; // air between the headline and the word
      // Symmetric composition at ultra-wide: right margin mirrors the left
      // edge instead of pinning the word from the viewport edge.
      const margin = W >= 3300 ? edge : 40;
      const availW = Math.max(W - copyRight - gapText - margin, 160);
      const availH = Math.max(vh - copyTop - 80, 160);
      // Bigger caps so the word carries real weight next to the huge headline
      // instead of floating small (user: "непропорциональное"). availW still
      // binds on wide words; narrow glyphs (⏻) get room to grow.
      const hCap = vh >= 1600 ? 760 : 620;
      const sCap = vh >= 1600 ? 1.8 : 1.5;
      // Cap the word's HEIGHT relative to the headline. A tall glyph (⏻) is
      // bound by height, so without this it grows to fill the whole vertical
      // band and towers ABOVE the headline into the top margin — which reads
      // as "empty space reserved for the switch" (user: "выключатель сильно
      // большой ... пространство сверху пустует"). Wide words are bound by
      // availW and sit well under this cap, so it only reins in tall glyphs,
      // keeping every word about the same visual weight as the headline.
      const hProp = 4.4 * h1fs;
      scale = Math.min(availW / wordW, availH / wordH, hCap / wordH, hProp / wordH, sCap);
      cx = copyRight + gapText + availW / 2;
      // Wide words (VOTE/SYNC/EXEC) want to sit beside the headline's lower
      // rows (copyTop + 2.1·h1fs — grounded, "должен быть ниже"). But a TALL
      // glyph (⏻) rendered at that same CENTRE reaches up into the fixed nav
      // ("выключатель залазит вверх"). So clamp the centre by the word's OWN
      // rendered height: it can never climb above the nav nor drop under the
      // ticker, and short words are unaffected (their clamp window is wide).
      const wordRenderH = wordH * scale;
      const navClear = 96;
      const foldClear = 52;
      const cyWanted = copyTop + 2.1 * h1fs;
      const cyLo = navClear + wordRenderH / 2;
      const cyHi = vh - foldClear - wordRenderH / 2;
      cy = cyHi >= cyLo ? Math.min(Math.max(cyWanted, cyLo), cyHi) : (cyLo + cyHi) / 2;
      ocx = (bx0 + bx1) / 2;
      ocy = (by0 + by1) / 2;
    } else if (W >= 901) {
      // Desktop — the classic stacked hero: the word fills the whole empty
      // band between the fixed nav and the headline, as big as the band
      // allows.
      const navB = 124; // fixed nav + breathing room
      const gap = 40; // air between the word and the headline
      const bandH = Math.max(copyTop - gap - navB, 120);
      const bandW = W - 96;
      scale = Math.min(bandW / wordW, bandH / wordH, 1.6);
      cx = W / 2;
      cy = navB + bandH / 2;
      ocx = (bx0 + bx1) / 2;
      ocy = (by0 + by1) / 2;
    } else {
      const mobile = W < 640;
      const short = H < 820;
      scale = Math.min(
        (W * (mobile ? 1.04 : 0.92)) / ow,
        (H * (mobile ? 0.4 : short ? 0.46 : 0.56)) / oh,
        mobile ? 0.52 : short ? 0.74 : 0.9,
      );
      cx = W * 0.5;
      cy = mobile
        ? Math.min(Math.max(H * 0.27, 180), 250)
        : short
          ? Math.min(Math.max(H * 0.24, 240), 285)
          : Math.min(Math.max(H * 0.22, 260), 320);
    }
    for (const p of pts) {
      const s = spots[(Math.random() * spots.length) | 0];
      p.tx = cx + (s[0] - ocx) * scale + (Math.random() - 0.5) * 3;
      p.ty = cy + (s[1] - ocy) * scale + (Math.random() - 0.5) * 3;
    }
  };

  const onResize = () => {
    resize();
    target(WORDS[wi]);
  };
  const onMove = (e: MouseEvent) => {
    const r = cv.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  const onLeave = () => {
    mouse.x = -9999;
    mouse.y = -9999;
  };
  window.addEventListener("resize", onResize);
  cv.addEventListener("mousemove", onMove);
  cv.addEventListener("mouseleave", onLeave);

  target(WORDS[0]);
  // Re-target once webfonts land so glyph shapes use Syne, not the fallback.
  if (typeof document.fonts?.ready?.then === "function") {
    document.fonts.ready.then(() => target(WORDS[wi])).catch(() => {});
  }

  const draw = () => {
    g.clearRect(0, 0, W, H);
    for (const p of pts) {
      // Canvas fillStyle can't resolve CSS var() — invalid values are
      // silently ignored and the particles paint black-on-black. The
      // landing is pinned dark, so literal brand colors are correct here.
      g.fillStyle = p.hot ? "rgba(255,77,0,.8)" : "rgba(237,232,220,.48)";
      g.fillRect(p.x, p.y, p.sz, p.sz);
    }
  };

  if (reduced) {
    // Static single frame — snap particles onto the first word, no animation.
    for (const p of pts) {
      p.x = p.tx;
      p.y = p.ty;
    }
    draw();
    return () => {
      window.removeEventListener("resize", onResize);
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("mouseleave", onLeave);
    };
  }

  const wordTimer = window.setInterval(() => {
    wi = (wi + 1) % WORDS.length;
    target(WORDS[wi]);
  }, 3600);

  let t = 0;
  let raf = 0;
  const frame = () => {
    t += 0.016;
    g.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.vx += (p.tx - p.x) * 0.012;
      p.vy += (p.ty - p.y) * 0.012;
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 16900) {
        const f = (130 - Math.sqrt(d2)) * 0.02;
        p.vx += dx * f * 0.06;
        p.vy += dy * f * 0.06;
      }
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx + Math.sin(t * 1.4 + p.j) * 0.18;
      p.y += p.vy + Math.cos(t * 1.2 + p.j) * 0.18;
      // Canvas fillStyle can't resolve CSS var() — invalid values are
      // silently ignored and the particles paint black-on-black. The
      // landing is pinned dark, so literal brand colors are correct here.
      g.fillStyle = p.hot ? "rgba(255,77,0,.8)" : "rgba(237,232,220,.48)";
      g.fillRect(p.x, p.y, p.sz, p.sz);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(wordTimer);
    window.removeEventListener("resize", onResize);
    cv.removeEventListener("mousemove", onMove);
    cv.removeEventListener("mouseleave", onLeave);
  };
}

