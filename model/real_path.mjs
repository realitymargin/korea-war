// The real chain of events, June 1950 - July 1953, as the Korea model's turning points (model v2; REALQ functions get (tau, S, t): the story clock, the state, the calendar; t = months from June 1950; t = 4.4 is 13 Oct 1950, t = 37.9 is 27 Jul 1953).
// realUntil(t) restarts the model from the real situation at time t: before it every roll and battle goes the way it really went; from t on the war runs free.
// Stalin's death (5 Mar 1953) is a fixed date in the model on every path (H.stalinLives is the corner case). Sources: 00_research SRC_A, SRC_B (B1-B3), SRC_C, SRC_FORKS.
const ACTIVE = new Set([24, 25, 27, 28, 36, 37]);   // the active months of the outpost war: Jun, Jul, Sep, Oct 1952; Jun, Jul 1953 (REISTER B-1; SRC_B B3 §5b)
export const REALQ = {
  usIntervenes: () => true, latePusanEntry: () => false, kpaNoPause: () => false, crossWinter: () => true, rheeDefies: () => false, kpaReturn: () => false, chinaBreakNeck: () => false, shieldLater38: () => false, resume: () => false, recross: () => false, crossLater: () => false, evacDavidson: () => false,   // the KPA paused 3-4 days at Seoul (APPLEMAN); no Davidson Line, no re-crossing (SRC_B B1 §4d)
  oneCommand: () => false, inchonPlan: () => true,   // Truman 27 and 30 Jun 1950; X Corps kept under GHQ; Inchon 15 Sep (SRC_A §2-3, §7a)
  heedPanikkar: () => false, crossAnyway: () => true, haltNeck: () => false, rokStopped: () => false, stop38IfHeeded: () => false, neckIfHeeded: () => false,   // the warning read as bluff; US forces cross 7-9 Oct; MacArthur lifts the restraint 24 Oct (SRC_A §4-5, §7b)
  chinaYalu: () => true, china38: () => true, chinaNeck: () => true, chinaAssured: () => true, usRearm: () => true, sovietArms: () => true,   // Mao decides 13 Oct, the PVA crosses 19 Oct; the FY1951 supplementals; Soviet arms for 60 divisions (SRC_C R2, C2 §1b, §2c)
  sovietGround: () => false, sovietFrontAir: () => false, readsUnsan: () => false, digIn: () => false,   // no Soviet ground forces; Soviet air kept to the rear; the FEC held to 44,851-70,051 (SRC_C R3, C1 §2)
  sovietCovert: () => true, sovietOvertAir: () => false, sovietOvertMac: () => false, sovietNukeEntry: () => false, alliesNuke: () => false, lateChina: () => false, shieldLater: () => false, escalationStopped: () => false,   // the 64th IAK fought covertly from 1 Nov 1950 (WEATHERSBY #35)
  nukeWinter: () => false, atomicFront: () => false, bombManchuria: () => false, alliesLeave: () => false, nationalists: () => false, evacuate: () => false,   // Truman's pledge to Attlee 7 Dec; the JCS 12 Jan proposals not adopted; Chiang's offer declined; no evacuation (SRC_A §9e, §10)
  macArthurKept: () => false, blockadeAlone: () => false, nukeMac: () => false, chinaBreak: () => false,   // MacArthur relieved 11 Apr 1951 (SRC_A §10)
  shield38: () => false, shieldNeck: () => false, pushNorth: () => false, talks: t => t >= 13, damsEarly: () => false,   // talks open 10 Jul 1951 (SRC_A §10; SRC_B B3 §2e); the dams only in May 1953 (C1 §3c)
  activeMonth: t => ACTIVE.has(Math.floor(t)), powConcession: () => false, newPresidentArmistice: () => true,   // voluntary repatriation kept; Eisenhower seeks the armistice (SRC_C C2 §4d, §4g)
  armStalin: () => false, armNeck: () => false, armAfter: t => Math.floor(t) >= 37, nuke53: () => false,   // the armistice, 27 Jul 1953 (CONDIT; SRC_C C2 §4f)
  win_invasion: () => 'EN', win_pusanAlone: () => 'UN', win_osan: () => 'EN', win_taejon: () => 'EN', win_perimeter: () => 'UN', win_naktong1: () => 'UN', win_naktong2: () => 'UN',   // SRC_B #1-6
  win_davidson: () => 'UN', win_breakoutAlone: () => 'UN', win_breakoutLate: () => 'UN', win_rokOnjong: () => 'UN',   // not fought on the real path
  win_inchon: () => 'UN', win_breakout: () => 'UN', win_pyongyang: () => 'UN', win_rokNorth: () => 'UN', win_toYalu: () => 'UN', win_onjong: () => 'EN', win_unsan: () => 'EN', win_airSup: () => 'UN',   // SRC_B #7-11, #28
  win_chongchon: () => 'EN', win_winterLine: () => 'UN', win_neckHold: () => 'UN', win_chosin: () => 'UN', win_hungnam: () => 'UN', win_thirdPhase: () => 'EN',   // SRC_B #12-15
  win_twinTunnels: () => 'UN', win_hoengsong: () => 'EN', win_chipyongni: () => 'UN', win_wonju: () => 'UN', win_killerRipper: () => 'UN', win_spring1: () => 'UN', win_spring2: () => 'UN', win_counter51: () => 'UN',   // SRC_B #16-22
  win_tongchon: () => 'UN', win_pushNeck: () => 'UN', win_ridges: () => 'UN', win_commando: () => 'UN', win_blackThursday: () => 'EN', win_outposts: () => 'UN', win_kumsong: () => 'UN',   // SRC_B #23-27
  win_pvaOff: () => 'UN', win_unOff: () => 'UN',   // no unnamed battle should fire on the real path; if one does, the UN held (the test checks none fires)
};
// the decisions of the nine forks of DESIGN_v1, forced to the real choice (the calibration test: battles stay free)
export const REAL_FORKS = { kpaNoPause: false, usIntervenes: true, latePusanEntry: false, crossWinter: true, inchonPlan: true, oneCommand: false, heedPanikkar: false, crossAnyway: true, haltNeck: false, chinaYalu: true, readsUnsan: false, nukeWinter: false, bombManchuria: false, nationalists: false, macArthurKept: false, pushNorth: false };
// the front, average latitude over longitude 126.1-129.4°E at the end of each month, measured on 01_script/CONTROL_KR.json (19 dated lines georeferenced from Appleman, Mossman and Hermes maps and the USMA atlas)
// and interpolated in time between the dated lines. Oct-Nov 1950 (t 4, 5) average in X Corps deep in the north-east, which the model's single front does not carry: shown, not tested (REAL_FRONT_NORTH)
export const REAL_FRONT = { 0: 37.45, 1: 36.1, 2: 35.87, 3: 37.62, 4: 40.41, 5: 40.46, 6: 37.72, 7: 37.23, 8: 37.53, 9: 37.85, 10: 38.07, 11: 38.09, 12: 38.1, 13: 38.11, 16: 38.12, 24: 38.14, 36: 38.17 };
export const REAL_FRONT_NORTH = new Set([4, 5]);
// real dates (t, months from June 1950) of the stages the timeline compares, with the model event that marks each
export const REAL_DATES = [
  ['Seoul falls', 0.1, 'the invasion: Seoul: the North Koreans win'], ['Taejon falls', 1.65, 'the Kum and Taejon: the North Koreans win'], ['the perimeter forms', 2.1, 'the Pusan Perimeter forms: the UN wins'],
  ['Inchon', 3.47, 'Inchon: the UN wins'], ['the KPA collapses', 3.9, 'the KPA collapses'], ['China enters', 4.4, 'China enters'], ['Pyongyang falls', 4.65, 'Pyongyang: the UN wins'],
  ['the Ch\'ongch\'on', 5.8, 'the Ch\'ongch\'on (Kunu-ri): the Chinese win'], ['Seoul lost again', 7.1, 'the Third Phase (Seoul lost): the Chinese win'], ['Chipyong-ni', 8.45, 'Chipyong-ni: the UN wins'],
  ['MacArthur relieved', 10.35, 'MacArthur relieved'], ['talks open', 13.3, 'talks open'], ['Stalin dies', 33.15, 'Stalin dies'], ['the armistice', 37.9, 'the armistice'],
];
// the real costs (SRC_A §11; SRC_C C2 §1c, §3c-d): thousands of men; $bn
export const REAL_COST = { usDead: 33.739, usInTheatre: 36.574, usWounded: 103.284, rokDead: 138.418, pvaDead: [148.6, 183.1, 197.7, 400], kpaDead: [214.9, 294.2, 316.6, 520], kpaPOW: [110, 127], months: 37.1, usCostBn: [18.1, 30] };   // SRC_G §0 [D]: ROK MND/IMH 2023 138,418; Chinese 148,600 (Korean estimate) to 400,000+; North Korean about 215,000-520,000 (estimates; the North never published one); KPA captured 16 Sep-23 Nov ~110,000-127,000
export const MILESTONES = [
  [0, '25 June 1950: the invasion'], [3.3, 'before Inchon (Sep 1950)'], [3.95, 'at the 38th and Panikkar\'s warning (30 Sep-3 Oct 1950: identical, no roll falls between)'], [4.48, 'Wake Island (15 Oct 1950)'],
  [5.03, 'after Unsan (2 Nov 1950)'], [5.75, 'the Yalu offensive (24 Nov 1950)'], [6.0, 'Chosin and the retreat (Dec 1950)'], [10.35, 'MacArthur dismissed (11 Apr 1951)'], [13.35, 'July 1951: the talks open (10 Jul)'], [33.2, 'Stalin dies (Mar 1953)'] ];
export function realUntil(t, extra = {}) { return { __real: { until: t }, ...extra }; }
