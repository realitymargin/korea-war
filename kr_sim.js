// RealityMargin · Korea sim page engine, ported from the Japan page (japan-sim/tools/page_jp/jp_sim.js) and the channel template (_toolkit/sim_page): one link, tabs, workers across the cores with a page fallback.
// Every war's dice depend only on the seed and its number, so blocks can finish in any order and any computer gets the same answer.
// Needs the model (model/sim_web.js: war, rng, warSeed, oddsFor, ODDS, realUntil, monthName, O_*), window.KR from the builder and window.KR_RUNS (film_runs.js: the runs behind the film's numbers).
// The shares are of the wars America fights (AMERICA STAYS OUT is a share of all wars), as in the film. War numbers are the code's own: war 420 is warSeed(seed, 420).
(() => {
  const $ = id => document.getElementById(id), R = window.KR, RUNS = window.KR_RUNS, FILM = RUNS.film, fmt = n => n.toLocaleString("en-US");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, glide = () => reduced ? "auto" : "smooth", narrow = () => matchMedia("(max-width: 979px)").matches;
  const qs = new URLSearchParams(location.search), MAX = 5000000, MIN = 1000, PREVIEW = 5000, SMALL = 100000, MAXSEED = 4294967295;
  const cores = qs.has("workers") ? Math.max(0, Math.min(16, +qs.get("workers") | 0)) : Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1));
  const START = Object.fromEntries(R.starts.map(s => [s.id, s])), WI = Object.fromEntries(R.whatifs.map(w => [w.id, w])), OUT = Object.fromEntries(R.outcomes.map(o => [o.key, o]));
  const UNI = R.uni, BET = R.bet, AOUT = R.out;
  let col = "mid", over = {}, whatif = "", start = FILM.set.start, seed = R.seed, wars = FILM.set.n, label = "";
  let job = null, pool = null, broken = cores === 0, nextId = 1, previewTimer = 0, msPerWar = R.msPerWar, reader = null, tweenId = 0, quietUntil = 0, scanId = 0;
  let shown = FILM.set, lastCounts = FILM.c;

  /* ---------- settings ---------- */
  const cur = () => ({ col, over: { ...over }, fix: whatif, start, seed, n: wars });
  const P_of = s => ({ ...oddsFor(s.col), ...s.over }), base = () => oddsFor(col);
  const spec_of = s => ({ t: START[s.start].t, x: { ...(s.fix ? WI[s.fix].fix : {}) } });
  const makeH = sp => sp.t ? realUntil(sp.t, sp.x) : { ...sp.x };
  const key = s => [s.col, s.start, s.fix || ""].join("|");
  const BYKEY = {}; for (const id in RUNS) (BYKEY[key(RUNS[id].set)] = BYKEY[key(RUNS[id].set)] || []).push(RUNS[id]);
  function refFor(s) { for (const k of [key(s), key({ ...s, col: "mid" }), key({ ...s, col: "mid", fix: "" }), key({ ...s, col: "mid", fix: "", start: "t0" })]) { const L = BYKEY[k]; if (L) return L.find(r => r.set.seed === s.seed && r.set.n === s.n) || L[0]; } return FILM; }
  const noOver = s => !Object.keys(s.over).length;
  const sameAs = (s, r) => key(s) === key(r.set) && noOver(s);
  const exactly = (s, r) => sameAs(s, r) && s.seed === r.set.seed && s.n === r.set.n;
  const filmWarSettings = s => noOver(s) && key(s) === key(FILM.set) && s.seed === FILM.set.seed;
  function runOne(s, i, H, trace) { const h = H || makeH(spec_of(s)); return war(P_of(s), rng(warSeed(s.seed, i)), trace ? { ...h, __trace: true } : h); }

  /* ---------- small helpers ---------- */
  const span = s => s < 5 ? "a few seconds" : s < 90 ? "about " + Math.round(s / 5) * 5 + " seconds" : "about " + Math.max(2, Math.round(s / 60)) + " minutes";
  const threads = () => Math.max(1, broken ? 1 : cores);
  const pct = (a, n, d) => (100 * a / Math.max(1, n)).toFixed(d) + "%", digits = n => n < SMALL ? 1 : 2;
  const foughtOf = (c, n) => n - (c[AOUT] || 0), py = c => (c[UNI] || 0) + (c[BET] || 0);
  const shareOf = (c, k, n, d) => k === AOUT ? pct(c[k] || 0, n, d) : pct(c[k] || 0, foughtOf(c, n), d);
  const realJob = () => job && !job.preview;
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "own-settings";
  const nice = v => String(+v.toFixed(v < 0.1 ? 3 : v < 1 ? 2 : 1));
  const show = (k, v) => R.odds[k].kind === "%" ? nice(100 * v) + "%" : String(+v.toFixed(3));
  const yearMonth = y => monthName((y - 1950) * 12 - 5);
  const lit = () => document.querySelectorAll(".preset.on").forEach(p => { p.classList.remove("on"); p.removeAttribute("aria-current"); });
  function toast(t, ms) { const el = $("toast"); el.textContent = t; el.className = "on"; clearTimeout(toast.t); toast.t = setTimeout(() => el.className = "", ms || 2400); }
  function setNums(vu, vp, d, animate) { /* a new draw always cancels an old count-up, so the tiles can't disagree with the rows */
    const id = ++tweenId, A = $("vUni"), B = $("vPy"), put = (a, b) => { A.textContent = a.toFixed(d) + "%"; B.textContent = b.toFixed(d) + "%"; };
    if (!animate || reduced) { put(vu, vp); return; } const a0 = parseFloat(A.textContent) || 0, b0 = parseFloat(B.textContent) || 0, t0 = performance.now();
    const go = t => { if (id !== tweenId) return; const u = Math.min(1, (t - t0) / 420), e = 1 - (1 - u) * (1 - u); put(a0 + (vu - a0) * e, b0 + (vp - b0) * e); if (u < 1) requestAnimationFrame(go); else put(vu, vp); }; requestAnimationFrame(go);
  }
  function pulse() { const a = $("answer"); a.classList.remove("pulse"); void a.offsetWidth; a.classList.add("pulse"); }
  function goTo(el) { el.scrollIntoView({ behavior: glide(), block: "start" }); }
  function toResults() { const t = $("answer").getBoundingClientRect().top; if (t < 0 || t > innerHeight * .3) goTo(narrow() ? $("answer") : $("work")); }
  function openFold(id) { const d = $(id); if (!d.open) d.open = true; setTimeout(() => goTo(d), reduced ? 0 : 280); }
  addEventListener("click", e => { if (performance.now() < quietUntil) { e.stopImmediatePropagation(); e.preventDefault(); } }, true); /* a double-click's second half must not stop a run or close a panel */

  /* ---------- reading what people type ---------- */
  const readNum = s => { const t = String(s).replace(/[,\s_]/g, "").replace(/[%×x]$/i, "").replace(/^[×x]/i, ""); if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN; const v = parseFloat(t); return isFinite(v) ? v : NaN; };
  const warsFrom = s => { const v = readNum(s); return isNaN(v) ? null : Math.max(MIN, Math.min(MAX, Math.round(v))); };
  function warsUI() { document.querySelectorAll(".chip[data-n]").forEach(c => { const on = +c.dataset.n === wars; c.classList.toggle("on", on); c.setAttribute("aria-pressed", on); }); $("wEst").textContent = fmt(wars) + " wars, " + span(wars * msPerWar / 1000 / threads()) + (threads() > 1 ? " on " + threads() + " cores" : " on one core"); $("runT").textContent = "▶ Run " + fmt(wars) + " wars"; }
  function setWars(n) { wars = n; $("nw").value = fmt(n); warsUI(); setUI(); }

  /* ---------- what the run card says about the settings ---------- */
  const COLW = { low: "Every odd against America", mid: "Middle odds", high: "Every odd for America" };
  function setUI() {
    const st = START[start], n = Object.keys(over).length;
    $("startNow").textContent = st.date + ": " + st.what;
    $("setNow").textContent = (whatif ? "What-if: " + WI[whatif].t + " · " : "") + COLW[col] + (n ? ", " + n + " changed" : "") + " · seed " + seed;
    document.querySelectorAll("#startList .tp").forEach(b => { const on = b.dataset.id === start; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  }

  /* ---------- odds ---------- */
  function countChanged() {
    const n = Object.keys(over).length; $("changedN").textContent = n ? n + " changed" : ""; $("changedN").hidden = !n;
    document.querySelectorAll("#allOdds details.grp").forEach(g => { const m = [...g.querySelectorAll(".odd2")].filter(r => over[r.dataset.k] !== undefined).length, b = g.querySelector(".gn"); b.textContent = m ? m + " changed" : ""; b.hidden = !m; });
  }
  function syncOdd(k) {
    const row = $("allOdds").querySelector('.odd2[data-k="' + k + '"]'); if (!row) return; const v = over[k] ?? base()[k], idx = ODDS[k].findIndex(x => Math.abs(x - v) < 1e-12);
    row.querySelectorAll("input[type=radio]").forEach(r => { r.checked = +r.value === idx; });
    const own = row.querySelector(".own input"); own.value = idx < 0 ? (R.odds[k].kind === "%" ? nice(100 * v) : String(+v.toFixed(4))) : ""; row.classList.toggle("moved", over[k] !== undefined); row.classList.toggle("custom", idx < 0);
  }
  function setOdd(k, v) { if (Math.abs(v - base()[k]) < 1e-12) delete over[k]; else over[k] = v; syncOdd(k); countChanged(); changed("odds"); }
  function allOdds() {
    const el = $("allOdds"), open = new Set([...el.querySelectorAll("details.grp[open]")].map(g => g.dataset.g)); el.innerHTML = "";
    for (const g of R.groups) {
      const d = document.createElement("details"); d.className = "grp"; d.dataset.g = g.id; if (open.has(g.id)) d.open = true;
      d.innerHTML = '<summary><span class="gt">' + esc(g.name) + '</span><span class="badge gn" hidden></span><small>' + g.keys.length + " odds</small></summary>";
      for (const k of g.keys) {
        const o = R.odds[k], row = document.createElement("div"); row.className = "odd2"; row.dataset.k = k; row.dataset.s = (k + " " + o.t + " " + o.why).toLowerCase();
        const names = ["Against", "Middle", "For"];
        row.innerHTML = '<div class="oh"><b id="ot-' + k + '">' + esc(o.t) + "</b>" + (o.rate ? '<span class="hy">' + esc(o.rate) + "</span>" : "") + (o.who.length ? '<span class="tm">' + esc(o.who.join(" and ")) + "'s temperament</span>" : "") + (o.moves ? '<span class="mvb">changes the answer</span>' : "") + '<code>' + k + '</code></div><small class="why">' + esc(o.why) + '</small>' +
          '<div class="seg4" role="group" aria-labelledby="ot-' + k + '">' + names.map((t, i) => '<label><input type="radio" name="o-' + k + '" value="' + i + '"><span><i>' + t + "</i>" + show(k, ODDS[k][i]) + "</span></label>").join("") +
          '<label class="own"><i>Yours</i><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="' + esc(o.t) + ': your own value' + (o.kind === "%" ? ", in percent" : "") + '" placeholder="' + (o.kind === "%" ? "%" : "#") + '"></label></div>';
        row.querySelectorAll("input[type=radio]").forEach(r => r.onchange = () => { if (r.checked) setOdd(k, ODDS[k][+r.value]); });
        const own = row.querySelector(".own input");
        own.onchange = () => {
          if (!own.value.trim()) { syncOdd(k); return; } let v = readNum(own.value); if (isNaN(v) || v < 0) { toast("Type a number, 0 or more"); syncOdd(k); return; }
          if (o.kind === "%") v /= 100; const x = Math.min(o.max, Math.max(o.min, v)); if (x !== v) toast("Capped at " + show(k, x)); setOdd(k, x);
        };
        own.onkeydown = e => { if (e.key === "Enter") own.blur(); };
        d.appendChild(row);
      }
      el.appendChild(d);
    }
    for (const k in ODDS) syncOdd(k); countChanged(); filterOdds();
  }
  function filterOdds() {
    const q = $("oddFind").value.trim().toLowerCase(); let n = 0;
    $("allOdds").querySelectorAll("details.grp").forEach(g => { let m = 0; g.querySelectorAll(".odd2").forEach(r => { const ok = !q || r.dataset.s.includes(q); r.hidden = !ok; if (ok) m++; }); g.hidden = !!q && !m; if (q && m) g.open = true; n += m; });
    $("oddN").textContent = q ? n + (n === 1 ? " odd matches" : " odds match") : ""; $("oddNone").hidden = !q || n > 0;
  }
  function seg(name, v) { document.querySelectorAll('input[name="' + name + '"]').forEach(r => { r.checked = r.value === String(v); }); }
  /* any change by hand: the panel stops claiming it's a named run, and a rough answer appears. Odds and the seed let go of a what-if */
  function changed(kind) {
    label = ""; lit(); if (kind !== "seed") whatif = ""; countChanged(); setUI(); warNote();
    if (realJob()) { job.dirty = true; $("status").textContent = "Changed. Your change counts on the next run."; return; }
    $("status").textContent = "Changed. Press Run for the full answer.";
    clearTimeout(previewTimer); previewTimer = setTimeout(() => { const s = cur(), r = refFor(s); if (exactly(s, r)) { job = null; showRef(r); return; } begin({ preview: true }); }, 380);
  }

  /* ---------- running ---------- */
  function getPool() { if (broken) return null; if (pool) return pool; try { pool = Array.from({ length: cores }, () => { const w = new Worker(R.worker); w.onmessage = e => onBlock(w, e.data); w.onerror = e => { e.preventDefault && e.preventDefault(); fallBack(e); }; return w; }); } catch (e) { fallBack(); return null; } return pool; }
  function fallBack(e) { window.KRFALL = String(e && (e.message || e.type) || "?"); if (broken) return; broken = true; if (pool) pool.forEach(w => w.terminate()); pool = null; warsUI(); if (job) { const j = job; job = null; begin({ again: j }); } }
  const merge = (a, b) => { for (const k in b) a[k] = (a[k] || 0) + b[k]; };
  const fresh = () => ({ next: 0, done: 0, c: {}, ev: {}, yr: {}, fought: 0, dead: 0, ends: 0, line: 0, last: 0, t0: performance.now() });
  function feed(w) { const j = job; if (!j || j.next >= j.n) return; const from = j.next, to = Math.min(j.n, from + j.block); j.next = to; w.postMessage({ id: j.id, P: j.P, spec: j.spec, seed: j.set.seed, from, to }); }
  function onBlock(w, d) { const j = job; if (!j || d.id !== j.id) return; merge(j.c, d.c); merge(j.ev, d.ev); merge(j.yr, d.yr); j.fought += d.fought; j.dead += d.dead; j.ends += d.ends; j.line += d.line; j.done += d.n; tick(); if (j.done >= j.n) finish(false); else feed(w); }
  function localStep() {
    const j = job; if (!j || j.local !== j.id) return; const t0 = performance.now();
    while (j.next < j.n && performance.now() - t0 < 50) { const r = war(j.P, rng(warSeed(j.set.seed, j.next++)), j.H); j.c[r.outcome] = (j.c[r.outcome] || 0) + 1; for (const e of r.ev) j.ev[e] = (j.ev[e] || 0) + 1; if (r.outcome !== AOUT) { const y = Math.floor(r.y); j.yr[y] = (j.yr[y] || 0) + 1; j.fought++; j.dead += r.usDead; j.ends += r.y; j.line += r.line; } j.done++; }
    tick(); if (j.done >= j.n) finish(false); else setTimeout(localStep, 0);
  }
  function tick() { const j = job, now = performance.now(); if (!j) return; const end = j.done >= j.n; if (!end && now - j.last < 110) return; j.last = now; const rate = j.done / Math.max(1, now - j.t0); setProgress(j.done, j.n); if (!j.preview) $("eta").textContent = end ? "" : j.done > 0 ? span((j.n - j.done) / Math.max(rate, 1e-6) / 1000) + " left" : ""; if (j.done) draw(j, j.done, false, j.ref); }
  function setProgress(i, n) { const u = 100 * i / Math.max(1, n); $("bar").style.width = u + "%"; $("dockBar").style.width = u + "%"; $("count").textContent = fmt(i) + " / " + fmt(n) + " wars"; }
  function buttons(run) {
    document.documentElement.classList.toggle("running", run); $("runT").hidden = run; $("stopT").hidden = !run; $("dockRun").textContent = run ? "■ Stop" : "▶ Run"; $("ansRun").textContent = run ? "■ Stop" : "▶ Run"; $("heroRun").textContent = run ? "Running…" : "▶ Run the film's million";
    for (const el of [$("heroRun"), $("reset"), ...document.querySelectorAll(".preset, .tp, .fwb, [data-run]")]) el.setAttribute("aria-disabled", run); /* not "disabled": the keyboard keeps its place */
  }
  function runName(s, r, preview) { if (preview) return "Rough preview"; if (label) return label; if (exactly(s, r)) return r === FILM ? R.filmName : r.name; if (sameAs(s, r)) return r === FILM ? "The film's settings" : r.name; return s.fix ? WI[s.fix].t + ", your settings" : "Your settings"; }
  const modeLine = (n, s) => fmt(n) + " wars · seed " + s.seed + " · from " + START[s.start].date;
  function begin(o = {}) {
    clearTimeout(previewTimer);
    const again = o.again, preview = again ? again.preview : !!o.preview; if (!again && !preview && realJob()) return;
    let j;
    if (again) j = job = { ...again, id: nextId++, ...fresh() };
    else {
      const s = { ...cur(), n: preview ? PREVIEW : wars }, r = refFor(s), spec = spec_of(s);
      j = job = { note: o.note || "", id: nextId++, n: s.n, set: s, P: P_of(s), spec, H: makeH(spec), ref: r, preview, label: runName(s, r, preview), exact: !preview && exactly(s, r), same: !preview && sameAs(s, r), block: Math.max(250, Math.min(2500, Math.ceil(s.n / 240))), ...fresh() };
    }
    shown = j.set;
    $("modeT").textContent = j.label; $("modeS").textContent = modeLine(j.n, j.set); $("compare").textContent = ""; $("again").classList.remove("on"); setProgress(0, j.n); refCap(j.ref);
    if (!preview) {
      quietUntil = performance.now() + 250; window.KRLAST = null; buttons(true); $("status").textContent = "Running. The numbers settle as it counts."; $("eta").textContent = ""; pulse();
      if (!again) try { if (window.goatcounter && goatcounter.count) goatcounter.count({ path: "run/" + slug(label || (start !== FILM.set.start ? "restart" : "own settings")), title: "RUN: " + (label || "own settings"), event: true }); } catch (e) { } /* counts the press and the name of the button, never the odds */
    } else $("status").textContent = (j.note ? j.note + " " : "") + "Working out a rough answer…";
    const P = getPool(); if (P) P.forEach(feed); else { j.local = j.id; localStep(); }
  }
  function finish(stopped) {
    const j = job; if (!j) return; job = null;
    if (!j.preview && !stopped && j.done > 5000) { msPerWar = (performance.now() - j.t0) * threads() / j.done; }
    $("eta").textContent = "";
    if (j.preview) { draw(j, j.done, true, j.ref); setProgress(j.done, j.n); $("status").textContent = (j.note ? j.note + " " : "") + "Rough answer from " + fmt(j.done) + " wars. Press Run to use your " + fmt(wars) + "."; $("compare").textContent = "Only " + fmt(j.done) + " wars, so small differences here can be chance."; warsUI(); return; }
    buttons(false); window.KRLAST = { i: j.done, c: j.c, ev: j.ev, yr: j.yr, fought: j.fought, dead: j.dead, ends: j.ends, line: j.line, set: j.set };
    if (stopped && !j.done) { const s = cur(), r = refFor(s); if (exactly(s, r)) showRef(r); else { draw({ c: {}, ev: {}, yr: {}, fought: 0 }, 0, false, r); setProgress(0, j.n); $("modeT").textContent = "Stopped"; } $("status").textContent = "Stopped before any war finished."; return; }
    draw(j, j.done, true, j.ref); setProgress(j.done, j.n);
    if (stopped) { lit(); $("modeT").textContent = "Stopped at " + fmt(j.done) + " of " + fmt(j.n); $("modeS").textContent = "seed " + j.set.seed + " · from " + START[j.set.start].date; }
    $("status").textContent = stopped ? "Stopped at " + fmt(j.done) + " wars. These numbers cover only those." : j.dirty ? "Done, for the settings as they were when you pressed Run. Press Run again to use your change." : "Done. The same settings, seed and number of wars give the same answer on any computer. It isn't a forecast.";
    compare(j, stopped); $("again").classList.add("on"); warsUI();
  }
  function compare(j, stopped) {
    const r = j.ref, d = digits(j.done), f = foughtOf(j.c, j.done), rf = foughtOf(r.c, r.set.n), u = pct(j.c[UNI] || 0, f, d), p = pct(py(j.c), f, d), ru = pct(r.c[UNI] || 0, rf, 2), rp = pct(py(r.c), rf, 2);
    if (j.exact && !stopped) { $("compare").textContent = r.inFilm ? "This is the film's exact run." : "This is the exact run in the How it works tables."; return; }
    if (j.same) { $("compare").textContent = "Same settings as the run behind the film's column, in a different sample of wars, so any gap from its " + ru + " unified is chance."; return; }
    $("compare").textContent = "Korea unified: " + ru + " in the film's column, " + u + " here. Pyongyang kept: " + rp + " there, " + p + " here." + (j.done < SMALL ? " With only " + fmt(j.done) + " wars, small differences can be chance." : "");
  }

  /* ---------- drawing the answer ---------- */
  function refCap(r) { $("refCap").textContent = "Film column: " + r.cap + "."; }
  const avgBits = d => d && d.fought ? [yearMonth(d.ends / d.fought), fmt(Math.round(d.dead / d.fought * 10) * 100)] : null;
  const avgLine = (d, r) => { const a = avgBits(d), b = avgBits(r); return (a ? "The wars America fights here end, on average, in " + a[0] + ", with about " + a[1] + " Americans killed" : "America fought no war here") + (b ? ". Film column: " + b[0] + ", about " + b[1] + "." : "."); };
  function draw(d, i, settled, r) {
    const c = d.c; lastCounts = c; r = r || FILM; const f = foughtOf(c, i), u = c[UNI] || 0, p = py(c), vu = 100 * u / Math.max(1, f), vp = 100 * p / Math.max(1, f), dg = digits(i);
    setNums(vu, vp, dg, settled); $("dW").textContent = vu.toFixed(dg) + "%"; $("dD").textContent = vp.toFixed(dg) + "%";
    $("nUni").textContent = fmt(u); $("nUniOf").textContent = "of " + fmt(f) + " wars America fights"; $("nPy").textContent = fmt(p); $("nPyOf").textContent = "wars";
    $("stack").innerHTML = R.outcomes.filter(o => o.fight).map(o => '<i style="width:' + (100 * (c[o.key] || 0) / Math.max(1, f)) + "%;background:" + o.col + '"></i>').join("");
    const body = $("rowsB");
    if (!body.children.length) body.innerHTML = R.outcomes.map(o => '<button class="row" type="button" data-k="' + esc(o.key) + '"><span class="sw" style="background:' + o.col + '"></span><span class="l">' + esc(o.say) + '</span><span class="n"></span><span class="p"></span><span class="r"></span><span class="go2" aria-hidden="true">›</span></button>').join("");
    body.querySelectorAll(".row").forEach(x => { if (!x.onclick) x.onclick = () => { if (x.getAttribute("aria-disabled") !== "true") readEnding(x.dataset.k, undefined, false, undefined, x); }; });
    body.querySelectorAll(".row").forEach(x => { const k = x.dataset.k, n = c[k] || 0; x.setAttribute("aria-disabled", !n); x.title = n ? "Read a war that ended this way" : "No war ended this way in this run"; x.setAttribute("aria-label", OUT[k].say + ": " + fmt(n) + " wars, " + shareOf(c, k, i, dg) + "; the film's column: " + shareOf(r.c, k, r.set.n, 2) + (n ? ". Read a war that ended this way" : "")); x.querySelector(".n").textContent = fmt(n); x.querySelector(".p").textContent = shareOf(c, k, i, dg); x.querySelector(".r").textContent = shareOf(r.c, k, r.set.n, 2); });
    refCap(r);
    $("avg").textContent = !i ? "" : avgLine(d, r);
    const ys = R.years.map(y => (d.yr && d.yr[y]) || 0), top = Math.max(1, ...ys), nf = Math.max(1, f);
    $("years").innerHTML = R.years.map((y, n) => '<span class="yc' + (R.realEnd.includes(y) ? " real" : "") + '" title="' + y + ": " + pct(ys[n], nf, 2) + ' of the wars America fights"><i style="height:' + (100 * ys[n] / top) + '%"></i><b>' + y + "</b></span>").join("");
    $("evs").innerHTML = R.events.map(([k, t, real]) => "<span>" + esc(t) + '</span><span class="p">' + pct((d.ev && d.ev[k]) || 0, i, 1) + '</span><span class="r">' + pct((r.ev && r.ev[k]) || 0, r.set.n, 1) + '</span><span class="re" aria-label="' + (real ? "happened" : "did not happen") + '">' + (real ? "✓" : "–") + "</span>").join("");
  }
  function showRef(r) {
    shown = r.set; $("modeT").textContent = r === FILM ? R.filmName : r.name; $("modeS").textContent = modeLine(r.set.n, r.set);
    setProgress(r.set.n, r.set.n); $("eta").textContent = ""; $("status").textContent = r === FILM ? "These are the film's numbers. Press Run to watch them come out again, or try a what-if." : "These are the numbers from the run behind them. Press Run to watch them come out again.";
    $("compare").textContent = r.inFilm ? "This is the film's exact run." : "This is the exact run in the How it works tables."; $("again").classList.remove("on"); draw(r, r.set.n, false, r);
  }
  function loadSettings(s) { job = null; clearTimeout(previewTimer); lit(); col = s.col; over = { ...(s.over || {}) }; whatif = s.fix || ""; start = s.start; seed = s.seed; if (s.n) setWars(s.n); seg("col", col); $("seed").value = seed; allOdds(); setUI(); warNote(); }
  function reset() { if (realJob()) return; label = ""; $("oddFind").value = ""; loadSettings(FILM.set); showRef(FILM); }

  /* ---------- turning points, what-ifs, the film's wars ---------- */
  function startList() {
    const el = $("startList"); el.innerHTML = "";
    for (const st of R.starts) {
      if (!st.list) continue;
      const r = RUNS[st.ref], f = foughtOf(r.c, r.set.n), b = document.createElement("button"); b.type = "button"; b.className = "tp"; b.dataset.id = st.id;
      b.innerHTML = '<span class="tt">' + esc(st.date) + (st.gauge ? ' <em class="gtag">the film\'s gauge</em>' : "") + '</span><span class="td">' + esc(st.what) + '</span><span class="tn"><b class="nu">' + pct(r.c[UNI] || 0, f, 2) + '</b><b class="npk">' + pct(py(r.c), f, 2) + "</b></span>";
      b.onclick = () => pickStart(st.id); el.appendChild(b);
    }
  }
  function pickStart(id) {
    if (realJob()) { toast("Stop the run first, or wait for it to finish"); return; } job = null; clearTimeout(previewTimer); const st = START[id], r = RUNS[st.ref];
    start = id; whatif = ""; label = ""; lit(); over = {}; col = "mid"; seg("col", col); allOdds(); seed = r.set.seed; $("seed").value = seed; setWars(r.set.n); setUI(); warNote();
    const s = cur(), ref = refFor(s); toResults();
    if (exactly(s, ref)) { showRef(ref); return; }
    $("status").textContent = "Restarted from " + st.date + " with your settings."; begin({ preview: true });
  }
  function presets() {
    const el = $("presets"); el.innerHTML = "";
    R.whatifs.forEach(w => {
      if (w.head) { const h = document.createElement("p"); h.className = "wih"; h.textContent = w.head; el.appendChild(h); }
      const r = RUNS[w.ref], f = foughtOf(r.c, r.set.n), b = document.createElement("button"); b.type = "button"; b.className = "preset"; b.dataset.id = w.id;
      b.innerHTML = '<span class="t">' + esc(w.t) + '</span><span class="d">' + esc(w.d) + '</span><span class="wn"><b class="nu">' + pct(r.c[UNI] || 0, f, 2) + '</b> unified · <b class="npk">' + pct(py(r.c), f, 2) + "</b> Pyongyang kept</span>" + (w.film ? '<span class="fl">In the film: ' + esc(w.film.map(([a, v]) => a + " " + v).join(" · ")) + "</span>" : "");
      b.onclick = () => { if (realJob()) { toast("Stop the run first, or wait for it to finish"); return; } loadSettings({ ...r.set, over: {} }); label = w.t; b.classList.add("on"); b.setAttribute("aria-current", "true"); toResults(); begin(); };
      el.appendChild(b);
    });
  }
  function filmWars() {
    const el = $("filmWars"); el.innerHTML = "";
    for (const fw of R.filmWars) {
      if (fw.head) { const h = document.createElement("p"); h.className = "wih"; h.textContent = fw.head; el.appendChild(h); }
      const b = document.createElement("button"); b.type = "button"; b.className = "fwb";
      b.innerHTML = '<span class="fn">War ' + fmt(fw.n) + '</span><span class="ft">' + esc(fw.t) + '</span><span class="fd">' + esc(fw.d) + "</span>";
      b.onclick = () => { if (realJob()) { toast("Stop the run first, or wait for it to finish"); return; } const back = b; loadSettings({ ...fw.set, n: 0 }); const s = cur(), r = refFor(s); if (exactly(s, r)) showRef(r); else begin({ preview: true }); $("warN").value = fmt(fw.n); reader = { mode: "number", set: s, i: fw.n }; $("drMore").textContent = "Show the next war"; fillWar(fw.n, runOne(s, fw.n, null, true), fw.k, s); openDrawer(back); };
      el.appendChild(b);
    }
  }

  /* ---------- reading one war, in a side panel ---------- */
  function warNote(s) {
    s = s || cur(); const t = filmWarSettings(s) ? "" : "These aren't the film's settings, so a war number here isn't the film's war of that number. Back to the film's settings brings the film's wars back.";
    $("warNote").textContent = t; $("warNote").hidden = !t; return t;
  }
  const ROAD = r => r.outcome === AOUT ? "America never comes" : (r.chinaIn ? "China in" : "China out") + ", the UN " + ({ "38": "stops at the 38th", neck: "stops at the neck", yalu: "drives for the Yalu", chongchon: "digs in on the Ch'ongch'on", kansas: "stops at the 38th, then fights" }[r.stopAt] || "never gets north");
  function headline(i, r) {
    const n = "War " + fmt(i) + ": ", m = monthName(r.t), ln = r.line.toFixed(2) + "°N";
    switch (r.outcome) {
      case UNI: return n + "Korea is unified, " + m + ".";
      case BET: return n + "a better peace, the line on the neck at " + ln + ", " + m + ".";
      case O_DRAW: return n + "a draw near the 38th, the line at " + ln + ", " + m + ".";
      case O_WORSE: return n + "a worse peace, the line at " + ln + ", " + m + ".";
      case O_LOSS: return n + "a loss: the UN leaves Korea, " + m + ".";
      case O_WIDER: return n + "a wider war: " + (r.wider || "the Soviets enter openly") + ", " + m + ".";
      case AOUT: return n + "America stays out, and the South falls, " + m + ".";
    } return n + r.outcome;
  }
  function mood(tmp, s) { const sd = P_of(s).temperSd || 1e-9; return ["T", "M", "C", "S"].map(k => { const z = tmp[k], a = Math.abs(z / sd), w = a < 0.33 ? "about average" : (a < 0.75 ? "" : "much ") + (z < 0 ? "calmer" : "bolder") + " than most"; return { T: "Truman", M: "MacArthur", C: "Mao", S: "Stalin" }[k] + " " + w; }).join("; "); }
  function setLine(s) { return START[s.start].date + ": " + START[s.start].what + " · " + COLW[s.col].toLowerCase() + (noOver(s) ? "" : ", " + Object.keys(s.over).length + " changed") + (s.fix ? " · what-if: " + WI[s.fix].t : "") + " · seed " + s.seed; }
  function lineChart(r, t0, i) { /* the front month by month (the model's own trace), against the 38th, the neck and the Yalu */
    const T = [[0, R.lat.p38]].concat((r.trace || []).map(x => [x[0], x[1]])); if (T.length < 3) return "";   /* the war starts on the 38th, 25 June 1950 */
    const W = Math.max(300, Math.min(640, ($("drBody").clientWidth || Math.min(innerWidth, 560) - 40) - 4)), Hh = W < 420 ? 170 : 190,   /* one unit = one screen pixel, so the labels stay readable on a phone */ L = R.lat, y0 = L.pusan - 0.3, y1 = L.yalu + 0.25, x = m => 44 + (W - 54) * m / 66, y = v => 12 + (Hh - 34) * (1 - (v - y0) / (y1 - y0));
    const pts = T.map(([m, v]) => x(m).toFixed(1) + "," + y(v).toFixed(1)).join(" "), ref = [[L.yalu, "Yalu"], [L.neck, "Neck"], [L.p38, "38th"], [L.pusan, "Pusan"]];
    return '<p class="lch">The front, month by month</p><svg class="lc" viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="The front line of war ' + fmt(i) + ' month by month">' +
      ref.map(([v, n]) => '<line x1="44" x2="' + (W - 10) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" class="g"/><text x="40" y="' + (y(v) + 4).toFixed(1) + '" class="gl">' + n + "</text>").join("") +
      [1950, 1951, 1952, 1953, 1954, 1955].map(Y => { const m = Math.max(0, (Y - 1950) * 12 - 5); return '<text x="' + x(m).toFixed(1) + '" y="' + (Hh - 6) + '" class="yl">' + Y + "</text>"; }).join("") +
      (t0 ? '<rect x="44" y="8" width="' + (x(t0) - 44).toFixed(1) + '" height="' + (Hh - 30) + '" class="rh"/>' : "") + '<polyline points="' + pts + '" class="ln"/><circle cx="' + x(T[T.length - 1][0]).toFixed(1) + '" cy="' + y(T[T.length - 1][1]).toFixed(1) + '" r="5" class="end"/></svg>';
  }
  function fillWar(i, r, kicker, s) {
    const o = OUT[r.outcome] || { say: r.outcome, col: "#888" }, t0 = START[s.start].t; $("drK").textContent = kicker; $("warHead").textContent = headline(i, r); warNote(s);
    const facts = [['<span class="sw" style="background:' + o.col + '"></span>' + esc(o.say), ""], ["The road", ROAD(r)], ["It ends", monthName(r.t)], ["The line at the end", r.outcome === AOUT ? "none: America never fought" : r.line.toFixed(2) + "°N (the 38th is 38.00, the neck 39.19, the Yalu 40.60)"], ["Americans killed", r.outcome === AOUT ? "none: America never fights" : "about " + fmt(Math.round(r.usDead * 10) * 100)], ["The leaders", mood(r.temper, s)], ["Settings", setLine(s)]];
    if (t0) facts.splice(1, 0, ["Real history", "replayed exactly up to " + START[s.start].date + ", then the model runs free"]);
    $("warSum").innerHTML = facts.map(([a, b]) => b ? "<dt>" + a + "</dt><dd>" + esc(b) + "</dd>" : '<dt class="oc">' + a + "</dt><dd></dd>").join("");
    $("warLine").innerHTML = lineChart(r, t0, i);
    const groups = []; for (const line of r.path) { const m = /^(\w{3}) (\d{4}): ([\s\S]*)$/.exec(line), y = m ? m[2] : "", g = groups[groups.length - 1], item = '<li><span class="mo">' + (m ? m[1] : "") + "</span> " + esc(m ? m[3] : line) + "</li>"; if (g && g.y === y) g.items.push(item); else groups.push({ y, items: [item] }); }
    $("warPath").innerHTML = groups.map(g => '<li class="yr"><b>' + g.y + "</b><ol>" + g.items.join("") + "</ol></li>").join("") || "<li>Nothing happened that the model writes down.</li>";
    let freeSaid = !t0; const evs = [];
    for (const e of r.ev) { const q = r.mq[e], real = t0 && q < t0; if (!real && !freeSaid) { freeSaid = true; evs.push('<li class="free">' + esc(START[s.start].date) + ": from here the model runs free</li>"); } evs.push("<li" + (real ? ' class="rh"' : "") + '><span class="mo">' + monthName(q) + "</span> " + esc(e) + "</li>"); }
    $("warEv").innerHTML = evs.join(""); $("evFold").open = false;
    window.KRWAR = { i, n: i, outcome: r.outcome, path: r.path, ev: r.ev, y: r.y, t: r.t, line: r.line, usDead: r.usDead, head: $("warHead").textContent }; $("drBody").scrollTop = 0;
    if (reader) { reader.i = i; reader.set = s; }
  }
  const behind = () => [document.querySelector(".bar"), ...document.querySelectorAll(".tabp"), document.querySelector("footer"), $("dock")];
  function openDrawer(back) { const d = $("drawer"); if (reader) reader.back = reader.back || back; if (!d.hidden) return; d.hidden = false; requestAnimationFrame(() => d.classList.add("on")); document.documentElement.classList.add("lock"); behind().forEach(e => e.inert = true); quietUntil = performance.now() + 250; $("drClose").focus(); }
  function closeDrawer() { scanId++; const d = $("drawer"); if (d.hidden) return; d.classList.remove("on"); document.documentElement.classList.remove("lock"); behind().forEach(e => e.inert = false); setTimeout(() => { if (!d.classList.contains("on")) d.hidden = true; }, reduced ? 0 : 240); if (reader && reader.back && reader.back.focus && document.contains(reader.back)) reader.back.focus({ preventScroll: true }); }
  function oneWar() {
    const raw = $("warN").value, v = readNum(raw); if (!String(raw).trim() || isNaN(v) || v < 0 || v > MAX - 1 || v !== Math.floor(v)) { toast("Type a whole war number from 0 to " + fmt(MAX - 1)); return; } const n = v, s = cur(); $("warN").value = fmt(n);
    const back = reader && !$("drawer").hidden ? reader.back : $("warGo"); reader = { mode: "number", back }; $("drMore").textContent = "Show the next war"; fillWar(n, runOne(s, n, null, true), "One war", s); openDrawer($("warGo"));
  }
  function randomWar() { const s = cur(), i = Math.floor(Math.random() * Math.max(s.n, FILM.set.n)), back = reader && !$("drawer").hidden ? reader.back : $("warRand"); $("warN").value = fmt(i); reader = { mode: "random", back }; $("drMore").textContent = "Show another random war"; fillWar(i, runOne(s, i, null, true), "A random war", s); openDrawer($("warRand")); }
  function readEnding(k, from, keep, kicker, backEl) {
    const s = shown, n = Math.max(1, Math.min(s.n, MAX)), my = ++scanId, H = makeH(spec_of(s)), o = OUT[k], t0 = performance.now();
    if (!(lastCounts[k] > 0)) { toast(k === UNI ? "No war in this run ended with Korea unified" : "No war in this run ended this way"); return; }
    const back = keep && reader ? reader.back : backEl || document.activeElement; let i = from === undefined ? 0 : from % n, seen = 0, slow = false;
    const step = () => {
      if (my !== scanId) return; const t1 = performance.now();
      while (seen < n && performance.now() - t1 < 40) { if (i >= n) i = 0; const r = runOne(s, i, H); if (r.outcome === k) { if (slow) $("toast").className = ""; reader = { mode: "ending", key: k, kicker, back }; $("drMore").textContent = k === UNI && kicker ? "Show another unified Korea" : "Another war like this"; fillWar(i, runOne(s, i, H, true), kicker || o.say, s); openDrawer(back); return; } i++; seen++; }
      if (seen >= n) { toast("None found in this run"); return; }
      if (!slow && performance.now() - t0 > 300) { slow = true; toast("Looking through the run…", 60000); }
      setTimeout(step, 0);
    };
    step();
  }
  function randomWin() { if (!(lastCounts[UNI] > 0)) { toast("No war in the run on screen ended with Korea unified. Try other settings."); return; } readEnding(UNI, Math.floor(Math.random() * shown.n), false, "A unified Korea", $("warWin")); }
  function warLink(s, i) { const q = new URLSearchParams({ col: s.col, seed: s.seed, n: s.n || wars, s: s.start }); if (s.fix) q.set("w", s.fix); if (!noOver(s)) q.set("o", JSON.stringify(s.over)); if (i !== undefined) q.set("war", i); return location.href.split("#")[0].split("?")[0] + "?" + q + (i !== undefined ? "#one" : "#odds"); }
  async function copy(url, what) { try { await navigator.clipboard.writeText(url); toast(what + " copied"); } catch (e) { prompt("Copy this link:", url); } }

  /* ---------- tabs, links, the back button ---------- */
  const TAB_OF = R.tabOf, TITLES = { sim: "Simulator", how: "How it works", every: "Every odd", sources: "Sources" }; let tabNow = "";
  function ink() { const a = document.querySelector(".tabs a.on"), i = $("ink"); if (!a) return; i.style.width = a.offsetWidth + "px"; i.style.transform = "translateX(" + a.offsetLeft + "px)"; }
  function setTab(t) { if (t === tabNow) return false; tabNow = t; document.querySelectorAll(".tabp").forEach(p => { p.hidden = p.dataset.tab !== t; }); document.querySelectorAll(".tabs a").forEach(a => { const on = a.getAttribute("href") === "#" + t; a.classList.toggle("on", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); document.documentElement.dataset.tab = t; document.title = TITLES[t] + " · " + R.short + " · RealityMargin"; ink(); return true; }
  function route(first) {
    closeDrawer();
    let raw = ""; try { raw = decodeURIComponent(location.hash.slice(1)); } catch (e) { }
    const el = raw ? $(raw) : null, page = el && el.closest ? el.closest(".tabp") : null;   /* a tab, a fold, one odd (k-, m-, e-): anything with an id inside a tab */
    const id = TAB_OF[raw] || page ? raw : "sim", tab = TAB_OF[id] || page.dataset.tab, moved = setTab(tab), t = id !== tab ? $(id) : null;
    if (t) { let opened = false; for (let e = t; e; e = e.parentElement) if (e.tagName === "DETAILS" && !e.open) { e.open = true; opened = true; } setTimeout(() => goTo(t), opened && !reduced ? 280 : 30); }
    else if (moved && !first) scrollTo({ top: 0, behavior: "auto" });
  }

  /* ---------- search every odd ---------- */
  function searchOdds() {
    const q = $("find").value.trim().toLowerCase(), folds = document.querySelectorAll("#srcFolds details.fold"); let total = 0;
    folds.forEach(f => { const items = f.querySelectorAll("tr[id], .in li"); let n = 0; items.forEach(it => { const m = !q || it.textContent.toLowerCase().includes(q); it.hidden = !m; if (m) n++; }); total += n; f.hidden = !!q && !n; f.open = !!q && n > 0; const c = f.querySelector("summary small"); if (c) c.textContent = q ? n + (n === 1 ? " match" : " matches") : c.dataset.h; });
    $("findN").textContent = q ? total + (total === 1 ? " match" : " matches") : ""; $("findNone").hidden = !q || total > 0;
  }

  /* ---------- wiring ---------- */
  const runOrStop = () => { if (realJob()) { finish(true); return; } job = null; toResults(); begin(); };
  for (const id of ["run", "dockRun", "ansRun"]) $(id).onclick = runOrStop;
  $("heroRun").onclick = () => { if (realJob()) { toast("A run is going: press Stop first"); return; } label = ""; $("oddFind").value = ""; filterOdds(); loadSettings(FILM.set); label = R.filmName; toResults(); begin(); };
  $("reset").onclick = () => { if (!realJob()) { reset(); toast("Back to the film's settings"); } else toast("Stop the run first, or wait for it to finish"); };
  $("again").onclick = () => openFold("odds"); $("startEdit").onclick = () => openFold("start");
  document.querySelectorAll('input[name="col"]').forEach(r => r.onchange = () => { if (!r.checked) return; col = r.value; over = {}; allOdds(); changed("odds"); });
  $("seed").onchange = () => { const v = readNum($("seed").value); if (isNaN(v) || v < 0 || v > MAXSEED || v !== Math.floor(v)) { toast("A seed is a whole number from 0 to 4,294,967,295"); $("seed").value = seed; return; } if (v === seed) { $("seed").value = seed; return; } seed = v; $("seed").value = seed; changed("seed"); };
  $("seed").onkeydown = e => { if (e.key === "Enter") $("seed").blur(); };
  $("nw").oninput = () => { const n = warsFrom($("nw").value); if (n !== null) { wars = n; warsUI(); } };
  $("nw").onchange = () => { const n = warsFrom($("nw").value); if (n === null) { toast("Type a number of wars"); $("nw").value = fmt(wars); warsUI(); return; } if (n !== readNum($("nw").value)) toast(n === MAX ? "Capped at " + fmt(MAX) : n === MIN ? "At least " + fmt(MIN) : "Rounded to " + fmt(n)); setWars(n); };
  $("nw").onkeydown = e => { if (e.key === "Enter" && !realJob()) { const n = warsFrom($("nw").value); if (n !== null) { setWars(n); runOrStop(); } } };
  document.querySelectorAll(".chip[data-n]").forEach(c => c.onclick = () => setWars(+c.dataset.n));
  $("warGo").onclick = oneWar; $("warWin").onclick = randomWin; $("warRand").onclick = randomWar; $("warN").onkeydown = e => { if (e.key === "Enter") oneWar(); };
  $("drClose").onclick = closeDrawer; $("drShade").onclick = closeDrawer;
  $("drMore").onclick = () => { if (!reader) return; if (reader.mode === "ending") { if (reader.kicker) readEnding(reader.key, Math.floor(Math.random() * shown.n), true, reader.kicker); else readEnding(reader.key, reader.i + 1, true); } else if (reader.mode === "number") { const i = reader.i + 1; if (i >= MAX) return; $("warN").value = fmt(i); fillWar(i, runOne(reader.set, i, null, true), "One war", reader.set); } else randomWar(); };
  $("drLink").onclick = () => { if (reader && reader.set) copy(warLink(reader.set, reader.i), "A link to this war"); };
  addEventListener("keydown", e => { if (e.key === "Escape" && !$("drawer").hidden) closeDrawer(); if (e.key === "Tab" && !$("drawer").hidden) { const f = [...$("drawer").querySelectorAll("button:not([tabindex='-1']), summary")].filter(b => b.offsetParent), a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } });
  $("share").onclick = () => copy(warLink({ ...cur() }), "A link to these settings");
  $("oddFind").oninput = filterOdds;
  $("find").oninput = searchOdds; document.querySelectorAll("#srcFolds summary small").forEach(c => { c.dataset.h = c.textContent; });
  addEventListener("hashchange", () => route(false)); addEventListener("resize", ink); if (document.fonts && document.fonts.ready) document.fonts.ready.then(ink);
  document.addEventListener("click", e => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (a && a.getAttribute("href") === location.hash) route(false); }); /* a link to where you already are still takes you there */
  document.querySelectorAll('a[href^="http"]').forEach(a => { a.target = "_blank"; a.rel = "noopener"; });
  /* "Run it" beside each question: the simulator, that what-if, at once */
  document.querySelectorAll("[data-run]").forEach(b => b.onclick = () => { const id = b.dataset.run, p = [...document.querySelectorAll(".preset")].find(x => x.dataset.id === id); if (!p) return; if (realJob()) { toast("Stop the run first, or wait for it to finish"); return; } location.hash = "#whatif"; setTimeout(() => p.click(), 60); });

  /* a shared link brings its settings, and says so if it can't */
  let shared = null, openWar = null;
  if (qs.has("col") || qs.has("s") || qs.has("war")) {
    try {
      const c0 = qs.get("col") || "mid", s0 = qs.get("s") || FILM.set.start, w0 = qs.get("w") || "", o = JSON.parse(qs.get("o") || "{}");
      if (!["low", "mid", "high"].includes(c0) || !START[s0] || (w0 && !WI[w0]) || !o || typeof o !== "object" || Array.isArray(o)) throw 0;
      const clean = {}; for (const k in o) if (k in ODDS && typeof o[k] === "number" && isFinite(o[k]) && o[k] >= 0) { const v = Math.min(R.odds[k].max, Math.max(R.odds[k].min, o[k])); if (Math.abs(v - oddsFor(c0)[k]) > 1e-12) clean[k] = v; }
      const sd = readNum(qs.get("seed") || R.seed), n0 = warsFrom(qs.get("n") || "") || FILM.set.n;
      col = c0; start = s0; whatif = w0; over = clean; seed = isNaN(sd) || sd < 0 || sd > MAXSEED || sd !== Math.floor(sd) ? R.seed : sd; wars = n0; shared = "ok";
      if (qs.has("war")) { const v = readNum(qs.get("war")); if (!isNaN(v) && v >= 0 && v <= MAX - 1 && v === Math.floor(v)) openWar = v; }
    } catch (e) { shared = "bad"; }
  }
  seg("col", col); $("seed").value = seed; setWars(wars); startList(); presets(); filmWars(); allOdds(); setUI(); warNote(); $("warN").value = fmt(R.defaultWar);
  { const s = cur(), r = refFor(s); if (shared === "ok" && !exactly(s, r)) { showRef(FILM); begin({ preview: true, note: "Shared settings loaded." }); } else showRef(shared === "ok" ? r : FILM); }
  if (shared === "bad") $("status").textContent = "That link's settings couldn't be read, so these are the film's numbers.";
  else if (shared === "ok" && Object.keys(over).length) $("odds").open = true;
  route(true);
  if (openWar !== null) { const s = cur(); $("warN").value = fmt(openWar); reader = { mode: "number" }; $("drMore").textContent = "Show the next war"; fillWar(openWar, runOne(s, openWar, null, true), "One war", s); $("one").open = true; openDrawer($("warGo")); }
  requestAnimationFrame(() => document.documentElement.classList.add("ready"));
})();
