// The film's rows (cold read 2, findings 3-4): forced rows restarted FROM THEIR OWN DATE (the real state up to that date, one choice forced, everything after it free),
// beside the same restart unforced (the gauge), and "Pyongyang kept" (UNIFIED + BETTER PEACE) for every row. Adds the section "Film rows (from-date)" to RESULTS_v3.md
// and the block `filmRows` to results_v3.json.   node film_rows.mjs   (run.mjs calls it at the end). 100,000 wars a row (seed 7 for the from-date rows; seed 5 for the
// from-25-June rows, the same wars as RESULTS' forced table). At most 3 worker threads.
import fs from 'node:fs'; import os from 'node:os';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { batch, war, rng, warSeed, oddsFor, O_WIN, O_BETTER, O_DRAW, O_WIDER, FIGHTS, monthName } from './sim.mjs';
import { realUntil, REAL_FORKS } from './real_path.mjs';

const N = +(process.env.FILM_N || 100000), NW = Math.min(3, Math.max(1, os.cpus().length - 1));
const ALL_FROM_ONJONG = Object.fromEntries(['onjong', 'unsan', 'airSup', 'chongchon', 'winterLine', 'neckHold', 'chosin', 'hungnam', 'thirdPhase', 'twinTunnels', 'hoengsong', 'chipyongni', 'wonju', 'killerRipper', 'spring1', 'spring2', 'counter51', 'tongchon', 'pushNeck', 'ridges', 'commando', 'blackThursday', 'outposts', 'kumsong', 'unOff', 'pvaOff', 'kpaReturn', 'rokOnjong', 'rokNorth', 'toYalu'].map(b => ['win_' + b, 'UN']));
const ALL_FROM_CHONGCHON = Object.fromEntries(Object.entries(ALL_FROM_ONJONG).filter(([k]) => !['win_onjong', 'win_unsan', 'win_airSup'].includes(k)));   // after 24 Nov, Onjong, Unsan and the air battle are already history
const STOP38_ALL = { heedPanikkar: false, crossAnyway: false, crossWinter: false, rokStopped: true }, ROK38 = { heedPanikkar: false, crossAnyway: false, crossWinter: false, rokStopped: false };
// [key, label, restart time t (months from 1 June 1950), forced choice]
export const FROM_DATE = [
  ['A12_BASE', 'about 30 Sep 1950, unforced (the gauge)', 3.95, {}],
  ['A12_STOP38_ALL', 'about 30 Sep 1950: everyone stops at the 38th, the ROK too', 3.95, STOP38_ALL],
  ['A33_BASE', 'early Oct 1950, before China\'s 13 Oct roll, unforced', 4.0, {}],
  ['A33_ROK38', 'early Oct 1950: American troops stay at the 38th, only the ROK goes north (Zhou\'s condition)', 4.0, ROK38],
  ['A22_BASE', 'mid-Nov 1950, after Unsan, unforced', 5.3, {}],
  ['A22_DIGIN', 'mid-Nov 1950: the UN reads Unsan right and digs in (the model\'s dig-in is on the Ch\'ongch\'on, just north of the neck)', 5.3, { readsUnsan: true, digIn: true }],
  ['A34_BASE', '24 Nov 1950, unforced', 5.75, {}],
  ['A34_CHONGCHON_WON', '24 Nov 1950: the Ch\'ongch\'on won', 5.75, { win_chongchon: 'UN' }],
  ['A34_CHONGCHON_LOST', '24 Nov 1950: the Ch\'ongch\'on lost', 5.75, { win_chongchon: 'EN' }],
  ['A27_ALLBATTLES', '24 Nov 1950: every battle from the Ch\'ongch\'on on won (Onjong and Unsan already fought as they were)', 5.75, ALL_FROM_CHONGCHON],
  ['A29_BASE', 'late Nov / Dec 1950, unforced', 6.0, {}],
  ['A29_ATOMIC', 'late Nov / Dec 1950: atomic bombs in the winter crisis', 6.0, { nukeWinter: true }],
  ['A32_BASE', 'about 11 Apr 1951, unforced', 10.25, {}],
  ['A32_MAC', 'about 11 Apr 1951: MacArthur kept, the war carried to China', 10.25, { macArthurKept: true, 'escalationStopped:mac': false }],
];
// the same choices from 25 June 1950 with everything else free (RESULTS' forced table, the same wars)
export const FROM_JUNE = [
  ['JUNE_BASE', 'from 25 June, unforced (the headline)', {}],
  ['JUNE_ROK38', 'from 25 June: the UN stops at the 38th, the ROK goes north', ROK38],
  ['JUNE_STOP38_ALL', 'from 25 June: everyone stops at the 38th', STOP38_ALL],
  ['JUNE_NECK', 'from 25 June: stop at the narrow neck', { heedPanikkar: false, crossAnyway: true, crossWinter: true, haltNeck: true }],
  ['JUNE_REAL', 'from 25 June: the real drive to the Yalu', { heedPanikkar: false, crossAnyway: true, crossWinter: true, haltNeck: false }],
  ['JUNE_CHINA_ANYWAY', 'from 25 June: China enters whatever the UN does', { chinaYalu: true, china38: true, chinaNeck: true, chinaAssured: true }],
  ['JUNE_CHONGCHON_WON', 'from 25 June, every fork real: the Ch\'ongch\'on won', { ...REAL_FORKS, win_chongchon: 'UN' }],
  ['JUNE_CHONGCHON_LOST', 'from 25 June, every fork real: the Ch\'ongch\'on lost', { ...REAL_FORKS, win_chongchon: 'EN' }],
  ['JUNE_ALLBATTLES', 'from 25 June, every fork real: every battle from Onjong on won', { ...REAL_FORKS, ...ALL_FROM_ONJONG }],
  ['JUNE_ATOMIC', 'from 25 June: atomic bombs in the winter crisis (if it comes)', { nukeWinter: true }],
  ['JUNE_MAC', 'from 25 June: MacArthur kept', { macArthurKept: true, 'escalationStopped:mac': false }],
];
if (!isMainThread) parentPort.on('message', ({ mid, H, seed }) => { const b = batch('mid', N, seed, H); parentPort.postMessage({ mid, r: { n: b.n, fight: b.fight, outcomes: b.outcomes, deadMean: b.deadMean, endMean: b.endMean } }); });
async function pool(tasks) { const res = []; let next = 0, done = 0; await new Promise((ok, no) => { const ws = []; for (let w = 0; w < NW; w++) { const wk = new Worker(new URL(import.meta.url)); ws.push(wk);
  const feed = () => { if (next < tasks.length) { const mid = next++; wk.postMessage({ mid, ...tasks[mid] }); } }; wk.on('message', m => { res[m.mid] = m.r; if (++done === tasks.length) { ws.forEach(x => x.terminate()); ok(); } else feed(); }); wk.on('error', no); feed(); } }); return res; }
const sh = (r, ...o) => +(100 * o.reduce((s, k) => s + (r.outcomes[k] || 0), 0) / Math.max(1, r.fight)).toFixed(2);

export async function addFilmRows() {
  const tasks = [...FROM_DATE.map(([, , t, F]) => ({ H: { ...realUntil(t), ...F }, seed: 7 })), ...FROM_JUNE.map(([, , F]) => ({ H: F, seed: 5 }))];
  const res = await pool(tasks), R = {}; FROM_DATE.forEach(([k], i) => R[k] = res[i]); FROM_JUNE.forEach(([k], i) => R[k] = res[FROM_DATE.length + i]);
  // the hero candidates: America believes the warning halfway (heeded, but the neck rather than the 38th), stops at the waist with assurances to Peking, China comes in anyway,
  // attacks the line in spring 1951 (story months 9-12) and the line holds. Searched in the main run's wars (seed 19500625)
  const hero = [], PM = oddsFor('mid'); for (let i = 0; i < 400000 && hero.length < 12; i++) { const r = war(PM, rng(warSeed(19500625, i)));
    if (!(r.rolls.heedPanikkar && r.rolls.stop38IfHeeded === false && r.rolls.neckIfHeeded && r.rolls.chinaAssured)) continue;
    const spring = Object.entries(r.btl).filter(([k]) => k.startsWith('neckHold@') && r.bq[k] - r.lag >= 9 && r.bq[k] - r.lag < 13); if (!spring.length || spring.some(([, v]) => v !== 'UN')) continue;
    hero.push({ war: i, outcome: r.outcome, line: +r.line.toFixed(2), ends: monthName(r.t), springBattles: spring.map(([k]) => monthName(r.bq[k])).join(', '), path: r.path }); }
  const F = {
    UNIFIED_PCT: sh(R.JUNE_BASE, O_WIN), T0_UNIFIED: sh(R.JUNE_BASE, O_WIN), T38_UNIFIED: sh(R.A12_BASE, O_WIN), TWAKE_UNIFIED: null,
    STOP38_ALL_UNIFIED: sh(R.A12_STOP38_ALL, O_WIN), STOP38_ALL_PY: sh(R.A12_STOP38_ALL, O_WIN, O_BETTER), STOP38_ALL_USDEAD: +R.A12_STOP38_ALL.deadMean.toFixed(1), BASE_USDEAD: +R.A12_BASE.deadMean.toFixed(1),
    ROK38_UNIFIED: sh(R.A33_ROK38, O_WIN), ROK38_PY: sh(R.A33_ROK38, O_WIN, O_BETTER), ROK38_UNIFIED_FROM_JUNE: sh(R.JUNE_ROK38, O_WIN), ROK38_PY_FROM_JUNE: sh(R.JUNE_ROK38, O_WIN, O_BETTER),
    DIGIN_NECK_PY: sh(R.A22_DIGIN, O_WIN, O_BETTER), DIGIN_BASE_PY: sh(R.A22_BASE, O_WIN, O_BETTER),
    CHONGCHON_WON_PY: sh(R.A34_CHONGCHON_WON, O_WIN, O_BETTER), CHONGCHON_LOST_PY: sh(R.A34_CHONGCHON_LOST, O_WIN, O_BETTER), CHONGCHON_WON_PY_FROM_JUNE: sh(R.JUNE_CHONGCHON_WON, O_WIN, O_BETTER), CHONGCHON_LOST_PY_FROM_JUNE: sh(R.JUNE_CHONGCHON_LOST, O_WIN, O_BETTER),
    ALLBATTLES_UNIFIED: sh(R.A27_ALLBATTLES, O_WIN), ALLBATTLES_PY: sh(R.A27_ALLBATTLES, O_WIN, O_BETTER), ALLBATTLES_UNIFIED_FROM_JUNE: sh(R.JUNE_ALLBATTLES, O_WIN), ALLBATTLES_PY_FROM_JUNE: sh(R.JUNE_ALLBATTLES, O_WIN, O_BETTER),
    ATOMIC_DRAW: sh(R.A29_ATOMIC, O_DRAW), ATOMIC_WIDER: sh(R.A29_ATOMIC, O_WIDER), ATOMIC_DRAW_FROM_JUNE: sh(R.JUNE_ATOMIC, O_DRAW), ATOMIC_WIDER_FROM_JUNE: sh(R.JUNE_ATOMIC, O_WIDER),
    MAC_UNIFIED: sh(R.A32_MAC, O_WIN), MAC_WIDER: sh(R.A32_MAC, O_WIDER), MAC_UNIFIED_FROM_JUNE: sh(R.JUNE_MAC, O_WIN), MAC_WIDER_FROM_JUNE: sh(R.JUNE_MAC, O_WIDER),
    NECK_PY: sh(R.JUNE_NECK, O_WIN, O_BETTER), REAL_PY: sh(R.JUNE_REAL, O_WIN, O_BETTER), CHINA_ANYWAY_UNIFIED: sh(R.JUNE_CHINA_ANYWAY, O_WIN),
    HERO_N: hero.map(h => h.war) };
  { const w = batch('mid', N, 7, realUntil(4.48)); F.TWAKE_UNIFIED = +(100 * (w.outcomes[O_WIN] || 0) / w.fight).toFixed(2); }
  // every row, every outcome and "Pyongyang kept"
  const rows = {}; for (const [k, r] of Object.entries(R)) rows[k] = { n: r.n, fight: r.fight, unified: sh(r, O_WIN), better: sh(r, O_BETTER), pyongyangKept: sh(r, O_WIN, O_BETTER), draw: sh(r, O_DRAW), wider: sh(r, O_WIDER), outcomes: r.outcomes, usDeadMean: +r.deadMean.toFixed(1), endMean: +r.endMean.toFixed(2) };
  const J = new URL('./results_v3.json', import.meta.url), j = JSON.parse(fs.readFileSync(J, 'utf8')); j.filmRows = { keys: F, rows, hero, note: 'percent of the wars America fights; Pyongyang kept = UNIFIED + BETTER PEACE; from-date rows: realUntil(t) + one forced choice, seed 7; from-June rows: seed 5, the forced-table wars' }; fs.writeFileSync(J, JSON.stringify(j, null, 1));
  const lab = Object.fromEntries([...FROM_DATE.map(([k, l, t]) => [k, l + ' (t ' + t + ')']), ...FROM_JUNE.map(([k, l]) => [k, l])]);
  let md = `\n## Film rows (from-date)\nCold read 2, findings 3-4. Each row restarts from the REAL state on its date with one choice forced and everything after it free, beside the same restart unforced (the gauge on screen), and the same choice forced from 25 June (RESULTS' forced table). ${N.toLocaleString('en-US')} wars a row; from-date rows seed 7, from-June rows seed 5. Shares of the wars America fights. **Pyongyang kept = UNIFIED + BETTER PEACE** (any end with Pyongyang on the UN side).\n\n| Key | Row | Unified | Better peace | Pyongyang kept | Draw | Wider war | Mean US dead (k) | Mean end |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const [k, r] of Object.entries(rows)) md += `| ${k} | ${lab[k]} | ${r.unified}% | ${r.better}% | ${r.pyongyangKept}% | ${r.draw}% | ${r.wider}% | ${r.usDeadMean} | ${r.endMean} |\n`;
  md += `\nThe script's keys (results_v3.json, filmRows.keys):\n` + Object.entries(F).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n') + '\n';
  md += `\nNotes:\n- ROK38: from its own date (early Oct) ${F.ROK38_UNIFIED}% unified, ${F.ROK38_PY}% Pyongyang kept; from 25 June ${F.ROK38_UNIFIED_FROM_JUNE}% / ${F.ROK38_PY_FROM_JUNE}%. The ${F.ROK38_UNIFIED >= F.ROK38_UNIFIED_FROM_JUNE ? 'from-date' : 'from-June'} value is the larger: from 25 June the summer can still be lost (and America stay out) before the choice is reached; the from-date row starts from the real September victory.\n- CHONGCHON_LOST_PY (${F.CHONGCHON_LOST_PY}%) is real, not a bug: after the Ch'ongch'on is lost the UN falls back to the 38th and its offensives aim at the Kansas line (the 1951 limited-war doctrine, accepted as declared judgment by history review r2), so no path leads back to the neck except an escalation (MacArthur's war or an atomic break), which the forced real forks switch off or make rare; a unified Korea then needs China to go home.\n- A22's dig-in is the model's dig-in after Unsan, on the Ch'ongch'on line (39.6°N), just north of the neck (39.19°N): the "neck" in the script's wording.\n- HERO_N: wars of the main run (seed ${19500625}) in which America heeds the warning halfway (the neck rather than the 38th), tells Peking it will go no further, China comes in anyway, attacks the line in spring 1951 and every such attack is held. ${hero.length} found in the first wars searched:\n` + hero.map(h => `  - war ${h.war}: ${h.outcome}, line ${h.line}°N, ends ${h.ends}; spring attacks held: ${h.springBattles}`).join('\n') + '\n';
  const M = new URL('./RESULTS_v3.md', import.meta.url); let m = fs.readFileSync(M, 'utf8'); const at = m.indexOf('\n## Film rows (from-date)'); if (at >= 0) { const nx = m.indexOf('\n## ', at + 5); m = m.slice(0, at) + (nx >= 0 ? m.slice(nx) : ''); }
  m = m.replace('\n## Strange worlds', md + '\n## Strange worlds'); fs.writeFileSync(M, m); return F;
}
if (isMainThread && process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('film_rows.mjs')) addFilmRows().then(F => console.log(JSON.stringify(F, null, 1)));
