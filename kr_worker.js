// RealityMargin · Korea sim page: one worker runs a block of wars and sends the counts back. Each war's dice depend only on the seed and its number, so the order of the blocks can't change the answer.
// The builder writes the model's fingerprinted address in place of MODEL_URL, so a saved old copy of the page can't mix with a new model.
importScripts('model/sim_web.js?v=6423dd4eb9');
const makeH = s => s.t ? realUntil(s.t, s.x || {}) : { ...(s.x || {}) };
onmessage = e => {
  const { id, P, spec, seed, from, to } = e.data, c = {}, ev = {}, yr = {}, bump = (o, k) => { o[k] = (o[k] || 0) + 1; }; let fought = 0, dead = 0, ends = 0, line = 0;
  const H = makeH(spec);   /* a what-if that changes the economy carries it inside H (__econ), as the film's runs do: nothing global is touched */
  for (let i = from; i < to; i++) {
    const r = war(P, rng(warSeed(seed, i)), H);
    bump(c, r.outcome); for (const k of r.ev) bump(ev, k);
    if (r.outcome !== O_OUT) { fought++; dead += r.usDead; ends += r.y; line += r.line; bump(yr, Math.floor(r.y)); }
  }
  postMessage({ id, n: to - from, c, ev, yr, fought, dead, ends, line });
};
