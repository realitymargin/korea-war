// RealityMargin · "Could America Have Won the Korean War?" The Korean War model, v3 (12 Nov 2026), built to _system/SIM_STANDARD.md on the japan-sim v5 architecture.
// v3 answers review round 2 (_work/REVIEW_history_r2.md, _work/REVIEW_code_r2.md) and applies 00_research/SRC_G_lock_gaps.md; v2 answered round 1. v2 is _work/sim_v2_backup.mjs, v1 _work/sim_v1_backup.mjs. Design and the findings tables: sim/DESIGN_v3.md.
// Sources: 00_research/SRC_A_1950_story.md (A), SRC_B_battles.md (B: parts B1-B3, the 28 battle rows), SRC_C_forces_economy.md (C1 forces and logistics, C2 economy and will, R red lines),
// SRC_FORKS_inputs.md (F), and Donggil Kim, Cold War History 16:3 (2016), read directly by the history reviewer (KIM-CWH-2016 [D]). INPUTS.md is generated from this file.
// One war = monthly turns from June 1950 (t = 0 is 1 June 1950; t = 1.13 is 5 July) to December 1955 (t = 66). Two clocks (code review r1 M6): the CALENDAR (t, m) holds only true calendar facts
// (Stalin's death, the 1952 election, the winter's cold); the STORY clock (tau = t - lag, the lag being any delay in the war's own course: a late American entry, no Inchon, a slower breakout)
// drives the battle windows and every force series, so a delay never buys free reinforcements.
// Battles are events resolved from the forces on each side (strength, supply, firepower, cohesion), intelligence and luck; each named battle's middle odd is the source's at the force ratio it
// really had (measured on the model's own real path); a different state moves it. Losses carry: the line, the armies (a trained Chinese combat pool refilled at its own rate), US will, the end date, the cost.
// Leaders: one temperament per war for Washington (Truman), MacArthur, Mao and Stalin; it shifts strategic choices, never luck in the field.
// The dice (common random numbers; code review r1 M1, M2): a battle is keyed by its id and, for the monthly and generic ones, by its time; a decision by its name, its site and how often it was rolled
// there; a monthly hazard by its name and month. Changing one event never reshuffles another's luck (the CRN fingerprint test checks every flip).
// Arithmetic: the seeded path uses only + - * / and Math.floor/round/min/max/abs (exact in every JavaScript engine); exp, log and powers are computed by dexp/dlog below, not Math.exp/log/pow,
// whose results the ECMAScript standard leaves to each engine (code review r1 m11: the page runs in browsers).
import { REALQ } from './real_path.mjs';

export const O_WIN = 'UNIFIED KOREA', O_BETTER = 'BETTER PEACE', O_DRAW = 'DRAW NEAR THE 38TH', O_WORSE = 'WORSE PEACE', O_LOSS = 'LOSS', O_WIDER = 'WIDER WAR', O_OUT = 'AMERICA STAYS OUT';
export const OUTCOMES = [O_WIN, O_BETTER, O_DRAW, O_WORSE, O_LOSS, O_WIDER, O_OUT];
export const FIGHTS = [O_WIN, O_BETTER, O_DRAW, O_WORSE, O_LOSS, O_WIDER];   // the headline is given among the wars in which America fights (DESIGN_v2; history review r1 #21)
export const MN = 67, yearOf = t => 1950 + (5 + t) / 12;
export const monthName = t => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(5 + Math.floor(t)) % 12] + ' ' + (1950 + Math.floor((5 + Math.floor(t)) / 12));
// the front as an average latitude over longitude 126.1-129.4°E; measured where the project has the line (01_script/CONTROL_KR.json): the 1953 line 38.17, Kansas-Wyoming 38.11, the neck what-if line 39.19.
// North of the neck the scale is stylized (the Ch'ongch'on line stands for the front; "the Yalu" = the UN at the border)
export const LAT = { yalu: 40.6, chongchon: 39.6, neck: 39.19, kansas: 38.11, p38: 38.0, han: 37.5, lineD: 37.05, kum: 36.4, naktong: 35.9, pusan: 35.1 };
export const LINES = [40.6, 39.6, 39.19, 38.11, 38.0, 37.5, 37.05, 36.4, 35.9, 35.1];
export const ARM53 = 38.17, BAND = 0.27, BETTER_LAT = 39.0;   // the 1953 line (measured), ±30 km; BETTER PEACE = the neck, at or north of 39.0°N with Pyongyang and Wonsan held (DESIGN_v2, fixed before the v2 run)
export const classify = (line, held) => line >= LAT.yalu - 0.01 && held ? O_WIN : line >= BETTER_LAT ? O_BETTER : line >= ARM53 - BAND ? O_DRAW : O_WORSE;

// ---------- deterministic exp and log (only + - * /, exact in every engine)
const LN2 = 0.6931471805599453;
export function dexp(x) { if (x > 700) return 1e304; if (x < -700) return 0; const k = Math.round(x / LN2), r = x - k * LN2; let s = 1, term = 1; for (let i = 1; i < 22; i++) { term = term * r / i; s += term; } let p = 1; const b = k > 0 ? 2 : 0.5; for (let i = 0; i < Math.abs(k); i++) p *= b; return s * p; }
export function dlog(x) { if (!(x > 0)) return -1e300; let e = 0; while (x > 2) { x /= 2; e++; } while (x < 1) { x *= 2; e--; } const y = (x - 1) / (x + 1), y2 = y * y; let s = 0, p = y; for (let i = 1; i < 60; i += 2) { s += p / i; p *= y2; } return 2 * s + e * LN2; }
const dpow = (a, b) => a <= 0 ? 0 : dexp(b * dlog(a));
const sig = x => 1 / (1 + dexp(-x)), logit = p => dlog(Math.max(1e-9, p) / Math.max(1e-9, 1 - p)), hz12 = p => 1 - dpow(1 - p, 1 / 12), hz6 = p => 1 - dpow(1 - p, 1 / 6);

// odds: [against America, middle (headline), for America]. A battle's value is P(the UN wins it) (for a battle the enemy really won: 1 - SRC_B's P(real winner wins)).
// A decision's value is P(that choice is taken); "for" is the value the sources judge better for America's war aims; where an escalation is judged harmful the order is turned round.
export const ODDS = {
  // June-September 1950 (A §1-3; B1 §1-6; F §2)
  usIntervenes: [0.88, 0.93, 0.97],    // Truman commits US air, sea and ground forces (27 and 30 Jun 1950): Bradley "draw the line somewhere", Truman "armed invasion and war" (A §2a, A dec. 7); against: the Acheson perimeter and the 1947 JCS view (A §1c). judgment
  latePusanEntry: [0.10, 0.20, 0.35],  // per quarter, with no US forces and a ROK pocket holding: the US enters after all, to hold Japan's flank (F §2). judgment
  invasion: [0.03, 0.08, 0.20],        // the ROK holds north of Seoul on 25-28 Jun: 1 - SRC_B #1 (0.97/0.92/0.80); KPA 150 T-34s against no ROK tanks (B1 §1)
  pusanAlone: [0.03, 0.08, 0.20],      // with no US forces at all, a ROK pocket holds round Pusan: 1 - P(the KPA conquers the South by 30 Sep) 0.97/0.92/0.80 (F §2; APPLEMAN via B1 §4a)
  kpaNoPause: [0.20, 0.10, 0.05],      // the KPA drives on without its 3-4 day pause at Seoul (APPLEMAN [D] via history review r1 #24, north_wins). judgment
  osan: [0.01, 0.03, 0.10],            // Task Force Smith holds at Osan, 5 Jul: 1 - SRC_B #2 (B1 §2)
  taejon: [0.05, 0.15, 0.35],          // the 24th Division holds the Kum and Taejon, 14-20 Jul: 1 - SRC_B #3 (B1 §3)
  perimeter: [0.80, 0.90, 0.97],       // the perimeter forms behind the Naktong (~4 Aug): SRC_B #4; "Never again did the North Koreans come as close to victory" (APPLEMAN p.~247; B1 §4a)
  naktong1: [0.75, 0.88, 0.95],        // the First Naktong Bulge, 5-19 Aug: SRC_B #5 (B1 §4b)
  naktong2: [0.70, 0.85, 0.95],        // the Great Naktong Offensive, 31 Aug-15 Sep: SRC_B #6; withdrawal orders to the Davidson Line drafted 5 Sep, never issued (B1 §4d)
  davidson: [0.40, 0.60, 0.75],        // the UN holds the Davidson Line after the perimeter AND the Great Naktong both failed: 1.8:1 men, 6:1 firepower, 6:1 tanks (B1 §4d [D]; history review r1 #13). judgment
  evacDavidson: [0.25, 0.10, 0.03],    // one-off: back on the Davidson Line, the perimeter collapses to an evacuation of Pusan: SRC_B's own input (B1 §4d); MacArthur 27 Jul "no Korean Dunkerque" (history review r1 #13)
  oneCommand: [0.05, 0.10, 0.20],      // X Corps put under Eighth Army instead of GHQ (Walker, Dabney, the FEC staff, Joy proposed it) (A dec. 5; F §6). judgment
  inchonPlan: [0.80, 0.90, 0.95],      // MacArthur's Inchon plan goes ahead over the JCS doubts, rather than a breakout only (A §3; F §11). judgment
  inchon: [0.85, 0.93, 0.98],          // the Inchon landing succeeds, 15 Sep: SRC_B #7; the 15 Sep tide the only day with a 31.2 ft range (B1 §5)
  breakout: [0.85, 0.95, 0.99],        // the Pusan breakout and the KPA collapse with Inchon behind the KPA, 16-30 Sep: SRC_B #8; only 25,000-30,000 escape north (APPLEMAN p.~604; B1 §6)
  breakoutAlone: [0.45, 0.60, 0.75],   // with no Inchon (or Inchon failed), Eighth Army breaks out in September alone: it "moved slowly at first" until the envelopment was clear (APPLEMAN ch. XXVII-XXVIII via history review r1 #8). judgment
  breakoutLate: [0.70, 0.85, 0.95],    // ...or in October, the KPA worn down (history review r1 #8). judgment
  // October-November 1950: the 38th, the warning, China (A §4-8; B1 §7-8; C R; F §1, §3-7; KIM-CWH-2016)
  heedPanikkar: [0.10, 0.20, 0.35],    // Zhou's 3 Oct warning is acted on: CIA 12 Oct "not probable in 1950" (FRUS d665), MacArthur at Wake "Very little" (d680), FEC "diplomatic blackmail" (APPLEMAN p.~759) (F §5). judgment
  stop38IfHeeded: [0.40, 0.50, 0.60],  // heeded, the UN stops at the 38th (form a) rather than crossing with assurances and stopping at the neck (form b): Christensen 1992 treats only the 38th as the "last chance" (SRC_G §1 [D secondary]); "for" = the 38th. judgment (no source weighs Washington's choice)
  crossAnyway: [0.97, 0.95, 0.90],     // the warning not heeded, US forces cross the 38th: NSC 81/1 (FRUS d505), the JCS directive of 27 Sep, Marshall's "unhampered" (d573), UNGA 7 Oct (A §4). judgment
  crossWinter: [0.90, 0.80, 0.65],     // ...the same choice when the 38th is reached after 15 Nov (no Inchon): JCS caution over a winter advance, the warnings weigh more (JCS-III-1 [D] via history review r1 #8). judgment
  rokStopped: [0.30, 0.20, 0.10],      // the US also stops the ROK at the 38th when it stops there itself: Rhee's ROK crossed before the UN vote (APPLEMAN; F §3). judgment
  haltNeck: [0.05, 0.10, 0.20],        // US forces hold at the Pyongyang-Wonsan neck and leave the north to the ROK, as the JCS 27 Sep restriction had it (lifted by MacArthur 24 Oct) (A §7c; F §4). judgment
  neckIfHeeded: [0.80, 0.85, 0.90],    // heeded and crossing, the UN gives credible assurances and stops at the neck (F §5 form b). judgment
  chinaYalu: [0.97, 0.92, 0.80],       // China sends the PVA when US troops cross and drive for the Yalu: two near-reversals (2 and 12 Oct), Mao's 13 Oct "absolute obligation" (SRC_C R5; CHEN-1994)
  china38: [0.65, 0.45, 0.25],         // China sends troops when the UN stops at the 38th and the ROK goes north, rolled as the ROK nears the Yalu: KIM-CWH-2016 [D] p.240, 252, 254 (the 38th "not a precondition"), CHEN-1994 against; FRUS d589 and the Politburo split for (history review r1 #1). judgment
  chinaNeck: [0.90, 0.80, 0.60],       // ...when the UN stops at the neck with US troops north of the 38th: China decided 13 Oct and crossed 19 Oct while the real restraining line still stood (SRC_C R5; KIM-DH-2016)
  chinaAssured: [0.85, 0.75, 0.55],    // ...when the UN crosses with credible assurances and stops at the neck: the Seventh Fleet still in the Strait made Korea-only assurances weak (KIM-CWH-2016 [D] p.~240; Mansourov [D] for; history review r1 #6). judgment
  rokOnjong: [0.03, 0.08, 0.20],       // the ROK alone holds when the PVA enters on the 38th road and strikes it, as at Onjong: the onjong odds (SRC_B #10; Mao 13 Oct: the first echelon "will be able to fight against the troops of Syngman Rhee", MANSOUROV Doc 19 [D]; history review r1 #2)
  recross: [0.40, 0.55, 0.70],         // after that blow, Washington re-crosses the 38th to save the ROK (the real-drive war with China already in) rather than holding the 38th (history review r1 #2). judgment, the reviewer's values and order
  crossLater: [0.90, 0.80, 0.65],      // the ROK alone fails in the north with China out: Washington sends US troops north after all; the KPA is beaten, so the case is stronger (history review r1 #4). judgment
  shield38: [0.40, 0.20, 0.05],        // per half-year in the first six months: China, in as a shield, launches a major offensive against a UN line at the 38th: Mao's 14 Oct six-month plan (SRC_C R5; F §3)
  shieldNeck: [0.35, 0.20, 0.10],      // per half-year in the first six months: the same against a UN line at the neck: Mao 14 Oct; Peng's premise the UN "should stop ... on the spot" (SRC_C R5; F §4)
  shieldLater38: [0.40, 0.25, 0.10],   // per half-year from the seventh month, the shield at the 38th: no US troops north, the KPA destroyed; lower than the neck plan (history review r2 m3; no source tests it directly). judgment
  rheeDefies: [0.40, 0.30, 0.20],      // on the assurance road, Rhee sends the ROK past the buffer anyway: Rhee's ROK crossed the 38th before the UN vote (APPLEMAN via F §3); ordered by its harm to America (history review r2 N2). judgment
  kpaReturn: [0.10, 0.06, 0.03],       // per month from the fourth month of the hold, with 100,000 or more KPA rebuilt in Manchuria: the KPA comes back (MacArthur 25 Oct 1950: the ROK "could not handle the situation in northern North Korea alone", FRUS-VII d706 [D] via SRC_A §7b; 25,000 guerrillas in X Corps' rear, APPLEMAN p.~726 [D]; history review r2 N3). judgment
  holdNorth: [0.45, 0.65, 0.80],       // the ROK (with US troops if they went north) holds against the returning KPA, at the ROK-KPA ratio (history review r2 N3). judgment
  chinaBreakNeck: [0.01, 0.03, 0.06],  // within 12 months: China's will breaks with the PVA simply held at the neck, no escalation (C2 §4e: no break "at real loss rates"; history review r2 m1). judgment
  shieldLater: [0.60, 0.45, 0.25],     // per half-year from the seventh month: Mao would "discuss again the issue of attacking the enemy after six months" (KIM-DH-2016 [D], R2); the build-up to ~950,000 was an army for offensives (LI; CHEN-1994 [D]; history review r1 #7). judgment
  sovietGround: [0.05, 0.02, 0.01],    // the Soviets send ground forces when North Korea collapses and China stays out: Politburo "avoid ... even if the USSR had to abandon North Korea"; Stalin's 13 Oct evacuation order (MANSOUROV; SRC_C R5)
  lateChina: [0.08, 0.05, 0.02],       // per month of the hold, with China out and the UN or ROK on the Yalu: China enters after all (the Sup'ung dams, the security case at its strongest): KIM-CWH-2016 [D]; SRC_C R (history review r1 #3). judgment
  pyongyang: [0.85, 0.95, 0.99],       // the UN takes Pyongyang, 19-20 Oct: SRC_B #9; the advance north of the 38th supply-limited (APPLEMAN p.~640; B1 §7)
  rokNorth: [0.55, 0.70, 0.85],        // the ROK alone REACHES the Yalu by Dec 1950 with China out: ROK I Corps took Wonsan 10 Oct, the 6th Division reached Ch'osan 26 Oct against a KPA in collapse (B1 §7-8 [D]); the holding is separate (history review r1 #5). judgment
  onjong: [0.03, 0.08, 0.20],          // the ROK II Corps holds at Onjong, 25-29 Oct: 1 - SRC_B #10 (B1 §8)
  unsan: [0.10, 0.25, 0.50],           // the 8th Cavalry holds at Unsan, 1-2 Nov: 1 - SRC_B #11 (B1 §8)
  sovietFrontAir: [0.15, 0.05, 0.02],  // Soviet air openly over Korea's front line: Stalin kept it to the rear and the Yalu, "the Chinese rely only on their own aviation at the front" (WEATHERSBY doc #68; SRC_C R5)
  airSup: [0.85, 0.93, 0.98],          // the UN keeps air superiority south of the Ch'ongch'on once the MiGs appear (1 Nov 1950): SRC_B #28; Sabre v Soviet-flown MiG about 2-4:1, 10:1 claimed; the 64th IAK's own report: 1,097 UN aircraft claimed, 319 lost (TsAMO via SRC_G §2.5 [D])
  readsUnsan: [0.05, 0.15, 0.35],      // the UN reads the First Phase right (>150,000 Chinese by 20 Nov): 96 prisoners from six armies by 23 Nov (APPLEMAN p.~751); FEC held to 44,851-70,051 against ~300,000 (C1 §2; F §7)
  digIn: [0.50, 0.70, 0.85],           // reading it right, the UN halts and digs in on the Ch'ongch'on instead of the 24 Nov offensive (F §7). judgment
  chongchon: [0.08, 0.15, 0.30],       // Eighth Army holds the Ch'ongch'on, 25 Nov-1 Dec: 1 - SRC_B #12; ~200,000 PVA, ROK II Corps gone on day 2, 2d Division -4,940 (MOSSMAN; B2 §1)
  chongchon1C: [0.15, 0.30, 0.50],     // ...with one command and a continuous front with 5 days' supply: 1 - 0.85/0.70/0.50 (F §6; MOSSMAN). judgment
  winterLine: [0.60, 0.75, 0.85],      // the UN holds a prepared line against a PVA offensive, winter 1950-51: 1 - P(the PVA breaks it) 0.40/0.25/0.15 (F §7; prepared lines held in Feb and May 1951, B2 §6-7)
  neckHold: [0.50, 0.70, 0.85],        // the UN holds the neck when the PVA attacks it in winter: a ~100-150 mile line, concentrated, short supply (F §4; A §7c: Bevin ~150 mi, MacArthur 120 air / 150 road mi). judgment
  chosin: [0.75, 0.88, 0.95],          // X Corps breaks out from Chosin, 27 Nov-11 Dec: SRC_B #13; PVA IX Army Group -48,000-52,000 and out ~3 months (B2 §2; the PVA losses and the cold share rest only on secondary accounts [W]: our judgment)
  hungnam: [0.88, 0.95, 0.99],         // the Hungnam evacuation, 11-24 Dec: SRC_B #14; ~105,000 troops and 86,000-98,100 refugees out (B2 §3)
  // winter 1950-51: the crisis (A §9-10; B2; F §8, §10; history review r1 #18-19)
  nukeWinter: [0.06, 0.03, 0.01],      // atomic use in the winter crisis (the UN driven to or south of the 38th): Truman's 30 Nov remark; with Attlee he privately agreed to consult, but the 8 Dec communique said only "informed" (Truman Library, Public Papers 301; history review r2 m2) (A §9e; JCS-III-1; F §10a). judgment. Turned round: use judged harmful
  bombManchuria: [0.08, 0.05, 0.02],   // the US bombs the Manchurian airfields in the winter crisis: the JCS 12 Jan 1951 proposals, weakened by the NSC staff (JCS-III-1); the allies refused even hot pursuit (A dec. 6; F §8). judgment
  nationalists: [0.04, 0.02, 0.01],    // Chiang's 33,000 are sent to Korea: offered 29 Jun 1950 (FRUS d159), renewed by MacArthur 28 Nov; the JCS "deplored the low state of training" (SCHNABEL via F §8). judgment
  sovietCovert: [0.97, 0.93, 0.85],    // the Soviet air force defends its Manchurian bases, covertly, when they are bombed: NIE-2/2 (27 Nov 1950) "the USSR would provide aircraft, anti-aircraft artillery, and trained personnel as necessary for the defense of Manchurian targets"; SE-37, SE-41; the 64th IAK from 1 Nov 1950 (TsAMO) (SRC_G §0, §2.3, §2.5 [D]). Not a wider war. judgment
  sovietOvertAir: [0.15, 0.08, 0.03],  // ...the Soviets enter OVERTLY (acknowledged strikes on UN bases in Korea or Japan) when only the airfields are bombed: DCI Smith to the NSC, 9 Nov 1950: attacks on "troop concentrations or air fields north of the Yalu River" "would not increase the already substantial risk" of general war; SE-41 ¶9, ¶16 "might" (SRC_G §2.3 [D]); Politburo "avoid ... at all costs" (MANSOUROV [D]). judgment
  sovietOvertMac: [0.45, 0.25, 0.10],  // ...when the full MacArthur programme comes (strategic bombing, blockade, Nationalist landings): NIE-11 (5 Dec 1950) against: China would not have accepted the risk "without explicit assurance of effective Soviet support"; SE-37 (9 Mar 1953) and SE-41 (8 Apr 1953) for: Soviet units "would covertly participate", the USSR would "leave to the UN/US the responsibility for recognizing" a Soviet commitment. (SE-5's "open commitment" is about a Nationalist invasion with US operational support, not this case.) SRC_G §0, §2.3 [D]. judgment
  sovietNukeEntry: [0.40, 0.25, 0.10], // ...the Soviets enter overtly when the US uses atomic weapons on China or Korea: FRUS-XV doc 536, the Soviet stockpile 5/25/50/120 (C2 §5a; F §10, §8)
  alliesLeave: [0.40, 0.25, 0.10],     // the allies leave the UN command after a unilateral escalation: the Attlee visit, Dec 1950; Dutch and NATO reservations on hot pursuit (CONDIT; JCS-III-1; F §8). judgment
  alliesNuke: [0.50, 0.35, 0.20],      // the allies break with the US after atomic use without consultation: Truman 7 Dec 1950 "would not consider using the atomic bomb without consulting the United Kingdom" (JCS-III-1 [D]; F §10)
  evacuate: [0.15, 0.08, 0.03],        // per month from 1951, with the line on or south of the Naktong after a lost battle: the JCS 12 Jan "not withdraw unless militarily forced to do so" (MOSSMAN p.~232-234 [D]); "nothing ... suggests a threat to the Eighth Army's survival" (B3 [D]) (history review r1 #13). judgment
  thirdPhase: [0.12, 0.20, 0.40],      // the UN holds the PVA Third Phase, 31 Dec-8 Jan: 1 - SRC_B #15; Seoul lost 4 Jan, -70 mi, the PVA pauses after about a week (B2 §4)
  twinTunnels: [0.70, 0.82, 0.92],     // the UN wins at Twin Tunnels, 29 Jan-1 Feb: SRC_B #16 (B2 §6a)
  hoengsong: [0.12, 0.20, 0.40],       // the UN holds at Hoengsong, 11-13 Feb: 1 - SRC_B #17; UN -11,862 (ROK -9,844) (B2 §7)
  chipyongni: [0.60, 0.75, 0.88],      // the 23d RCT holds Chipyong-ni, 13-15 Feb: SRC_B #18, "A Turning Point" (B2 §6)
  wonju: [0.70, 0.82, 0.92],           // the UN holds Wonju, 13-18 Feb: SRC_B #19 (B2 §7c)
  killerRipper: [0.70, 0.85, 0.93],    // Operations Killer and Ripper, 21 Feb-31 Mar: SRC_B #20; +~70 mi, Seoul retaken, the enemy army not destroyed (B2 §8)
  // 1951: MacArthur, the spring offensives, talks or the push north (A §10; B3 §1-4; F §8-9)
  macArthurKept: [0.08, 0.05, 0.02],   // Truman keeps MacArthur and adopts his 30 Dec 1950 measures in spring 1951: refused; "the wrong war" (Bradley, JCS-III-1 p.~254; A §10; F §8). judgment
  blockadeAlone: [0.40, 0.25, 0.10],   // on that path, the China coast is blockaded without British agreement: JCS 9 Jan 1951, not "without British approval" (SCHNABEL; F §8). judgment
  nukeMac: [0.40, 0.25, 0.10],         // on that path, the US uses atomic weapons: SRC_C §6 gives 0.10/0.25/0.40 as low/mid/high; turned round, use judged harmful; the capsules went to Guam on 6 Apr 1951, the weapons forward-deployed from June 1951 (Norris; FRUS-BELK via SRC_G §0, §2.2 [D]) (F §8; JSPC Aug 1951)
  atomicFront: [0.05, 0.10, 0.20],     // a limited atomic campaign breaks the PVA front: JCS 1953 "piecemeal or limited employment ... is not recommended"; Bradley, no target "sufficiently remunerative"; Hudson Harbor (Sep-Oct 1951): "timely identification of large masses of enemy troops was extremely rare" (Cumings, via SRC_G §0 [D secondary]) (C2 §5b; F §8). judgment
  chinaBreak12: [0.03, 0.07, 0.15],    // within 12 months: China's will breaks and the PVA goes home, under the MacArthur measures or after an atomic break of the front (C2 §4e; F §8). judgment
  escalationStopped: [0.03, 0.08, 0.15], // Congress or the allies stop an escalation before mid-1953 (the Pace memo, JCS-III-2; the allies; OMB, CONDIT: money alone never bound, defence "never exceeded 14 percent"; SRC_C §6; history review r1 #20). judgment. Stopping is better for America
  spring1: [0.78, 0.87, 0.94],         // the UN holds the Spring Offensive's first impulse, Imjin and Kapyong, 22-30 Apr: SRC_B #21; Glosters 699 → 40 escaped; the No Name Line holds (B3 §1)
  spring2: [0.80, 0.90, 0.95],         // the UN holds the second impulse, Soyang, 16-22 May, and counter-attacks: SRC_B #22; Communist losses est. 60,000-105,000; ~10,000 prisoners (USMC-IV p.~127 [D]) (B3 §2)
  prepared51: [0.75, 0.88, 0.95],      // the UN holds a prepared line against a full PVA offensive, 1951 on: Chipyong-ni, Wonju, the May "Van Fleet day of fire"; against: Hoengsong, the ROK III Corps collapse (MOSSMAN; F §1 input 7)
  counter51: [0.70, 0.85, 0.93],       // the May-June 1951 counter-offensive reaches the Kansas-Wyoming line: the Killer-Ripper odds (SRC_B #20) for the same kind of advance (B3 §2e). judgment
  pushNorth: [0.05, 0.08, 0.15],       // Eighth Army pushes to the neck in summer 1951 instead of talks (Van Fleet's OVERWHELMING plan; he advised against it unless conditions changed, MOSSMAN pp.~506-507; F §9). judgment
  pushNeck: [0.20, 0.40, 0.60],        // ordered, the push reaches the neck by Nov 1951: Hermes, "how long could the Eighth Army have sustained a costly offensive" (HERMES p.~508); ammunition capped a sustained autumn-1951 offensive (I Corps restricted its artillery in COMMANDO; HERMES ch. X, via SRC_G §0, §2.6 [D]); judgment, −0.05 on each (F §1 input 8, §9)
  tongchon: [0.15, 0.30, 0.45],        // the T'ongch'on envelopment destroys two or more CPV armies: Ridgway, "the possible benefits ... did not justify the risks" (MOSSMAN p.~487; F §9)
  talks: [0.50, 0.60, 0.70],           // per month, once Mao has turned to the defensive and the UN has reached its line: talks open (Malik's broadcast 23 Jun, talks 10 Jul 1951; Stalin 5 Jun 1951, CWIHP-6/7 doc #65; C2 §4f). judgment; "for" = sooner talks (debatable, code review r1 m8)
  // the talks, 1951-53 (B3 §3-6; C2 §4; F §1 inputs 9-10, §10)
  ridges: [0.70, 0.85, 0.95],          // Bloody Ridge and Heartbreak Ridge, Aug-Oct 1951: SRC_B #23; UNC 2,700-3,700 each (B3 §3)
  commando: [0.75, 0.88, 0.95],        // Operation Commando and the autumn 1951 limited offensives: SRC_B #24; 40,000 UNC casualties Aug-Oct (B3 §4)
  blackThursday: [0.03, 0.08, 0.15],   // the B-29s keep raiding MiG Alley by day after 23 Oct 1951: 1 - SRC_B #27 (0.97/0.92/0.85) (B3 §7c)
  damsEarly: [0.02, 0.05, 0.10],       // a dam and flood campaign from Aug 1951 instead of May 1953 (Toksan: "as effective as weeks of rail interdiction", Clark; FUTRELL p.~667-670; C1 §3c). judgment
  outposts: [0.85, 0.90, 0.95],        // in an active month of the outpost war the UN holds its line (Old Baldy, White Horse, Pork Chop, the Hook: the line barely moved) (B3 §5). judgment
  powConcession: [0.25, 0.15, 0.05],   // the US drops voluntary repatriation to get an earlier armistice: it "clung firmly to the concept for fifteen months" (HERMES p.~500); Eisenhower to Nehru (FRUS-XV doc 537; C2 §4g). judgment
  newPresidentArmistice: [0.60, 0.75, 0.85], // the new president (Nov 1952) seeks an armistice on about the real terms within 9 months rather than escalation (CONDIT p.~167; FRUS-XV doc 536; C2 §4d). judgment; turned round in v2: escalation judged harmful (code review r1 m8)
  armStalin: [0.01, 0.02, 0.04],       // per month in the talks while Stalin lives: "a drawn out war ... shakes up the Truman regime" (5 Jun 1951); 20 months with no armistice (CWIHP-6/7 #65, #95; C2 §4f). judgment
  armAfter: [0.15, 0.25, 0.40],        // per month after Stalin's death (5 Mar 1953): the Soviet Council of Ministers, 19 Mar, "incorrect to continue the line"; 4.7 months to the signature (CWIHP-6/7 #112; CONDIT; C2 §4f). judgment
  armNeck12: [0.10, 0.25, 0.40],       // within 12 months, an armistice on a stable line with the UN halted short of the Yalu, Stalin alive: Mao would "discuss again" after six months (F §4; C2 §4f). judgment
  chinaStrain12: [0.05, 0.10, 0.20],   // within 12 months of stalemate, China accepts US terms from economic strain, counted only when the pressure on China is heavier than real (XU-2010; Zhou's budget shares, CWIHP p1; C2 §2a, §6). judgment
  airAlone12: [0.02, 0.05, 0.10],      // within 12 months, air pressure alone forces an armistice while Stalin lives, counted only when the air war is heavier than it was (FUTRELL; CWIHP; C2 §6). judgment
  nukeSignals: [0.00, 0.03, 0.08],     // extra armistice hazard per month from the May 1953 nuclear signals: SE-41 (8 Apr 1953) ¶18 "unable to estimate" (SRC_G §0 [D]); Weathersby, "it was Stalin's death rather than U.S. threats" (CWIHP-6/7 [D]); Foot (1988) and Dingman (1988) not opened (paywall) (F §10)
  nuke53: [0.55, 0.35, 0.15],          // the US uses atomic weapons once the talks have collapsed (a year after Stalin's death with no armistice): FRUS-XV docs 535-536, readiness "say, in May of 1954"; SRC_C §6 0.15/0.35/0.55 turned round (F §10)
  kumsong: [0.80, 0.90, 0.96],         // the UN stops the last Chinese offensive at Kumsong, 13-20 Jul 1953: SRC_B #26; ROK/UNC 14,000-30,000 (B3 §6)
  // the economy's choices (C1 §3, C2 §1-2)
  usRearm: [0.85, 0.92, 0.97],         // once China is in, Congress funds the build-up (FY1951 supplementals to $48.2bn; NSC-68 at war scale; CONDIT Table 5; C2 §1b). judgment
  sovietArms: [0.97, 0.92, 0.80],      // Stalin delivers arms for 60 divisions (Zhou, 20 Aug 1952, CWIHP p1; Stalin 5 Jun 1951 more artillery on credit; C2 §2c). judgment
  temperSd: [0.5, 0.5, 0.5],           // spread of each leader's temperament between wars (logit units); the same in every set, not an odd (code review r1 m8). judgment
};
export const SETS = { low: 0, mid: 1, high: 2 };
export function oddsFor(set) { const i = SETS[set] ?? 1, o = {}; for (const [k, v] of Object.entries(ODDS)) o[k] = v[i]; return o; }

// ---------- the economy (SIM_STANDARD §1): production and replacement, the resources that limit them, and what interdiction and blockade cut. Series keyed by tau (the story clock, months), interpolated.
export const ECONOMY = {
  usGround: { 1.1: 0.5, 1.6: 39, 2.1: 47, 3.4: 85, 3.55: 140, 5.75: 178, 13: 253, 17: 265, 25: 266, 38: 302 },   // production: US ground strength in Korea (thousands): 39,439 (19 Jul), 47,000+ (4 Aug), 84,478 Eighth Army (mid-Sep) + X Corps ~55,000 US, 178,464 (23 Nov), 253,250, 264,670, 265,864, 302,483 (APPLEMAN, MOSSMAN, HERMES; SRC_C C1 §1a)
  usHold: 178,           // production: without the full rearmament (China out, or Congress not funding it) the US holds Korea at the Nov 1950 level, 178,464 (MOSSMAN; C2 §1b: the FY1951 supplementals followed the Chinese intervention). judgment
  usExtra: 40,           // resources: the Europe-first ceiling lifted: 2-4 more US divisions (~40,000) by mid-1951 on the MacArthur and push paths, at a NATO cost; the JCS war plan made Western Europe "the principal theater" (JCS-III-1 p.~21 [D]; C2 §1c; history review r1 #17). judgment
  usRepl: 22,            // replace: US replacements into Korea per month after the 1950 build-up, thousands: 16,000-28,000 (HERMES p.199; SRC_C C2 §3e)
  rokArmy: { 0: 98, 1.85: 94.5, 3.5: 120, 5.75: 224, 13: 273, 17: 282, 22: 341, 25: 376, 34: 537, 38: 591 },   // production: ROK Army strength (thousands), rebuilt with US money and arms: 98,000 (25 Jun) ... 223,950 (23 Nov 1950) ... 590,911 (Jul 1953), "sixfold" (APPLEMAN, MOSSMAN, HERMES; SRC_C C1 §1c)
  rokRebuild: 50,        // replace: most the ROK Army grows in a month (thousands): 54,000 to 94,570 by 26 Jul as stragglers returned (APPLEMAN p.35, p.191; SRC_C C1 §1c). judgment
  rokSurge: 75,          // replace: ...in Sep-Nov 1950: ~120,000 (mid-Sep) to 223,950 (23 Nov) in two months, net of the losses (APPLEMAN p.547; MOSSMAN [D]; SRC_C C1 §1c; history reviews r1 #23, r2 m5). judgment of the gross rate
  otherUN: { 2.5: 1.7, 5.75: 21, 13: 28, 25: 36, 38: 39 },   // production: other UN ground forces (thousands): the 27th Brigade 1,693 (Sep 1950), ~20,899 (23 Nov), 28,061, 35,769, 39,145 (MOSSMAN, HERMES App. A-2; SRC_C C1 §1d)
  usCostMonth: 0.8,      // production: direct US cost of the war per month, $bn: $18.1bn (McNeil 1955) to ~$30bn (CRS) over 37 months (SRC_C C2 §1c, §6)
  usDefense: { 1950: 4.9, 1951: 7.2, 1952: 12.9, 1953: 13.8, 1954: 12.7 },   // production (display: the economy table): US national defence outlays, % of GDP, on the real path; "never exceeded 14 percent" (OMB-3.1; CONDIT p.~500; SRC_C C2 §1a)
  unSupplyPerDeg: 0.15,  // resources: UN strength lost per degree north of the 38th to the supply line from Pusan and Inchon: "At every turn in the operations in North Korea during October, Eighth Army's effort was limited by an adverse logistical situation" (APPLEMAN p.~640 [D]; history review r1 #17). pure judgment of the rate
  supplyRebuild: 3,      // resources: months for half the UN supply penalty to be rebuilt on a static line (the ports of Chinnamp'o and Wonsan and the railhead within reach at the neck, SRC_FORKS §4; history review r2 m8). judgment
  kpa0: 135,             // production: the KPA on 25 Jun 1950, thousands: 77,838 in 7 assault divisions, 6,000 tank brigade, 23,000 reserve, 18,600 Border Constabulary (APPLEMAN p.~10-11; SRC_C C1 §1f)
  kpaRepl: 14.8,         // replace: KPA replacements per month while it held the South: 14,770 in Aug 1950 against 26,820 lost (APPLEMAN p.~392; SRC_C C1 §1f)
  kpaTraining: 115,      // production: KPA replacements in training in the North and men bypassed in the South, Sep-Oct 1950, overrun in the collapse: "about 100,000" in training and 15,000 bypassed (MacArthur at Wake, FRUS-VII d680 [D] via SRC_A); with it the collapse books ~110,000-127,000 captured, as the official count 16 Sep-23 Nov (Appleman, Mossman 130,921, via SRC_G §0, §2.4 [D])
  kpaRebuild: 25,        // replace: the KPA rebuilt in Manchuria: ~30,000 (Oct 1950) to "over 197,000" (1 May 1951) (MOSSMAN p.~437; SRC_C C1 §1f). judgment of the rate
  kpaCap: 225,           // resources: the KPA the North could keep in the field, thousands: "about 225,000" (late 1951) (HERMES p.~199; SRC_C C2 §3d)
  pvaIn: { 4.6: 300, 5.8: 450, 7: 450, 10.5: 950, 30: 1450 },   // production: the PVA in Korea (thousands, Chinese count, rear included), keyed on the real entry date and shifted by when China actually enters: ~300,000 (late Oct 1950), ~450,000, ~950,000 (mid-Apr 1951), 1.45M (Dec 1952) (LI-2012 [D secondary]; SRC_C C1 §1g)
  pvaFlow: 150,          // replace: most the PVA can add in Korea per month (thousands): 450,000 → 950,000 in ~3.5 months of 1951 (LI); 377,000 → 642,000 in Nov 1951-Jan 1952 (HERMES p.~198-199; SRC_C C2 §3e). judgment
  pvaTrained: 80,        // replace: trained combat replacements the PVA front draws per month (thousands): 60,000-100,000 from the 1951 army-group rotations (LI [D secondary]; history review r1 #11). judgment
  pvaArms: { 4.6: 0.45, 12: 0.7, 24: 0.9 },   // production: PVA firepower per man (1 = a UN soldier): Nov 1950 "as many as two-thirds of some infantry units lacked" small arms (MOSSMAN p.56); artillery "quintupled" by Apr 1952 (HERMES p.200; SRC_C C2 §2c). judgment of the scale
  sovietArmsCut: 0.55,   // production: PVA firepower if Stalin withholds the 60 divisions' arms (SRC_C C2 §2c). judgment
  supplyCap: { 4.6: 1500, 13: 2400, 25: 3500 },   // resources: tons a day the Communist side can move to a front on the 38th: 2,400 t/day for 60 divisions in summer 1951 (Eighth Army, FUTRELL p.~437); 1950 and 1952-53 judgment (HERMES p.478; SRC_C C1 §3a-b)
  divTons: 40,           // resources: tons a day per Communist division (~10,000 men) in limited combat, "conservatively estimated" (Eighth Army, FUTRELL p.~437); FEAF: 48-50 (SRC_C C1 §3a)
  supplyPerDeg: 0.5,     // resources: Communist supply gained per degree of latitude closer to the Yalu: the PVA "too far into the [enemy's] territory" (Mao; LI p.~75); a quarter of food needs at the Third Phase (LI p.~68; SRC_C C1 §3b). judgment
  endurance: 8,          // resources: days a PVA offensive lasts before supply forces a pause: 9, 9, 8 and 7 days (LI); "obliged to pause ... after a week or so" (MOSSMAN p.~301; SRC_C C1 §3b)
  winterDays: 2,         // resources: days the cold takes off a PVA offensive in Nov-Feb: the 9th Army Group lost ~60% of its losses to cold (secondary accounts [W], F §7: our judgment); 7,313 Marine non-battle casualties (B2 [D]; history review r1 #15). judgment
  interdict: 0.075,      // blockade: share of Communist front supply cut by UN air interdiction in a static war, real level: -5 to -10% (FUTRELL p.~471-474: Weyland "all but 4 or 5 percent" of rail traffic, yet stocks built up; SRC_C C1 §3c). judgment
  interdictMobile: 2,    // blockade: interdiction weighs this much more in a war of movement (FUTRELL p.~704: "the best time for an interdiction campaign was when the ground situation was fluid"; SRC_C C1 §3c). judgment of the factor
  interdictDays: 2,      // blockade: days an extra air campaign takes off a PVA offensive (FUTRELL p.471, p.703; SRC_C C1 §3c). judgment
  manchuria: 0.15,       // blockade: extra share of supply cut when the Manchurian bases and rail are bombed (F §8: MacArthur's 30 Dec measures). judgment
  covertCut: 0.6,        // blockade: share of the Manchurian bombing's effect left when the Soviets defend the bases covertly (history review r1 #18). judgment
  blockadeCut: 0.05,     // blockade: extra share cut by a naval blockade of the China coast: Soviet aid came by rail; British trade through Hong Kong (SCHNABEL via F §8). judgment
  damsCut: 0.25,         // blockade: extra share cut by a dam and flood campaign from Aug 1951: "for" value -25% (FUTRELL p.~667-670, 681; SRC_C C1 §3c). judgment
  winterPVA: 2,          // resources: PVA non-battle losses in winter (Nov-Feb) against the rest of the year: >90% of the 26th Army frostbitten (USMC-III p.~346); 40,000 lost in three weeks at Chosin (LI p.~67; SRC_C C1 §3e). judgment
  pvaNB: 0.01,           // replace: PVA non-battle losses per month outside winter (disease, cold, desertion): 13,000 died of illness over the war (Xu via SRC_C C2 §3c). judgment
};

// mechanics: judgments, varied in the sensitivity table (code review r1 m7: every constant the war reads is here, with its note)
export const MECH = {
  kRatio: 1.2,       // how sharply a battle's odds move with the force ratio against the ratio it really had: a doubling shifts the log-odds by 0.83 (e.g. 0.85 → 0.93). judgment (SRC_B gives the odds at the real ratio only)
  qROK: 0.5,         // a ROK soldier's weight against a US soldier's: ROK II Corps collapsed at Onjong and on 25-26 Nov, the ROK III Corps in May 1951 (MOSSMAN; SRC_B B1 §8, B3 §2c). judgment
  qOther: 1.0,       // other UN contingents (Commonwealth, Turkish) as US troops: Kapyong, the Imjin (SRC_B B3 §1). judgment
  qNat: 0.3,         // Chiang's troops: "the low state of training and lack of equipment" (JCS via SCHNABEL; F §8). judgment
  qKPA50: 0.9,       // the KPA of 1950 with its T-34s and 3:1 artillery (APPLEMAN; SRC_B B1 §1). judgment
  qKPA51: 0.6,       // the rebuilt KPA from Oct 1950 (a third raw recruits by Sep 1950, APPLEMAN p.~393). judgment
  airLoss: 0.2,      // share of UN strength lost without air superiority over the front (FUTRELL: 1,041 UN aircraft lost to enemy action; close support). judgment
  pvaSpeed: 12.5,    // km a day a winning PVA offensive gains: 70 miles in the 9-day Third Phase (SRC_B B2 §4; LI); the Ch'ongch'on, 145-150 miles in 23 days with the UN withdrawing (B2 §1)
  bend: 0.4,         // share of its reach a PVA offensive still gains when the UN holds: the No Name Line after the first Spring impulse (SRC_B B3 §1). judgment
  unAdvance: 0.45,   // degrees a winning UN offensive gains in a month: Killer and Ripper +~70 mi in ~6 weeks (SRC_B B2 §8). judgment, calibrated on it
  unAttack: 0.8,     // the UN attacks only with at least this share of the force ratio the real UN had at that stage (Ridgway's limited advances when the Chinese were spent; SRC_B B2 §5, §8). judgment
  winterAdvance: -0.3, // logit on a UN advance north of the neck in Nov-Feb (the Chosin cold; history review r1 #15). judgment
  pause: 1,          // months the PVA needs between offensives after a win: 19, 7 and 17 days (SRC_C C1 §3b: 21-30 days middle)
  pauseFail: 2,      // ...after a failed offensive: 8 Jan → 11 Feb, Feb → 22 Apr 1951 (MOSSMAN; LI; SRC_C C1 §3b). judgment
  cohLoss: 30,       // Chinese losses (thousands) in a failed offensive above which the PVA loses cohesion: Soyang, ~10,000 prisoners "most of them Chinese" (USMC-IV p.~127 [D]; history review r1 #11). judgment
  cohesion: 0.8,     // ...its front strength for the months after (judgment)
  cohMonths: 2.5,    // ...and how long (judgment)
  ixAG: 120,         // the PVA IX Army Group (thousands) out of the front for three months when X Corps breaks out of Chosin (~120,000 of ~450,000; SRC_B B2 §2; history review r1 #10). judgment of the size
  ixMonths: 3,       // ...months out: the Third Phase was fought without it (SRC_B B2 §2; MOSSMAN [D])
  xCorpsLoss: 20,    // US strength (thousands) not refilled for three months if X Corps is destroyed at Chosin (B2 §2-3: X Corps lifted ~105,000; history review r1 #10). judgment
  xCorpsMod: -0.5,   // logit on the Third Phase after X Corps is destroyed (history review r1 #10). judgment
  defLoss: 150,      // cumulative Chinese losses since entry (thousands) before Mao turns to the defensive, besides two failed offensives: the real turn came after five offensives and Soyang's 60,000-105,000 (history review r2 N1c). judgment
  talksNorth: 0.35,  // talks odds while the UN line is at or north of 39.0: at Kaesong the Communists opened by demanding the 38th as the line [S; HERMES chs. II-V to read] (history review r2 N1a). judgment
  armNorth: 0.5,     // the armistice hazard at or north of 39.0 while Stalin lives (a line in Pyongyang is a different negotiation; history review r2 N1d). judgment
  ammoMod: -0.3,     // logit on a UN-initiated offensive from Jan 1952 to Mar 1953: 155-mm guns held to ~15 then 6-8 rounds a day (HERMES via SRC_G §0, §2.6 [D]); varied 0 to -0.5. judgment of the size
  shockFloor: 0.4,   // the share of the China shock that stays until the 1952 election: Gallup "mistake" never fell below 36% after Jan 1951 (GALLUP-2000 via SRC_C C2 §4a; history review r2 N4). judgment
  buildUp: 0.85,     // the share of the gap to the deployment series closed each month in the 1950 build-up: US ground 178,464 by 23 Nov (MOSSMAN [D] via SRC_C C1 §1a; history review r2 m5). judgment
  xCorpsDeadShare: 0.6, // dead or captured per US casualty when X Corps is destroyed: a destroyed corps yields dead and prisoners, not evacuated wounded (history review r2 m6). judgment
  holdMonths: 12,    // a unified Korea must hold this long to count: the KPA rebuilt in Manchuria to ~200,000 in seven months (MOSSMAN p.~437 via SRC_C C1 §1f; history review r1 #3; DESIGN_v2). judgment
  insurgRok: 0.02,   // ROK casualties per month per thousand KPA in exile during the hold (the insurgency; 7,500 guerrillas still in the South Jul 1951, HERMES p.~78 [D]; history review r1 #3). judgment
  insurgUs: 0.003,   // ...US casualties per month per thousand KPA. judgment
  kpaEscape: 27,     // KPA (thousands) that escape north after Inchon and the breakout: 25,000-30,000 (APPLEMAN p.~604 [D]; SRC_B B1 §6)
  kpaEscNoInchon: 65,  // ...with no Inchon: 50,000-80,000 (history review r1 #8). judgment; varied 50-80
  noInchonCas: 6,    // extra US battle casualties (thousands) of a frontal breakout with no Inchon: 4,000-9,000 (history review r1 #8). judgment; varied 4-9
  inchonFailMod: -0.4, // logit on the lone breakout after a failed Inchon (the landing force's losses, MacArthur's standing; history review r1 #8). judgment
  kpaCollapseCas: 0.4, // share of the KPA that vanishes in a collapse booked as killed, wounded or dispersed; the rest captured (23,620 by 20 Sep, ~30,000 by 1 Oct, 130,921 in the camps by late Nov: Appleman, Mossman via SRC_G §2.4 [D]); SRC_G: vary 0.35-0.6. judgment
  kpaRemnantNorth: 10, // KPA (thousands) left in Korea once the UN or ROK reaches the Yalu (judgment)
  noPauseMod: -0.5,  // logit on Taejon and the perimeter if the KPA does not pause at Seoul (APPLEMAN [D] on the 3-4 days; history review r1 #24). judgment
  perimWeakMod: -0.5, // logit on the breakout from a perimeter that barely held (judgment)
  sovietAirMod: -1.5, // logit on UN air superiority if the Soviets fly openly over the front (judgment)
  hungnamMod: -1.0,  // logit on Hungnam after X Corps is destroyed (judgment)
  china38Held: 0.5,  // China's entry odds on the 38th road when nobody at all goes north (judgment)
  pvaEntry: 300,     // the PVA's first wave (thousands): "about 300,000 men by early November" (LI p.~64 [D secondary]; APPLEMAN p.768; SRC_C C1 §1g)
  withdrawRate: 300, // thousands of PVA a month that leave Korea when China's will breaks (judgment)
  atomicBreak: 0.4,  // share of the PVA combat pool left when an atomic campaign breaks the front (judgment)
  lineTaejonEN: 36.0, perimWeakDrop: 0.4, lineDavidson: 35.4,   // judgment lines (°N) of the summer 1950 battles' results, set from the dated control lines (CONTROL_KR.json: 28 Jun 37.59, 5 Jul 37.28, 20 Jul 36.30, 4 Aug 36.05)
  lineSep: 37.9, lineSlowSep: 37.0, lineOct: 40.0, linePyStall: 38.6, lineRokStrip: 38.15, lineUnsanUN: 0.2, lineUnsanEN: 0.1, lineYaluFail: 39.8,   // judgment lines (°N): end Sep 1950 with and without Inchon; end Oct with Pyongyang taken; a stalled advance; a ROK failure in the north (history review r1 #4: at the 38th, not 65 km north); Unsan (as moves from where Onjong left the line: v3, code review r2 m8)
  lineOutpost: 0.03, lineRidge: 0.03, lineKumsongUN: 0.03, lineKumsongEN: 0.15, lineFourth: 0.3, linePushStop: 0.25, linePushFail: 0.3,   // judgment line moves (degrees)
  mobileDrain: 2.1,  // US battle casualties per month of war of movement outside the named battles (thousands), tuned so the real path's US hostile dead come to ~33,700 (CRS-2020 via SRC_A §11). calibrated
  quietDrain: 1.25,  // US battle casualties in a quiet month of the static war (thousands): US Army KIA+WIA 700/1,000/1,300 (REISTER B-1) × 1.25 for the Marines and Navy (SRC_B B3 §5b). judgment of the factor
  activeDrain: 3.25, // ...in an active outpost month: US Army 2,000/2,600/4,100 (REISTER B-1; SRC_B B3 §5b) × 1.25. judgment of the factor
  activeShare: 0.3,  // share of static months that are active: 6 of 20, Dec 1951-Jul 1953 (REISTER; SRC_B B3 §5b: 0.25/0.30/0.35)
  rokDrain: 1.5,     // ROK casualties in a static month (thousands): UNC 2,500-3,500 quiet (HERMES p.~199) less the US share (SRC_B B3 §5b). judgment
  enDrain: 9,        // Communist casualties in a static month (thousands): 10,000-15,000 UNC estimates (HERMES) × 0.7 for estimates that "probably tend to be excessively high" (SRC_B B3 §5b). judgment
  kpaStaticShare: 0.33, // the North Korean share of the static drain (2 KPA corps in the line and 4 in reserve against the Chinese, 1952: HERMES p.~367-368; v2 raised from 0.2 toward the ROK MND North Korean dead, history review r1 #22). judgment
  pushCas: 20,       // UNC casualties per month of a push to the neck (thousands): Oct 1951 ~20,000 (HERMES p.~508); US share 45% (F §9). judgment of the share
  pushUsShare: 0.45, // ...the US share (F §9). judgment
  deadShare: 0.246,  // US hostile dead per US battle casualty: 33,739 dead, 103,284 wounded (CRS-2020 via SRC_A §11)
  rokDeadShare: 0.23, // ROK dead per ROK casualty: 137,899 dead, 24,495 missing, 450,742 wounded (ROK MND via SRC_A §11 [W])
  enDeadShare: 0.33, // Chinese dead per casualty: 183,108 dead, 25,621 missing, ~340,000 wounded (Xu Yan; SRC_C C2 §3c [W] for the wounded)
  kpaDeadShare: 0.48, // North Korean dead per casualty: 294,151 dead, 229,849 wounded, 91,206 missing (ROK MND via SRC_A §11 [W])
  rokMobile: 34,     // ROK casualties per month of war of movement outside the named battles (thousands), tuned so the real path's ROK dead come to ~138,000 (ROK MND via SRC_A §11 [W]). calibrated
  enMobile: 30,      // Communist casualties per month of war of movement outside the named battles (thousands), tuned so the real path lands in the Chinese range (183,000 China to 400,000+ Western) with the North Korean collapse booked (SRC_C C2 §3c-d). calibrated
  mistake0: 20,      // Gallup "mistake" at the start: 20% (20-25 Aug 1950) (GALLUP-2000; SRC_C C2 §4a)
  willK: 4,          // "mistake" points per e-fold of cumulative US casualties: 6/4/2 (MUELLER-71; SRC_C C2 §4c). judgment
  chinaShock: 25,    // "mistake" points when China's offensive throws the UN back: 20% (Aug 1950) → 49% (Jan 1951) (GALLUP-2000; SRC_C C2 §4a). judgment of the share that is the shock
  shockDecay: 0.8,   // how much of the shock is left each month the Chinese do not win: 49% (Jan-Feb 1951) → 37% (Apr 1951) (GALLUP; SRC_C C2 §4a). judgment
  staticDrain: 1.2,  // "mistake" points per month of static war until the 1952 election, calibrated to Gallup 42% (Aug 1951) → 51% (Mar 1952) with the shock floor; the election resets it (51% → 36% by Jan 1953) (GALLUP-2000 via SRC_C C2 §4a; history review r2 N4). calibrated
  pushTolerance: 50, // Washington stops a costly push when "mistake" passes this (HERMES p.~508; F §9: ~3-4 months). judgment
  pushWill: 3,       // "mistake" points per month of a push (the Oct 1951 casualty rate, ~6× static; F §9). judgment
  willHigh: 50, willMid: 45, willLow: 40,   // "mistake" thresholds at which will moves a decision: evacuation ×1.5 above 50, keeping MacArthur ×1.3 above 45, the push ×1.3 below 40 and ×0.8 above (judgment; SRC_C C2 §4a)
  willEvac: 1.5, willMac: 1.3, willPushUp: 1.3, willPushDown: 0.8,   // ...the factors (judgment)
  powBonus: 0.03,    // extra armistice hazard per month once voluntary repatriation is dropped (HERMES p.~500; SRC_C C2 §4g). judgment
  alliesArm: 0.005,  // extra armistice hazard per month once the allies have left (the UN mandate, NATO cohesion; history review r1 #20). judgment
  alliesStop: 1.5,   // ...and how much likelier Congress and the allies stop a further escalation (history review r1 #20). judgment
  nukeLegacy: 0.85,  // the armistice hazard once a new president leans to escalation (he signals instead of settling). judgment (FRUS-XV doc 536)
  nuke53Esc: 1.3, nuke53Calm: 0.8,   // nuke53 for an escalation-minded president and otherwise (judgment)
  kShare: 0.6,       // the KPA's weight (firepower) when its share of an enemy loss is worked out (judgment)
};

// ---------- the battles (SIM_STANDARD §1, CHECK S1): every major battle is an event; its odds move with the force ratio; its losses and line carry through. loss = [US, ROK, enemy] casualties (thousands) by result.
// real: a battle that was fought (SRC_B's 28 rows); the others are judgment rolls standing for battles that might have been fought (the battle share reports the two apart; history review r1 #16)
export const BATTLES = [
  { id: 'invasion', real: 1, fixed: 1, name: 'the invasion: Seoul', odds: 'invasion', decides: 'how much of the ROK Army survives; Seoul', loss: { UN: [0, 25, 10], EN: [0, 44, 8] } },   // SRC_B #1, B1 §1: ROK 98,000 → 54,000
  { id: 'pusanAlone', real: 0, fixed: 1, name: 'the South alone (no American army)', odds: 'pusanAlone', decides: 'only if America stays out: whether a ROK pocket holds round Pusan', loss: { UN: [0, 15, 15], EN: [0, 40, 10] } },   // F §2. judgment of the losses
  { id: 'osan', real: 1, name: 'Osan (Task Force Smith)', odds: 'osan', decides: 'half a day', loss: { UN: [0.1, 0, 0.3], EN: [0.18, 0, 0.13] } },   // SRC_B #2, B1 §2: ~150-185 of ~540 lost
  { id: 'taejon', real: 1, name: 'the Kum and Taejon', odds: 'taejon', decides: 'where the perimeter forms; the 24th Division', loss: { UN: [0.6, 1, 3], EN: [1.15, 2, 2] } },   // SRC_B #3, B1 §3: 24th Div ~1,150 lost; Dean captured
  { id: 'perimeter', real: 1, name: 'the Pusan Perimeter forms', odds: 'perimeter', decides: 'whether the UN keeps a foothold; the line of the Naktong', loss: { UN: [2, 4, 8], EN: [4, 8, 6] } },   // SRC_B #4, B1 §4a: UN 92,000 v KPA 70,000 at the front
  { id: 'naktong1', real: 1, name: 'the First Naktong Bulge', odds: 'naktong1', decides: 'the KPA 4th Division', loss: { UN: [1.5, 0, 7], EN: [2.5, 0, 4] } },   // SRC_B #5, B1 §4b: KPA 4th Div → 3,500
  { id: 'naktong2', real: 1, name: 'the Great Naktong Offensive', odds: 'naktong2', decides: 'the perimeter; the Davidson Line', loss: { UN: [5, 6, 25], EN: [8, 10, 15] } },   // SRC_B #6, B1 §4d: KPA → ~70,000
  { id: 'davidson', real: 0, name: 'the Davidson Line', odds: 'davidson', ref: 'naktong2', decides: 'only if the perimeter and the Great Naktong both fail: whether Pusan holds', loss: { UN: [4, 6, 15], EN: [10, 15, 8] } },   // B1 §4d; history review r1 #13. judgment of the losses
  { id: 'inchon', real: 1, name: 'Inchon', odds: 'inchon', decides: 'the anvil behind the KPA; Seoul; how many escape north', loss: { UN: [3.5, 0.5, 14], EN: [5, 1, 6] } },   // SRC_B #7, B1 §5: UN ~3,500 casualties
  { id: 'breakout', real: 1, name: 'the breakout and the KPA collapse', odds: 'breakout', decides: 'the KPA left in the north; the 38th', loss: { UN: [5, 5, 45], EN: [6, 6, 15] } },   // SRC_B #8, B1 §6: 25,000-30,000 escape; ~20,000 prisoners
  { id: 'breakoutAlone', real: 0, name: 'the breakout with no Inchon', odds: 'breakoutAlone', ref: 'breakout', decides: 'only with no Inchon: how fast and how many KPA get away', loss: { UN: [6, 6, 35], EN: [8, 8, 12] } },   // history review r1 #8. judgment of the losses
  { id: 'breakoutLate', real: 0, name: 'the October breakout', odds: 'breakoutLate', ref: 'breakout', decides: 'only with no Inchon and a failed September breakout', loss: { UN: [5, 5, 30], EN: [6, 6, 10] } },   // history review r1 #8. judgment
  { id: 'pyongyang', real: 1, name: 'Pyongyang', odds: 'pyongyang', decides: 'the north up to the neck', loss: { UN: [0.5, 1, 10], EN: [1, 2, 5] } },   // SRC_B #9, B1 §7
  { id: 'rokNorth', real: 0, name: 'the ROK alone in the north', odds: 'rokNorth', ref: 'rokOnly', decides: 'only if US troops stop: whether the ROK reaches the Yalu', loss: { UN: [0, 8, 25], EN: [0, 15, 10] } },   // F §3; history review r1 #5
  { id: 'rokOnjong', real: 0, fixed: 1, name: 'the PVA strikes the ROK alone', odds: 'rokOnjong', decides: 'only on the 38th road with China in: the ROK north of the 38th', loss: { UN: [0, 2, 4], EN: [0, 8, 1] } },   // the Onjong losses (SRC_B #10) for a ROK-only army (history review r1 #2)
  { id: 'toYalu', real: 0, name: 'the drive to the Yalu with China out', odds: 'rokNorth', ref: 'rokOnly', decides: 'only if China stays out: the border', loss: { UN: [1, 3, 20], EN: [2, 5, 8] } },   // the rokNorth odds at the ROK-only ratio, so US forces raise them (F §3). judgment
  { id: 'onjong', real: 1, name: 'Onjong', odds: 'onjong', decides: 'the ROK II Corps; the advance on the Yalu', loss: { UN: [0, 1.5, 3], EN: [0, 4, 1] } },   // SRC_B #10, B1 §8
  { id: 'unsan', real: 1, name: 'Unsan', odds: 'unsan', decides: 'the 8th Cavalry; the warning that came too late', loss: { UN: [0.4, 0.5, 3], EN: [0.8, 1, 1.5] } },   // SRC_B #11, B1 §8: 8th Cav ~600 men, 12 howitzers
  { id: 'airSup', real: 1, fixed: 1, name: 'air superiority south of the Ch\'ongch\'on', odds: 'airSup', decides: 'UN close support and interdiction for the rest of the war', loss: { UN: [0, 0, 0], EN: [0, 0, 0] } },   // SRC_B #28, B3 §7b
  { id: 'chongchon', real: 1, name: 'the Ch\'ongch\'on (Kunu-ri)', odds: 'chongchon', decides: 'Eighth Army; whether the UN holds North Korea', loss: { UN: [3, 3, 25], EN: [7, 10, 10] } },   // SRC_B #12, B2 §1: 2d Div -4,940 and -64 guns
  { id: 'winterLine', real: 0, name: 'a prepared winter line (1950-51)', odds: 'winterLine', ref: 'thirdPhase', decides: 'only if the UN digs in: the line the winter holds', loss: { UN: [2, 3, 30], EN: [5, 8, 10] } },   // F §7. judgment of the losses
  { id: 'neckHold', real: 0, name: 'the battle for the neck', odds: 'neckHold', ref: 'chongchon', decides: 'only if the UN halts at the neck: whether the line holds', loss: { UN: [3, 4, 50], EN: [8, 10, 20] } },   // F §4. judgment of the losses
  { id: 'chosin', real: 1, name: 'Chosin', odds: 'chosin', decides: 'X Corps; the PVA IX Army Group for three months', loss: { UN: [6.5, 0.5, 50], EN: [16, 1, 30] } },   // SRC_B #13, B2 §2: X Corps -8,735 battle; PVA IX AG -48,000-52,000
  { id: 'hungnam', real: 1, name: 'Hungnam', odds: 'hungnam', decides: 'whether X Corps gets out', loss: { UN: [0.1, 0, 0.5], EN: [3, 1, 2] } },   // SRC_B #14, B2 §3
  { id: 'thirdPhase', real: 1, name: 'the Third Phase (Seoul lost)', odds: 'thirdPhase', decides: 'Seoul; how far south the UN goes', loss: { UN: [1, 3, 20], EN: [2, 8, 8] } },   // SRC_B #15, B2 §4
  { id: 'twinTunnels', real: 1, name: 'Twin Tunnels', odds: 'twinTunnels', decides: 'PVA losses before the Fourth Phase', loss: { UN: [0.26, 0, 3.6], EN: [1, 0, 1] } },   // SRC_B #16, B2 §6a: PVA ~-3,600 est. v UN -256
  { id: 'hoengsong', real: 1, name: 'Hoengsong', odds: 'hoengsong', decides: 'the ROK 8th Division; the Fourth Phase', loss: { UN: [0.5, 2, 6], EN: [2, 9.8, 4] } },   // SRC_B #17, B2 §7: UN -11,862 (ROK -9,844)
  { id: 'chipyongni', real: 1, name: 'Chipyong-ni', odds: 'chipyongni', decides: 'the Fourth Phase; "the turning point"', loss: { UN: [0.35, 0, 5], EN: [3, 0, 2] } },   // SRC_B #18, B2 §6: PVA ~-4,946 v UN -344
  { id: 'wonju', real: 1, name: 'Wonju', odds: 'wonju', decides: 'the Fourth Phase', loss: { UN: [0.5, 0.5, 6.35], EN: [2, 2, 2] } },   // SRC_B #19, B2 §7c: PVA ~-6,350 est.
  { id: 'killerRipper', real: 1, name: 'Killer and Ripper (Seoul retaken)', odds: 'killerRipper', decides: 'Seoul; the line back to the 38th', loss: { UN: [5, 5, 30], EN: [6, 6, 8] } },   // SRC_B #20, B2 §8
  { id: 'spring1', real: 1, name: 'the Spring Offensive, first impulse (Imjin, Kapyong)', odds: 'spring1', decides: 'Seoul again; the No Name Line', loss: { UN: [4, 5, 35], EN: [7, 10, 20] } },   // SRC_B #21, B3 §1
  { id: 'spring2', real: 1, name: 'the Spring Offensive, second impulse (Soyang)', odds: 'spring2', decides: 'whether the PVA is broken in the open; the talks', loss: { UN: [3, 10, 60], EN: [6, 20, 30] } },   // SRC_B #22, B3 §2: Communist losses est. 60,000-105,000
  { id: 'counter51', real: 1, name: 'the May-June counter-offensive', odds: 'counter51', decides: 'the Kansas-Wyoming line', loss: { UN: [3, 3, 20], EN: [4, 4, 6] } },   // B3 §2e. judgment of the losses
  { id: 'tongchon', real: 0, name: 'the T\'ongch\'on envelopment', odds: 'tongchon', ref: 'counter51', decides: 'only on the push north: two CPV armies', loss: { UN: [3, 1, 60], EN: [5, 2, 20] } },   // F §9. judgment of the losses
  { id: 'pushNeck', real: 0, name: 'the push to the neck', odds: 'pushNeck', ref: 'counter51', decides: 'only on the push north: the neck by November', loss: { UN: [6, 6, 60], EN: [8, 8, 30] } },   // F §9; the monthly push cost is added each month (MECH.pushCas)
  { id: 'ridges', real: 1, name: 'Bloody Ridge and Heartbreak Ridge', odds: 'ridges', decides: 'the Punchbowl; the cost of the limited offensives', loss: { UN: [6, 2, 40], EN: [7, 3, 25] } },   // SRC_B #23, B3 §3
  { id: 'commando', real: 1, name: 'Commando (the Jamestown line)', odds: 'commando', decides: 'the Jamestown line', loss: { UN: [4, 1, 20], EN: [5, 2, 10] } },   // SRC_B #24, B3 §4
  { id: 'blackThursday', real: 1, fixed: 1, name: 'Black Thursday (MiG Alley)', odds: 'blackThursday', decides: 'daylight B-29 raids; how hard the rail war bites', loss: { UN: [0.1, 0, 0], EN: [0.1, 0, 0] } },   // SRC_B #27, B3 §7c
  { id: 'outposts', real: 1, name: 'the outpost war (an active month)', odds: 'outposts', decides: 'a few hills; the monthly cost', loss: { UN: [0.5, 0.5, 3], EN: [1, 1, 2] } },   // SRC_B #25, B3 §5. judgment of the event losses (the drain is separate)
  { id: 'kumsong', real: 1, name: 'Kumsong', odds: 'kumsong', decides: 'the last Chinese offensive; the line at the armistice', loss: { UN: [1, 12, 40], EN: [2, 25, 30] } },   // SRC_B #26, B3 §6: ROK/UNC 14,000-30,000
  { id: 'kpaReturn', real: 0, name: 'the KPA comes back from Manchuria', odds: 'holdNorth', ref: 'rokOnly', decides: 'only during the hold: whether the north stays held', loss: { UN: [0.5, 6, 15], EN: [1, 15, 6] } },   // history review r2 N3. judgment of the losses
  { id: 'pvaOff', real: 0, name: 'a Chinese offensive', odds: 'prepared51', decides: 'any PVA offensive outside the real windows: the line; Seoul', loss: { UN: [3, 6, 40], EN: [6, 12, 20] } },   // generic: F §1 input 7 (1951 on) or the winter line (F §7); reference: the real ratio at that stage
  { id: 'unOff', real: 0, name: 'a UN offensive', odds: 'counter51', decides: 'any UN advance outside the real windows', loss: { UN: [3, 3, 20], EN: [4, 4, 6] } },   // generic: the Killer-Ripper odds (SRC_B #20); reference: the real ratio at that stage
];
export const BMAP = Object.fromEntries(BATTLES.map(b => [b.id, b]));
export const baseOf = id => { const s = String(id).split('@')[0]; return BMAP[s] ? s : s.replace(/\d+$/, ''); };
// what kind of choice each rolled name is, for "What decided it"
export const KIND = { usIntervenes: 'us', latePusanEntry: 'us', oneCommand: 'us', inchonPlan: 'us', heedPanikkar: 'us', stop38IfHeeded: 'us', neckIfHeeded: 'us', crossAnyway: 'us', crossWinter: 'us', rokStopped: 'us', haltNeck: 'us', readsUnsan: 'us', digIn: 'us', recross: 'us', crossLater: 'us',
  nukeWinter: 'us', bombManchuria: 'us', nationalists: 'us', evacuate: 'us', evacDavidson: 'us', macArthurKept: 'us', blockadeAlone: 'us', nukeMac: 'us', pushNorth: 'us', talks: 'us', powConcession: 'us', newPresidentArmistice: 'us', nuke53: 'us',
  kpaNoPause: 'other', chinaYalu: 'other', china38: 'other', chinaNeck: 'other', chinaAssured: 'other', shield38: 'other', shieldNeck: 'other', shieldLater: 'other', lateChina: 'other', shieldLater38: 'other', rheeDefies: 'other', kpaReturn: 'other', chinaBreakNeck: 'other', sovietGround: 'other', sovietFrontAir: 'other', sovietCovert: 'other', sovietOvertAir: 'other', sovietOvertMac: 'other', sovietNukeEntry: 'other', alliesLeave: 'other', alliesNuke: 'other', chinaBreak: 'other', escalationStopped: 'other',
  usRearm: 'us', sovietArms: 'other', damsEarly: 'us', atomicFront: 'luck', activeMonth: 'luck', armStalin: 'ends', armAfter: 'ends', armNeck: 'ends' };
export const REMOVES_QUESTION = new Set(['usIntervenes', 'latePusanEntry', 'sovietGround', 'sovietOvertAir', 'sovietOvertMac', 'sovietNukeEntry']);   // flips that end the question by definition (no American war; an overt Soviet entry = WIDER WAR)
export const DEFINES_OUTCOME = new Set(['chinaYalu', 'china38', 'chinaNeck', 'chinaAssured', 'lateChina']);   // China's entry rolls: a unified Korea is defined by China staying out, so flipping them decides by definition (code review r2 N6)
export const NOT_REAL_DECISIONS = new Set(['talks', 'armStalin', 'armAfter', 'armNeck', 'activeMonth']);   // left free in the honest S1 check: when talks open and which month the armistice is signed (code review r2 N5)

// ---------- the dice
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function warSeed(base, i) { let h = (base * 2654435761 + i * 40503 + 0x9e3779b9) >>> 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) >>> 0; h ^= h >>> 16; return h >>> 0; }
export function keyed(seed0) { return key => { let h = (seed0 ^ 0x811c9dc5) >>> 0; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15; return (h >>> 0) / 4294967296; }; }
const HAZ = new Set(['latePusanEntry', 'evacuate', 'shield38', 'shieldNeck', 'shieldLater', 'shieldLater38', 'talks', 'armStalin', 'armAfter', 'armNeck', 'activeMonth', 'chinaBreak', 'chinaBreakNeck', 'lateChina', 'kpaReturn', 'resume']);   // per-month hazards: luck by month
const KEYS = new WeakMap(), keysOf = tb => { let k = KEYS.get(tb); if (!k) { k = Object.keys(tb).map(Number).sort((a, b) => a - b); KEYS.set(tb, k); } return k; };
export const lerp = (tb, x) => { const ks = keysOf(tb); if (x <= ks[0]) return tb[ks[0]]; for (let i = 0; i < ks.length - 1; i++) if (x < ks[i + 1]) { const f = (x - ks[i]) / (ks[i + 1] - ks[i]); return tb[ks[i]] * (1 - f) + tb[ks[i + 1]] * f; } return tb[ks[ks.length - 1]]; };
const fallTo = (x, tau = 99) => { for (const l of LINES) if (l <= x + 1e-9 && !(l === LAT.kansas && tau < 9.5)) return l; return LAT.pusan - 0.1; };   // the first defensible line at or south of x (Kansas exists from Apr 1951)
const isWinter = m => [10, 11, 0, 1].includes((5 + m) % 12);   // Nov-Feb, on the calendar

// ---------- the reference force ratios: each named battle's ratio, and each story month's, on the model's own real path (median of 300 real wars). At that ratio a battle's odds are the source's
let REF = null; export function resetRef() { REF = null; }
function ensureRef() { const col = {}; REF = {}; const P0 = oddsFor('mid'); for (let i = 0; i < 300; i++) war(P0, rng(warSeed(424242, i)), { __real: { until: 999 }, __calib: col }); for (const [k, a] of Object.entries(col)) { a.sort((x, y) => x - y); REF[k] = a[a.length >> 1]; } }
export const refRatios = () => { if (!REF) ensureRef(); return { ...REF }; };

// ---------- one war
export function war(P, R, H = {}) {
  if (!REF && !H.__calib) ensureRef();
  const E = H.__econ ? { ...ECONOMY, ...H.__econ } : ECONOMY, M = H.__mech ? { ...MECH, ...H.__mech } : MECH;   // H.__econ / __mech: one war with another economy or mechanic, measured against the same real path (the economy flips)
  const ev = [], path = [], trace = H.__trace ? [] : null, btl = {}, bq = {}, rolls = {}, NTH = {}, mq = {}, dice = H.__dice ? [] : null, U0 = keyed(Math.floor(R() * 4294967296));
  const U = key => { const u = U0(key); if (dice) dice.push([key, u, S.t]); return u; };
  const S = { t: 0, m: 0, tau: 0, lag: 0, line: 38.0, us: 0, rok: E.rokArmy[0], oth: 0, nat: 0, kpa: E.kpa0, pva: 0, pvaC: 0, intervened: false, entryT: 0, chinaIn: false, chinaT: null, mode: null, stopAt: null, xcorps: false,
    airLost: false, dayRaids: true, usCas: 0, rokCas: 0, kpaCas: 0, pvaCas: 0, shock: 0, staticM: 0, lastPva: -9, lastPvaWon: false, pvaFails: 0, talks: false, push: 0, yaluSince: null, retreatTo: null,
    mob: false, manchuria: false, covert: false, blockade: false, dams: false, alliesOut: false, macPath: false, esc53: false, powConc: false, armsCut: false, kpaBroken: false, cost: 0, mistake: M.mistake0, assured: false,
    unFails: 0, unCan: true, defensive: false, chosinDone: false, prepared: false, perimWeak: false, rokHeld: false, oneCmd: false, recross: false, nuke: false, nukeBroke: false, ixUntil: -1, usDownUntil: -1, cohUntil: -1, delayed: false, econTau: -1, usNorth: false, pvaLoss0: 0, lineStatic: 0, lastLine: 38, usDeadAdd: 0, yaluStart: null, kpaPOW: 0, entryLag: 0, floorOn: true };
  const Y = () => monthName(S.t);
  const tmp = { T: 0, M: 0, C: 0, S: 0 };
  for (const k of ['T', 'M', 'C', 'S']) tmp[k] = ('temper' + k in H) ? H['temper' + k] : (U('temper' + k) - 0.5) * 2 * P.temperSd;
  const tilt = (p, s) => p <= 0 ? 0 : p >= 1 ? 1 : sig(logit(p) + s);
  // a decision: keyed by name, site and roll count (one-off) or by name and month (hazard); forced by H[name:site], H[name@month] or H[name]; every rolled event recorded under its own flip key
  const roll = (name, p, t, site = '') => { S.t = t; const tau = t - S.lag, mo = Math.floor(t), sk = site ? name + ':' + site : name, haz = HAZ.has(name), fk = haz ? name + '@' + mo : sk;
    const nth = NTH[sk] = (NTH[sk] ?? -1) + 1, u = U(haz ? name + (site ? ':' + site : '') + '@' + mo : sk + '#' + nth); let v;
    if (fk in H) v = !!H[fk]; else if (sk !== name && sk in H) v = !!H[sk]; else if (name in H) v = !!H[name];
    else { const r = (H.__real && t < H.__real.until) || (H.__realDec && !NOT_REAL_DECISIONS.has(name)) ? (REALQ[name] ? REALQ[name](tau, S, t) : undefined) : undefined; v = r !== undefined ? !!r : u < p; }   // H.__realDec: every decision at its real choice (the honest S1 check)
    rolls[fk] = v; return v; };
  const say = s => path.push(`${Y()}: ${s}`), mark = e => { if (!ev.includes(e)) { ev.push(e); mq[e] = S.t; } };
  const finish = (o, why) => { if (why) say(why); const dead = S.usCas * M.deadShare + S.usDeadAdd;
    return { outcome: o, ev, mq, path, trace, btl, bq, rolls, dice, t: S.t, y: yearOf(S.t), line: S.line, usCas: S.usCas, usDead: dead, rokDead: S.rokCas * M.rokDeadShare, pvaDead: S.pvaCas * M.enDeadShare, kpaDead: S.kpaCas * M.kpaDeadShare, rokCas: S.rokCas, pvaCas: S.pvaCas, kpaCas: S.kpaCas,
      cost: S.cost, stopAt: S.stopAt, chinaIn: S.chinaIn || ev.includes('China enters'), mistake: S.mistake, temper: tmp, wider: S.wider || null, nuke: S.nuke, nukeBroke: S.nukeBroke, entryT: S.entryT, lag: S.lag, held: S.yaluSince !== null && S.held, chinaNow: S.chinaIn, mode: S.mode, yaluStart: S.yaluStart, nukeT: S.nukeT ?? null, kpaPOW: S.kpaPOW, usNorth: S.usNorth }; };
  // ---- forces and the force ratio (on the story clock)
  const T = () => S.t - S.lag;
  const qPVA = () => (S.armsCut ? Math.min(E.sovietArmsCut, lerp(E.pvaArms, T())) : lerp(E.pvaArms, T())) * (T() < S.cohUntil ? M.cohesion : 1);
  const extraCut = () => (S.manchuria ? E.manchuria * (S.covert ? E.covertCut : 1) : 0) + (S.blockade ? E.blockadeCut : 0) + (S.dams ? E.damsCut : 0);
  const supplyF = () => Math.max(0.3, 1 + E.supplyPerDeg * (S.line - LAT.p38));
  const pvaFront = () => { if (S.pva <= 0) return 0; const mobile = !S.talks, cut = E.interdict * (mobile ? E.interdictMobile : 1) * (S.airLost ? 0.3 : 1) * (S.dayRaids ? 1 : 0.85) + extraCut();
    const cap = lerp(E.supplyCap, T()) * supplyF() * Math.max(0.2, 1 - cut); return Math.max(0, Math.min(S.pvaC - (T() < S.ixUntil ? M.ixAG : 0), cap / E.divTons * 10)); };
  const unSupply = () => Math.max(0.5, 1 - E.unSupplyPerDeg * Math.max(0, S.line - LAT.p38) * dpow(0.5, S.lineStatic / E.supplyRebuild));   // rebuilt on a static line (history review r2 m8)
  const unEff = () => (S.us + S.rok * M.qROK + S.oth * M.qOther + S.nat * M.qNat) * (S.airLost ? 1 - M.airLoss : 1) * unSupply();
  const qK = () => T() < 4 ? M.qKPA50 : M.qKPA51;
  const enEff = () => S.kpa * qK() + pvaFront() * qPVA();
  const ratio = o => ((o.rokOnly || (S.stopAt === '38' && !S.usNorth && S.intervened && S.line > LAT.p38 + 0.05)) ?   /* north of the 38th on the 38th road the ROK fights alone until US troops go north (history review r2 m7, N3c) */ S.rok * M.qROK * unSupply() : unEff()) / Math.max(1, o.kpaOnly ? S.kpa * qK() : enEff());
  const pin = id => { const b = baseOf(id); for (const k of ['win_' + id, 'win_' + id.split('@')[0], 'win_' + b]) if (k in H) { const r = H[k]; if (r !== 'UN' && r !== 'EN') throw new Error('bad pin ' + k + ': ' + r); return r; }
    if (H.__real && S.t < H.__real.until && REALQ['win_' + b]) return REALQ['win_' + b](T(), S); return undefined; };
  // a battle: P(UN wins) = the source's middle at the real force ratio, moved by the ratio this war has, plus o.mod; losses by result, scaled by luck. Dice keyed by the battle's id (with its time for monthly and generic ones)
  const fight = (id, t, o = {}) => { S.t = t; const b = BMAP[baseOf(id)], Rr = ratio(o), refKey = o.refKey || b.ref || b.id;
    if (H.__calib) { (H.__calib[b.id] = H.__calib[b.id] || []).push(Rr); if (o.calibAlso) for (const [k, v] of Object.entries(o.calibAlso)) (H.__calib[k] = H.__calib[k] || []).push(v); }
    const ref = REF && REF[refKey] ? REF[refKey] : Rr, p0 = P[o.odds || b.odds], lp = logit(p0) + (o.noRatio ? 0 : M.kRatio * Math.max(-2, Math.min(2, dlog(Rr / ref)))) + (o.mod || 0), pUN = sig(lp);
    let r = pin(id); if (r === undefined) r = U('battle:' + id) < pUN ? 'UN' : 'EN';
    const j = (0.7 + 0.6 * U('loss:' + id)) * (o.lossMul || 1), L = b.loss[r]; S.usCas += L[0] * j; S.us = Math.max(0, S.us - L[0] * j); S.rok = Math.max(5, S.rok - L[1] * j); S.rokCas += L[1] * j;
    const en = L[2] * j, kS = S.pva > 0 ? Math.min(1, S.kpa * M.kShare / Math.max(1, S.kpa * M.kShare + pvaFront() * qPVA())) : 1; S.kpa = Math.max(0, S.kpa - en * kS); S.kpaCas += en * kS; const pl = en * (1 - kS); S.pva = Math.max(0, S.pva - pl); S.pvaC = Math.max(0, S.pvaC - pl); S.pvaCas += pl;
    btl[id] = r; bq[id] = t; mark(b.name + (o.tag || '') + ': ' + (r === 'UN' ? 'the UN wins' : (S.chinaIn && T() > 4.5 ? 'the Chinese win' : 'the North Koreans win'))); return { r, pvaLoss: pl }; };
  const F = (id, t, o) => fight(id, t, o).r;
  const collapseKPA = to => { const drop = Math.max(0, S.kpa - to); S.kpa = Math.min(S.kpa, to); S.kpaCas += drop * M.kpaCollapseCas; S.kpaPOW += drop * (1 - M.kpaCollapseCas); };   // the vanished KPA booked: killed, wounded, dispersed; the rest captured
  // a Chinese offensive gains its reach (days of supply × speed × supply); the UN falls back to the first defensible line beyond it, over about a month
  const reach = () => Math.max(3, E.endurance - E.interdictDays * Math.min(2, extraCut() / 0.15) - (isWinter(Math.floor(S.t)) ? E.winterDays : 0)) * M.pvaSpeed / 111 * Math.min(1, supplyF());
  const pvaWins = () => { const was = S.line, to = fallTo(S.line - reach(), T()); S.retreatTo = to; S.line = was - (was - to) * Math.min(1, Math.floor(S.t) + 1 - S.t); S.lastPvaWon = true; S.pvaFails = 0;
    if (was - to >= 0.5 && S.shock < M.chinaShock * 0.6) S.shock = M.chinaShock; };   // the shock is tested on the whole fallback (history review r1 #12)
  const evacCheck = t => { if (T() >= 6 && Math.min(S.line, S.retreatTo ?? 99) <= LAT.naktong + 1e-9 && roll('evacuate', tilt(P.evacuate * (S.mistake > M.willHigh ? M.willEvac : 1), -tmp.T), t)) { mark('the UN evacuates Korea'); return true; } return false; };
  const lost = t => { if (S.retreatTo !== null && S.retreatTo < LAT.pusan) { S.line = S.retreatTo; S.retreatTo = null; } if (S.line < LAT.pusan) { mark('the UN is pushed into the sea'); return finish(O_LOSS, 'the last UN forces are driven off the peninsula'); } if (evacCheck(t)) return finish(O_LOSS, 'Washington orders the evacuation to Japan'); return null; };
  const widerWar = (why, t) => { S.t = t; S.wider = why; mark('WIDER WAR: ' + why); return finish(O_WIDER, why); };
  // atomic use: a flagged state, not an end (history review r1 #19). An overt Soviet answer ends the run; otherwise the front may break, the allies may go, and the war goes on
  const nuclear = (site, t) => { S.nuke = true; S.nukeT = t; mark('atomic bombs used'); say('the United States uses atomic bombs (' + site + ')');
    if (roll('sovietNukeEntry', tilt(P.sovietNukeEntry, tmp.S), t + 0.01, site)) return widerWar('the Soviets enter openly after the atomic bombs', t + 0.01);
    if (!S.alliesOut && roll('alliesNuke', P.alliesNuke, t + 0.02, site)) { S.alliesOut = true; mark('the allies leave'); }
    if (S.chinaIn && roll('atomicFront', P.atomicFront, t + 0.03, site)) { S.nukeBroke = true; S.pvaC *= M.atomicBreak; S.defensive = true; S.talks = false; S.stopAt = 'yalu'; S.unFails = 0; S.mode = 'attack'; mark('the atomic campaign breaks the front'); }
    return null; };
  // ---- the month's economy on the story clock: deployments (only after America is in), replacement, rebuilding, the Chinese build-up and the cold (calendar)
  const econ = m => { const tau = m + 0.5 - S.lag, winter = isWinter(m), adv = tau > S.econTau + 1e-9; if (adv) S.econTau = tau;   // a month in which the story stands still (a delay) brings no deployments, refills or build-up: only the losses go on (code review r1 M6)
    if (adv && S.intervened && m + 0.5 >= S.entryT) { const late = S.entryT > 0.5, tt = late ? tau - (S.entryT - S.entryLag) + 1.5 : tau;   // a late entry deploys from the start of the series, on the story clock (code review r2 m7)   // a late entry deploys from the start of the series at the entry date (code review r1 M5)
      const full = S.mob || tt < 5.75, base = full ? lerp(E.usGround, tt) : Math.min(lerp(E.usGround, tt), E.usHold), tgt = base + ((S.macPath || S.push) ? E.usExtra : 0) - (tau < S.usDownUntil ? M.xCorpsLoss : 0);
      S.us = S.us < tgt ? Math.min(tgt, S.us + (tt < 6 ? Math.max(E.usRepl, (tgt - S.us) * M.buildUp) : E.usRepl)) : tgt;   // the 1950 build-up follows the deployments; after it, replacements only (history review r1 #11)
      S.oth = S.alliesOut ? 0 : lerp(E.otherUN, tt); }
    const rokT = S.intervened ? lerp(E.rokArmy, tau) : Math.min(lerp(E.rokArmy, tau), 98); if (adv && S.rok < rokT) S.rok = Math.min(rokT, S.rok + (tau >= 3 && tau < 6 ? E.rokSurge : E.rokRebuild));
    if (!adv) { /* frozen */ } else if (tau < 3.5 && !S.kpaBroken) S.kpa += E.kpaRepl; else if (((S.chinaIn && S.mode !== 'withdrawn') || S.yaluSince !== null) && S.kpa < E.kpaCap) S.kpa = Math.min(E.kpaCap, S.kpa + E.kpaRebuild);   // the KPA rebuilt in Manchuria, also during the hold (history review r1 #3)
    if (S.chinaIn && S.mode !== 'withdrawn') { const tgt = lerp(E.pvaIn, 4.6 + (tau - S.chinaT)) * (S.manchuria ? 1 - E.manchuria * (S.covert ? E.covertCut : 1) : 1); if (adv && S.pva < tgt) S.pva = Math.min(tgt, S.pva + E.pvaFlow); S.pva *= 1 - E.pvaNB * (winter ? E.winterPVA : 1);
      if (adv) S.pvaC = Math.min(S.pva, S.pvaC + E.pvaTrained); S.pvaC *= 1 - E.pvaNB * (winter ? E.winterPVA : 1); }
    if (S.mode === 'withdrawn') { S.pva = Math.max(0, S.pva - M.withdrawRate); S.pvaC = Math.min(S.pvaC, S.pva); } };
  const enterChina = (tau, mode) => { S.chinaIn = true; S.chinaT = tau; S.mode = mode; S.pva = M.pvaEntry; S.pvaC = M.pvaEntry; S.pvaLoss0 = S.pvaCas; if (S.yaluSince !== null) { S.yaluSince = null; S.held = false; } mark('China enters'); };   // a late entry resets the hold (code review r2 N1)

  // ======== June 1950: the invasion and Washington's answer
  S.t = 0; say('the KPA crosses the 38th parallel');
  { const r = F('invasion', 0.05, { noRatio: true }); if (r === 'EN') say('Seoul falls; the ROK Army is down to about half'); }   // the line is set by Taejon a month later (v2: the Seoul and Osan lines never outlived the month)
  S.noPause = roll('kpaNoPause', P.kpaNoPause, 0.08); if (S.noPause) mark('the KPA drives on without pausing at Seoul');
  S.intervened = roll('usIntervenes', tilt(P.usIntervenes, 0.5 * tmp.T), 0.1);
  if (!S.intervened) { mark('America stays out'); say('Truman keeps American forces out');
    const r = F('pusanAlone', 2.0, { noRatio: true });
    if (r === 'EN') { S.t = 3; S.line = LAT.pusan - 0.2; mark('the South falls'); return finish(O_OUT, 'the KPA takes all of South Korea'); }
    mark('a ROK pocket holds round Pusan'); S.line = LAT.naktong;
    if (roll('latePusanEntry', tilt(P.latePusanEntry, 0.5 * tmp.T), 3.0)) { S.intervened = true; S.lag = 1; S.entryT = 3.0; S.entryLag = 1; } else if (roll('latePusanEntry', tilt(P.latePusanEntry, 0.5 * tmp.T), 6.0)) { S.intervened = true; S.lag = 4; S.entryT = 6.0; S.entryLag = 4; }
    if (!S.intervened) { S.t = 8; mark('the South falls'); return finish(O_OUT, 'the Pusan pocket falls without America'); }
    S.t = S.entryT; mark('America enters late'); say('America enters the war late, to hold the pocket'); }
  else mark('America intervenes');
  S.oneCmd = roll('oneCommand', tilt(P.oneCommand, -tmp.M), 0.3); if (S.oneCmd) mark('one command: X Corps under Eighth Army');

  for (S.m = 1; S.m < MN; S.m++) {
    const m = S.m; S.t = m; if (m >= (H.__until ?? 999)) break;
    if (S.retreatTo !== null) { S.line = Math.min(S.line, S.retreatTo); S.retreatTo = null; }
    econ(m); const L = m - S.lag; S.t = m + 0.5; const tauI = Math.max(0, Math.min(37, L));
    if (H.__calib) (H.__calib['m' + tauI] = H.__calib['m' + tauI] || []).push(ratio({}));   // the real path's force ratio by story month: the reference for generic battles (carried past month 37; code review r1 m3)
    const refM = REF && REF['m' + tauI] || 1, moveBefore = S.line, pvaBefore = S.lastPva, winterNow = isWinter(m);
    // ======== the summer of 1950 (on the story clock; a late entry starts at the perimeter, the pocket already on the Naktong)
    if (L === 1 && S.entryT === 0) { F('osan', m + 0.13); const r2 = F('taejon', m + 0.6, { mod: S.noPause ? M.noPauseMod : 0 }); S.line = r2 === 'UN' ? LAT.kum : M.lineTaejonEN; if (r2 === 'EN') say('Taejon falls; General Dean is captured'); }
    if (L === 2) { const r = F('perimeter', m + 0.1, { mod: S.noPause ? M.noPauseMod : 0 }); if (r === 'UN') S.line = Math.max(LAT.naktong, S.line - 0.1); else { S.line = S.line - M.perimWeakDrop; S.perimWeak = true; mark('the perimeter barely holds'); say('the KPA envelops the west of the perimeter; Pusan is threatened'); }
      if (F('naktong1', m + 0.4) === 'EN') S.line -= 0.05; }
    if (L === 3) {
      if (F('naktong2', m + 0.05) === 'EN') { S.line = M.lineDavidson; mark('back on the Davidson Line');
        if (S.perimWeak) { if (F('davidson', m + 0.08) === 'EN') { S.line = LAT.pusan - 0.1; mark('the UN is pushed into the sea'); return finish(O_LOSS, 'the perimeter breaks; Pusan falls'); } }
        else if (roll('evacDavidson', P.evacDavidson, m + 0.1)) { mark('the UN evacuates Korea'); return finish(O_LOSS, 'the perimeter collapses; Pusan is evacuated'); }
        S.perimWeak = true; }
      S.kpa += E.kpaTraining;   // the replacements in training in the North, overrun in the collapse (SRC_G)
      const plan = roll('inchonPlan', tilt(P.inchonPlan, tmp.M), m + 0.12); let landed = false, mod = S.perimWeak ? M.perimWeakMod : 0;
      if (plan) { if (F('inchon', m + 0.47) === 'UN') { landed = true; S.xcorps = true; say('X Corps lands at Inchon'); } else { mark('Inchon fails'); say('the Inchon landing fails'); mod += M.inchonFailMod; } }
      else { mark('no Inchon'); say('no landing: Eighth Army must break out alone'); }
      if (landed) { if (F('breakout', m + 0.6, { mod }) === 'UN') { S.line = M.lineSep; collapseKPA(M.kpaEscape); S.kpaBroken = true; mark('the KPA collapses'); say('the KPA collapses; Seoul is retaken'); } else { S.line = Math.max(S.line, LAT.kum); say('the breakout stalls'); } }
      else { S.xcorps = !plan; S.usCas += M.noInchonCas * (plan ? 0.5 : 1); const r = F('breakoutAlone', m + 0.6, { mod }); if (r === 'UN') { S.line = M.lineSlowSep; collapseKPA(M.kpaEscNoInchon + 30); say('the KPA falls back north, fighting'); } else { S.line = Math.max(S.line, LAT.kum); S.slowBreak = true; say('the breakout stalls'); } }
    }
    // the UN still short of the 38th: the slower road north costs a month at a time (code review r1 M6: on the story clock nothing is gained by it)
    const short = L === 4 && S.line < 37.8 && !S.recross; if (short) { const r = S.slowBreak ? F('breakoutLate', m + 0.5) : F('unOff@' + (m + 0.5).toFixed(2), m + 0.5, { refKey: 'm' + tauI, tag: ' (to the 38th)' });
      S.slowBreak = false; if (r === 'UN') { S.line = M.lineSep; S.kpaBroken = true; collapseKPA(M.kpaEscNoInchon); if (!ev.includes('the KPA collapses')) mark('the KPA collapses'); } else S.line = Math.max(S.line, 36.8); S.lag++; S.usCas += M.noInchonCas * 0.5; }
    const delay = L === 4 && !short && H.__delay && !S.delayed; if (delay) { S.delayed = true; S.lag++; }   // a pure one-month delay (the M6 test)
    // ======== October 1950: the 38th, the warning, the Chinese decision (or a re-crossing a month or two later)
    if (L === 4 && !short && !delay) {
      let crossed;
      if (S.recross) { crossed = true; S.stopAt = 'yalu'; mark('the UN crosses the 38th after all'); S.recross = false;
        if (!S.chinaIn) { if (roll('chinaYalu', tilt(P.chinaYalu, tmp.C), m + 0.4, 'recross')) { enterChina(L + 0.4, 'attack'); say('the PVA crosses the Yalu in secret'); S.mob = roll('usRearm', P.usRearm, m + 0.45, 'recross'); if (!S.mob) mark('Congress does not fund the full build-up'); S.armsCut = !roll('sovietArms', P.sovietArms, m + 0.46, 'recross'); if (S.armsCut) mark('Stalin withholds the arms'); } else mark('China stays out'); }
        else S.mode = 'attack'; }
      else {
        const heed = roll('heedPanikkar', tilt(P.heedPanikkar, -tmp.T), m + 0.05); if (heed) mark('Panikkar\'s warning heeded');
        const winterCross = m + 0.2 >= 5.5;   // the 38th reached after 15 Nov (calendar)
        if (heed) { if (roll('stop38IfHeeded', P.stop38IfHeeded, m + 0.1)) { crossed = false; S.stopAt = '38'; } else { crossed = true; S.stopAt = 'neck'; S.assured = roll('neckIfHeeded', P.neckIfHeeded, m + 0.12); if (!S.assured) S.stopAt = 'yalu'; } }
        else { crossed = winterCross ? roll('crossWinter', tilt(P.crossWinter, 0.5 * (tmp.T + tmp.M)), m + 0.2) : roll('crossAnyway', tilt(P.crossAnyway, 0.5 * (tmp.T + tmp.M)), m + 0.2); if (!crossed) S.stopAt = '38'; else S.stopAt = roll('haltNeck', tilt(P.haltNeck, -tmp.M), m + 0.3) ? 'neck' : 'yalu'; }
        if (S.stopAt === '38') { S.line = Math.max(S.line, LAT.p38); S.rokHeld = roll('rokStopped', P.rokStopped, m + 0.32); mark(S.rokHeld ? 'everyone stops at the 38th' : 'the UN stops at the 38th; the ROK goes north'); }
        else if (S.stopAt === 'neck') mark(S.assured ? 'the UN stops at the neck, with assurances to Peking' : 'the UN stops at the neck');
        else mark('the drive to the Yalu');
        // China decides on 13 Oct when US troops are north of the 38th (or nobody is north at all); on the 38th road with the ROK north, when the ROK nears the Yalu (history review r1 #1)
        if (crossed || S.rokHeld) { const pC = S.stopAt === '38' ? P.china38 * M.china38Held : S.stopAt === 'neck' ? (S.assured ? P.chinaAssured : P.chinaNeck) : P.chinaYalu, cname = S.stopAt === '38' ? 'china38' : S.stopAt === 'neck' ? (S.assured ? 'chinaAssured' : 'chinaNeck') : 'chinaYalu';
          if (roll(cname, tilt(pC, tmp.C), m + 0.4)) { enterChina(L + 0.4, S.stopAt === 'yalu' ? 'attack' : 'shield'); say(S.mode === 'attack' ? 'the PVA crosses the Yalu in secret' : 'the PVA crosses the Yalu and digs in as a shield');
            S.mob = roll('usRearm', P.usRearm, m + 0.45); if (!S.mob) mark('Congress does not fund the full build-up'); S.armsCut = !roll('sovietArms', P.sovietArms, m + 0.46); if (S.armsCut) mark('Stalin withholds the arms'); }
          else mark('China stays out'); } }
      if (crossed) { S.usNorth = true; if (F('pyongyang', m + 0.6, { calibAlso: { rokOnly: S.rok * M.qROK * unSupply() / Math.max(1, S.kpa * M.qKPA51) } }) === 'UN') { S.line = S.stopAt === 'neck' ? LAT.neck : M.lineOct; say('Pyongyang falls'); } else S.line = M.linePyStall; }
      else if (!S.rokHeld) {   // the 38th road: the ROK alone goes north; China decides as it nears the Yalu
        if (roll('china38', tilt(P.china38, tmp.C), m + 0.85)) { enterChina(L + 0.85, 'shield'); say('the PVA crosses the Yalu and strikes the ROK');
          S.mob = roll('usRearm', P.usRearm, m + 0.86); if (!S.mob) mark('Congress does not fund the full build-up'); S.armsCut = !roll('sovietArms', P.sovietArms, m + 0.87); if (S.armsCut) mark('Stalin withholds the arms');
          if (F('rokOnjong', m + 0.9, { noRatio: true }) === 'EN') { S.line = LAT.p38; say('the ROK is thrown back to the 38th');
            if (roll('recross', P.recross, m + 0.95)) { S.recross = true; S.lag++; mark('Washington sends US troops back north'); } }
          else S.line = LAT.neck; }
        else { mark('China stays out'); if (F('rokNorth', m + 0.9, { rokOnly: true, kpaOnly: true }) === 'UN') { S.line = LAT.yalu; S.kpaBroken = true; collapseKPA(M.kpaRemnantNorth); }
          else { S.line = M.lineRokStrip; say('the ROK is stopped in the north');
            if (roll('crossLater', tilt(P.crossLater, 0.5 * (tmp.T + tmp.M)), m + 0.95)) { S.recross = true; S.lag++; mark('Washington sends US troops north after all'); } } } }
      if (S.chinaIn && S.mode === 'attack' && S.line > LAT.chongchon && !btl.onjong) S.line = F('onjong', m + 0.85) === 'UN' ? M.lineOct : LAT.chongchon;
      if (!S.chinaIn && S.line >= LAT.neck && !S.sovRolled) { S.sovRolled = true; if (roll('sovietGround', tilt(P.sovietGround, tmp.S), m + 0.9)) return widerWar('the Soviets send ground forces to save North Korea', m + 0.9); }
    }
    // ======== November 1950 (story clock)
    if (L === 5) {
      if (S.chinaIn && !btl.airSup) { const sa = roll('sovietFrontAir', tilt(P.sovietFrontAir, tmp.S), m + 0.04); if (F('airSup', m + 0.05, { noRatio: true, mod: sa ? M.sovietAirMod : 0 }) === 'EN') { S.airLost = true; mark('the UN loses air superiority over the front'); } }
      if (S.chinaIn && S.mode === 'attack' && S.line >= LAT.chongchon && !btl.unsan) { S.line = Math.min(M.lineOct, S.line + (F('unsan', m + 0.02) === 'UN' ? M.lineUnsanUN : -M.lineUnsanEN));
        if (roll('readsUnsan', tilt(P.readsUnsan, -tmp.M), m + 0.4)) { mark('the UN reads the Chinese strength right'); if (roll('digIn', tilt(P.digIn, -tmp.M), m + 0.45)) { S.stopAt = 'chongchon'; S.prepared = true; mark('the UN digs in on the Ch\'ongch\'on'); } } }
      if (S.chinaIn && S.mode === 'attack' && !btl.chongchon && !btl.winterLine) {
        if (S.prepared) { const r = F('winterLine', m + 0.8, { tag: ' (the Ch\'ongch\'on)' }); S.lastPva = m + 0.8; if (r === 'EN') { pvaWins(); S.retreatTo = Math.max(S.retreatTo, LAT.p38); } else { S.line -= M.bend * reach() * 0.5; S.pvaFails++; S.lastPvaWon = false; } }
        else { const r = F('chongchon', m + 0.8, { odds: S.oneCmd ? 'chongchon1C' : 'chongchon', lossMul: S.oneCmd ? 0.6 : 1 }); S.lastPva = m + 0.8;
          if (r === 'EN') { pvaWins(); say('the Chinese Second Phase breaks Eighth Army on the Ch\'ongch\'on'); } else { S.lastPvaWon = false; S.pvaFails++; say('Eighth Army holds the Ch\'ongch\'on'); }
          if (S.xcorps && !S.oneCmd && !btl.chosin) { const rc = F('chosin', m + 0.9); S.chosinDone = true;
            if (rc === 'UN') { S.ixUntil = L + 0.9 + M.ixMonths; say('the Marines break out from Chosin; the IX Army Group is spent'); }   // the IX Army Group out of the front for three months (history review r1 #10)
            else { mark('X Corps destroyed at Chosin'); S.usDeadAdd += BMAP.chosin.loss.EN[0] * (M.xCorpsDeadShare - M.deadShare); S.shock = Math.max(S.shock, M.chinaShock * 1.5); S.usDownUntil = L + 0.9 + 3; S.us = Math.max(0, S.us - M.xCorpsLoss); } } } }
      if (!S.chinaIn && S.stopAt === 'yalu' && S.line < LAT.yalu - 0.01) { if (F('toYalu', m + 0.3, { refKey: 'rokOnly', kpaOnly: true, mod: winterNow ? M.winterAdvance : 0 }) === 'UN') { S.line = LAT.yalu; S.kpaBroken = true; collapseKPA(M.kpaRemnantNorth); } else S.line = M.lineYaluFail; }
      if (!S.chinaIn && S.stopAt === 'neck' && S.line < LAT.yalu - 0.01 && !btl.rokNorth && !S.rheeRolled) {   // with assurances the north is a buffer and the ROK stays at the neck unless Rhee defies (Bevin's zone, FRUS-VII d813 [D]; history review r2 N2)
        const go = !S.assured || (S.rheeRolled = true, roll('rheeDefies', P.rheeDefies, m + 0.25)); if (S.assured && go) mark('Rhee sends the ROK past the buffer');
        if (go && S.assured && roll('chinaYalu', tilt(P.chinaYalu, tmp.C), m + 0.28, 'rhee')) { enterChina(L + 0.28, 'shield'); say('the PVA comes in against the ROK beyond the neck'); if (F('rokOnjong', m + 0.3, { noRatio: true, tag: ' (beyond the neck)' }) === 'EN') S.line = LAT.neck; }
        else if (go && F('rokNorth', m + 0.3, { rokOnly: true, kpaOnly: true, tag: ' (beyond the neck)' }) === 'UN') { S.line = LAT.yalu; S.kpaBroken = true; collapseKPA(M.kpaRemnantNorth); } }
    }
    if (L === 6 && S.chosinDone && !btl.hungnam) { if (F('hungnam', m + 0.4, { mod: btl.chosin === 'EN' ? M.hungnamMod : 0 }) === 'EN') { mark('Hungnam goes wrong'); S.shock = Math.max(S.shock, M.chinaShock); } }
    if (L >= 6 && L < 8 && S.chinaIn && S.mode === 'attack' && Math.min(S.line, S.retreatTo ?? 99) <= LAT.p38 + 0.05 && !S.nukeRolled) { S.nukeRolled = true;
      if (roll('nukeWinter', tilt(P.nukeWinter, 0.5 * (tmp.T + tmp.M)), m + 0.1)) { const w = nuclear('the winter crisis', m + 0.1); if (w) return w; } }
    if (L === 7 && S.chinaIn && S.mode === 'attack' && S.line < LAT.p38) {
      if (roll('bombManchuria', tilt(P.bombManchuria, 0.5 * (tmp.T + tmp.M)), m + 0.4)) { S.manchuria = true; mark('the US bombs the Manchurian airfields');
        S.covert = roll('sovietCovert', P.sovietCovert, m + 0.42, 'winter'); if (S.covert) mark('Soviet fighters defend Manchuria (covertly)');
        if (S.covert && roll('sovietOvertAir', tilt(P.sovietOvertAir / P.sovietCovert, tmp.S), m + 0.45, 'winter')) return widerWar('the Soviets enter openly after the bombing of Manchuria', m + 0.45);
        if (!S.alliesOut && roll('alliesLeave', P.alliesLeave, m + 0.5, 'manchuria')) { S.alliesOut = true; mark('the allies leave'); S.shock += 3; } }
      if (roll('nationalists', tilt(P.nationalists, tmp.M), m + 0.45)) { S.nat = 33; mark('Chiang\'s troops sent to Korea'); if (!S.alliesOut && roll('alliesLeave', P.alliesLeave, m + 0.5, 'chiang')) { S.alliesOut = true; mark('the allies leave'); } } }

    // ---- talks or the push north: once Mao has turned to the defensive and the UN has reached its line or stopped attacking (SRC_A §10; C2 §4f)
    const unLine = S.nukeBroke || ((S.stopAt === 'yalu' || S.stopAt === 'chongchon') && S.line >= LAT.chongchon - 0.01) ? LAT.yalu : LAT.kansas;   // after an atomic break the UN drives for the Yalu (code review r2 N3)
    if (S.chinaIn && S.mode === 'attack' && !S.talks && !S.push && L >= 6 && S.defensive && (S.line >= unLine - 0.01 || S.unFails >= 2 || !S.unCan)) {
      if (!S.pushRolled && S.line >= LAT.p38 && S.line < LAT.neck) { S.pushRolled = true; if (roll('pushNorth', tilt(P.pushNorth * (S.mistake < M.willLow ? M.willPushUp : M.willPushDown), tmp.T), m + 0.2)) { S.push = 1; mark('the push to the neck'); say('Eighth Army drives for the neck instead of talking'); } }
      if (!S.push && roll('talks', P.talks * (S.line >= BETTER_LAT ? M.talksNorth : 1), m + 0.3)) { S.talks = true; mark('talks open'); say('armistice talks open'); } }
    // ======== from December 1950: the war of movement. Named battles fire when the state matches their real window; otherwise the generic ones (dice keyed by their time)
    if (L >= 6 && S.chinaIn && S.mode === 'attack' && !S.talks && !S.push) {
      if (L === 7 && S.line < LAT.p38 + 0.2 && !btl.twinTunnels && S.lastPvaWon) F('twinTunnels', m + 0.95);
      const kind = L === 6 && !btl.thirdPhase && S.line <= 38.5 ? 'third' : L === 8 && !btl.chipyongni && S.line <= 37.6 ? 'fourth' : L === 10 && !btl.spring1 && S.line >= 37.6 ? 'spring1' : L === 11 && btl.spring1 && !btl.spring2 ? 'spring2' : 'generic';
      const tP = m + ({ third: 0.97, fourth: 0.35, spring1: 0.7 }[kind] ?? 0.5);
      const ready = tP >= S.lastPva + (S.lastPvaWon ? M.pause : M.pauseFail) - 0.05 || kind === 'spring2';
      if (ready && S.pvaC > 50 && !S.defensive) {
        let res, pl = 0; const add = x => { pl += x.pvaLoss; return x.r; };
        if (kind === 'third') res = add(fight('thirdPhase', tP, { mod: btl.chosin === 'EN' ? M.xCorpsMod : 0 }));
        else if (kind === 'fourth') { const a = add(fight('hoengsong', m + 0.35)), b = add(fight('chipyongni', m + 0.45)), c = add(fight('wonju', m + 0.5)); res = b === 'EN' && c === 'EN' ? 'EN' : 'UN';
          if (res === 'UN' && (b === 'EN' || c === 'EN')) S.line -= M.lineFourth * (a === 'EN' ? 1.5 : 1); else if (res === 'UN' && a === 'EN') S.line -= M.lineFourth / 3; }
        else if (kind === 'spring1') res = add(fight('spring1', tP));
        else if (kind === 'spring2') res = add(fight('spring2', tP));
        else { const early = L <= 8, adv = S.advancing; res = add(fight('pvaOff@' + tP.toFixed(2), tP, { odds: adv ? 'chongchon' : early ? 'winterLine' : 'prepared51', refKey: 'm' + tauI })); }   // the odds are the period's (the 1950-51 winter line, then 1951 on: story clock); the cold is the calendar's (reach, advance)
        S.lastPva = tP;
        if (res === 'EN') { pvaWins(); const l = lost(m + 0.6); if (l) return l; }
        else { if (kind !== 'fourth') S.line -= M.bend * reach(); S.lastPvaWon = false; if (kind !== 'spring1') S.pvaFails++; if (pl >= M.cohLoss) S.cohUntil = L + 0.5 + M.cohMonths; }
        if (S.pvaFails >= 2 && !S.defensive && S.pvaCas - S.pvaLoss0 >= M.defLoss) { S.defensive = true; mark('Mao turns to the defensive'); say('after failed offensives and heavy losses the Chinese dig in'); }   // two failures AND heavy losses (history review r2 N1c)
      }
      S.advancing = false;
      const target = unLine; S.unCan = ratio({}) >= M.unAttack * (REF ? refM : 0);
      if (S.lastPva <= m + 0.55 && (!S.lastPvaWon || m + 0.5 - S.lastPva >= 1.5) && S.line < target - 0.01 && L >= 7 && S.unCan && S.unFails < 2) {
        const named = L >= 8 && L <= 9 && !btl.killerRipper && S.line < LAT.p38 ? 'killerRipper' : L === 11 && btl.spring2 && !btl.counter51 ? 'counter51' : null;
        const wmod = (winterNow && S.line >= LAT.neck ? M.winterAdvance : 0) + (L >= 19 && L <= 33 ? M.ammoMod : 0), r = named ? F(named, m + 0.7, { mod: wmod }) : F('unOff@' + (m + 0.7).toFixed(2), m + 0.7, { refKey: 'm' + tauI, mod: wmod });
        if (r === 'UN') { const adv = M.unAdvance * (named ? 2 : 1) * Math.min(1.5, dpow(Math.max(0.3, ratio({}) / refM), 0.5)) * (S.nukeBroke ? 2 : 1); S.line = Math.min(target, S.line + adv); if (S.line > LAT.chongchon) S.advancing = true; S.unFails = 0; }
        else S.unFails++; }
    }
    // ---- MacArthur's escalation (Apr 1951): the measures of 30 Dec 1950, if Truman keeps him
    if (L === 10 && S.chinaIn && S.mode === 'attack' && !S.talks && !S.macRolled) { S.macRolled = true;
      if (roll('macArthurKept', tilt(P.macArthurKept * (S.mistake > M.willMid ? M.willMac : 1), 0.5 * (tmp.T + tmp.M)), m + 0.3)) { S.macPath = true; mark('MacArthur kept: the war carried to China'); say('Truman keeps MacArthur; the measures of 30 December are adopted');
        if (roll('escalationStopped', P.escalationStopped * (S.alliesOut ? M.alliesStop : 1), m + 0.32, 'mac')) { mark('Congress and the allies stop the escalation'); S.macPath = false; }
        else { S.manchuria = true; if (roll('blockadeAlone', P.blockadeAlone * (S.alliesOut ? 1.5 : 1), m + 0.33)) { S.blockade = true; mark('the China coast blockaded'); }
          S.covert = roll('sovietCovert', P.sovietCovert, m + 0.34, 'mac'); if (S.covert) mark('Soviet fighters defend Manchuria (covertly)');
          if (S.covert && roll('sovietOvertMac', tilt(P.sovietOvertMac / P.sovietCovert, tmp.S), m + 0.35)) return widerWar('the Soviets enter openly against the war on China', m + 0.35);
          S.nat = 33; if (!S.alliesOut && roll('alliesLeave', P.alliesLeave, m + 0.36, 'mac')) { S.alliesOut = true; mark('the allies leave'); S.shock += 3; }
          if (roll('nukeMac', tilt(P.nukeMac, 0.5 * tmp.M), m + 0.4)) { const w = nuclear('MacArthur\'s war', m + 0.4); if (w) return w; } } }
      else mark('MacArthur relieved'); }
    const esc = S.macPath || S.nukeBroke; if ((esc || (S.defensive && S.line >= LAT.neck)) && S.chinaIn && S.mode === 'attack' && roll(esc ? 'chinaBreak' : 'chinaBreakNeck', hz12(esc ? P.chinaBreak12 : P.chinaBreakNeck), m + 0.6)) { S.mode = 'withdrawn'; S.talks = false; mark('China\'s will breaks: the PVA goes home'); say('China pulls the PVA back across the Yalu'); }
    if (S.mode === 'withdrawn') { if (S.pva <= 0.5) { S.chinaIn = false; S.pva = 0; S.pvaC = 0; S.stopAt = 'yalu'; } if (S.line < LAT.yalu - 0.01) { if (F('unOff@' + (m + 0.75).toFixed(2), m + 0.75, { refKey: 'm' + tauI, tag: ' (after the Chinese leave)' }) === 'UN') S.line = Math.min(LAT.yalu, S.line + 2 * M.unAdvance); } }
    if (!S.chinaIn && S.stopAt === 'yalu' && L >= 6 && S.line < LAT.yalu - 0.01) { if (F('unOff@' + (m + 0.3).toFixed(2), m + 0.3, { refKey: 'm' + tauI, tag: ' (to the Yalu, China out)', mod: winterNow ? M.winterAdvance : 0 }) === 'UN') { S.line = LAT.yalu; S.kpaBroken = true; collapseKPA(M.kpaRemnantNorth); } }
    if (S.push) { S.push++; S.usCas += M.pushCas * M.pushUsShare; S.rokCas += M.pushCas * M.pushUsShare; S.pva = Math.max(0, S.pva - M.pushCas * 1.5); S.pvaC = Math.max(0, S.pvaC - M.pushCas * 1.5); S.pvaCas += M.pushCas * 1.5;
      if (S.push === 2 && F('tongchon', m + 0.6) === 'UN') { S.pva = Math.max(0, S.pva - 60); S.pvaC = Math.max(0, S.pvaC - 60); mark('two CPV armies destroyed'); }
      if (S.mistake > M.pushTolerance && S.push < 5) { S.push = 0; S.talks = true; S.line = Math.max(S.line, Math.min(LAT.neck, S.line + M.linePushStop)); mark('the push stopped by Washington'); say('the cost stops the push; talks open'); }
      else if (S.push === 5) { const r = F('pushNeck', m + 0.8, { mod: isWinter(m) ? M.winterAdvance : 0 }); S.push = 0; S.talks = true; if (r === 'UN') { S.line = Math.max(S.line, LAT.neck); mark('the UN reaches the neck'); say('Eighth Army stands on the Pyongyang-Wonsan neck; talks open'); } else { S.line = Math.max(S.line, Math.min(LAT.neck - 0.4, S.line + M.linePushFail)); say('the push stalls short of the neck; talks open'); } } }

    // ---- the shield: China in, the UN halted; Mao's six months, then the restraint ends (history review r1 #7)
    if (S.chinaIn && S.mode === 'shield' && L >= 5) { const neck = S.stopAt === 'neck' || S.line >= BETTER_LAT, later = L - S.chinaT >= 6, name = later ? (neck ? 'shieldLater' : 'shieldLater38') : neck ? 'shieldNeck' : 'shield38', p = hz6(later ? (neck ? P.shieldLater : P.shieldLater38) : neck ? P.shieldNeck : P.shield38);
      if (roll(name, tilt(p, tmp.C), m + 0.5)) { const tS = m + 0.55;
        const r = neck ? F('neckHold@' + tS.toFixed(2), tS) : F('pvaOff@' + tS.toFixed(2), tS, { odds: L <= 8 ? 'winterLine' : 'prepared51', refKey: 'm' + tauI, tag: ' (on the 38th)' });
        S.lastPva = tS; if (r === 'EN') { S.mode = 'attack'; pvaWins(); S.stopAt = 'kansas'; say('the Chinese shield attacks and breaks the line'); const l = lost(m + 0.6); if (l) return l; } else { S.pvaFails++; S.lastPvaWon = false; mark('the halted line holds'); } } }   // a held line stays where it is (code review r2 N2)

    if (S.chinaIn && S.mode === 'attack' && (S.talks || S.defensive) && S.line >= BETTER_LAT && roll('resume', tilt(hz6(P.shieldLater), tmp.C), m + 0.5)) { const tR = m + 0.55;   // a line in Pyongyang is not frozen by talk: the same army keeps the shield's hazard (history review r2 N1b)
      const r = F('neckHold@' + tR.toFixed(2), tR, { tag: ' (the Chinese resume)' }); S.lastPva = tR;   // the battle for the neck, as on the shield road: one army, one line, one set of odds
      if (r === 'EN') { S.talks = false; S.defensive = false; S.pvaFails = 0; pvaWins(); mark('the Chinese resume the offensive'); const l = lost(m + 0.6); if (l) return l; } }
    // ======== the talks and the stalemate (or a stable halted line): the outpost war, the limited offensives, Stalin, the election, the armistice
    const stable = S.talks || (S.chinaIn && S.mode === 'shield') || (!S.chinaIn && S.stopAt && S.stopAt !== 'yalu' && L >= 5 && S.line < LAT.yalu - 0.01 && S.yaluSince === null && !S.recross);
    if (stable && L >= 5) {
      S.staticM++;
      if (S.talks) {
        if (L === 14 && S.line >= LAT.p38 && !btl.ridges && F('ridges', m + 0.6) === 'UN') S.line += M.lineRidge;
        if (L === 16 && S.line >= LAT.p38 && !btl.commando && F('commando', m + 0.1) === 'UN') S.line += M.lineRidge;
        if (L === 16 && !btl.blackThursday && S.chinaIn && F('blackThursday', m + 0.75, { noRatio: true }) === 'EN') { S.dayRaids = false; mark('daylight B-29 raids end'); }
        if (L === 14 && !S.damRolled) { S.damRolled = true; if (roll('damsEarly', P.damsEarly, m + 0.1)) { S.dams = true; mark('the dams bombed early'); } }
        const active = roll('activeMonth', M.activeShare, m + 0.2);
        if (active && S.chinaIn && F('outposts@' + m, m + 0.5) === 'EN') S.line -= M.lineOutpost;   // one die per month (code review r1 M1)
        S.usCas += active ? M.activeDrain : M.quietDrain; S.rokCas += M.rokDrain * (active ? 2 : 1); const en = M.enDrain * (active ? 2 : 1); S.pvaCas += en * (1 - M.kpaStaticShare); S.kpaCas += en * M.kpaStaticShare;
      }
      if (L === 21 && S.talks && !S.powRolled) { S.powRolled = true; S.powConc = roll('powConcession', P.powConcession, m + 0.1); if (S.powConc) mark('voluntary repatriation dropped'); }
      if (m === 29 && !S.elRolled) { S.elRolled = true; S.staticM = 0; S.floorOn = false;   // the new president: a fresh start in the polls (51% → 36% by Jan 1953; history review r2 N4)
 if (!roll('newPresidentArmistice', P.newPresidentArmistice, m + 0.3)) { S.esc53 = true; mark('the new president leans to escalation'); } }   // the election: calendar
      const stalin = !(H.stalinLives) && m >= 33;   // Stalin dies 5 Mar 1953: calendar (H.stalinLives is the corner case)
      if (m === 33 && stalin) mark('Stalin dies');
      if (m >= 36 && m <= 38 && S.talks && S.chinaIn && !btl.kumsong && stalin) S.line -= F('kumsong', m + 0.4) === 'UN' ? M.lineKumsongUN : M.lineKumsongEN;
      let pA;
      if (stalin) pA = P.armAfter + (S.esc53 && m >= 35 ? P.nukeSignals : 0);
      else if (S.talks) pA = tilt(P.armStalin, -tmp.S) + (S.powConc ? M.powBonus : 0) + (S.blockade || S.manchuria || S.dams ? hz12(P.chinaStrain12) : 0) + (S.dams || btl.blackThursday === 'UN' ? hz12(P.airAlone12) * (S.dams ? 1 : 0.5) : 0);
      else pA = tilt(hz12(P.armNeck12), -tmp.S);
      if (!stalin && S.line >= BETTER_LAT) pA *= M.armNorth;
      if (S.alliesOut) pA += M.alliesArm;
      if (S.esc53) pA *= M.nukeLegacy;
      const armName = stalin ? 'armAfter' : S.talks ? 'armStalin' : 'armNeck';
      if (roll(armName, pA, m + 0.85)) { S.t = m + 0.85; mark('the armistice'); return finish(classify(S.line, false), `an armistice on a line at ${S.line.toFixed(2)}°N`); }
      if (stalin && m >= 45 && S.talks && !S.n53) { S.n53 = true; if (!(S.esc53 && roll('escalationStopped', P.escalationStopped * (S.alliesOut ? M.alliesStop : 1), m + 0.9, '54')) && roll('nuke53', tilt(P.nuke53 * (S.esc53 ? M.nuke53Esc : M.nuke53Calm), 0.5 * tmp.T), m + 0.9)) { const w = nuclear('the talks collapse', m + 0.9); if (w) return w; } }
    }
    // ---- a unified Korea: the UN on the Yalu, held twelve months against a late Chinese entry and the KPA rebuilt in Manchuria (history review r1 #3)
    if (S.line >= LAT.yalu - 0.01 && S.yaluSince === null && (!S.chinaIn || S.mode === 'withdrawn')) { S.yaluSince = m; S.yaluStart = m; mark('the UN on the Yalu'); say('the UN holds the whole of Korea to the Yalu'); }   // the hold starts only with no Chinese army in Korea (code review r2 N1)
    if (S.yaluSince !== null && S.line < LAT.yalu - 0.01) { S.yaluSince = null; S.held = false; }
    if (S.yaluSince !== null) {
      S.usCas += S.kpa * M.insurgUs * (S.usNorth ? 1 : 0); S.rokCas += S.kpa * M.insurgRok; S.rok = Math.max(5, S.rok - S.kpa * M.insurgRok);   // the insurgency drains the ROK itself (history review r2 N3a)
      if (m > S.yaluSince && S.chinaIn && S.mode !== 'withdrawn') { S.yaluSince = null; S.held = false; }
      else if (m > S.yaluSince && !S.chinaIn && roll('lateChina', tilt(P.lateChina, tmp.C), m + 0.5)) { enterChina(L + 0.5, 'attack'); S.lastPva = m - 1; S.lastPvaWon = true; S.defensive = false; S.pvaFails = 0; S.talks = false; say('China enters after all, with the UN on the Yalu'); S.mob = true; }   // rolled from the month after arrival: twelve rolls (code review r2 m3)
      else if (m > S.yaluSince && m - S.yaluSince >= 4 && S.kpa >= 100 && roll('kpaReturn', P.kpaReturn, m + 0.6)) { const tK = m + 0.62; mark('the KPA comes back from Manchuria'); if (F('kpaReturn@' + tK.toFixed(2), tK, { refKey: 'rokOnly', rokOnly: !S.usNorth, kpaOnly: true }) === 'EN') { S.line = LAT.chongchon; S.yaluSince = null; S.held = false; say('the KPA retakes the far north'); } else collapseKPA(Math.min(S.kpa, 40)); }   // history review r2 N3b
      else if (S.yaluSince !== null && m - S.yaluSince >= M.holdMonths && (!S.chinaIn || S.mode === 'withdrawn')) { S.held = true; S.t = m + 0.9; mark('Korea unified'); return finish(O_WIN, 'Korea is unified under the ROK'); } }
    // ---- will: the Gallup "mistake" share, from casualties (log), the Chinese shock and the months of stalemate
    if (L >= 1 && !stable && !S.push && S.yaluSince === null && (S.intervened || S.rok > 5)) { const f = L < 4 ? 1.1 : S.chinaIn ? 1 : 0.5; if (S.intervened && L >= 2 && m + 0.5 >= S.entryT) S.usCas += M.mobileDrain * f;
      S.rokCas += M.rokMobile * f; S.rok = Math.max(5, S.rok - M.rokMobile * f * 0.5); const en = M.enMobile * f, kS = S.pva > 0 ? Math.min(1, S.kpa / Math.max(1, S.kpa + pvaFront())) : 1; S.kpaCas += en * kS; S.pvaCas += en * (1 - kS); }
    if (!(S.lastPva !== pvaBefore && S.lastPvaWon)) S.shock = Math.max(S.floorOn && S.chinaIn ? Math.min(S.shock, M.chinaShock * M.shockFloor) : 0, S.shock * M.shockDecay);   // the shock fades to a floor until the 1952 election (history review r2 N4)
    S.lineStatic = Math.abs(S.line - S.lastLine) < 0.05 ? S.lineStatic + 1 : 0; S.lastLine = S.line;
    S.mistake = M.mistake0 + S.shock + M.willK * dlog(1 + S.usCas / 10) + M.staticDrain * (S.talks ? S.staticM : 0) + (S.push ? M.pushWill * S.push : 0);
    S.cost += E.usCostMonth;
    if (trace) trace.push([m, +S.line.toFixed(2), +S.us.toFixed(0), +S.rok.toFixed(0), +S.oth.toFixed(0), +S.kpa.toFixed(0), +S.pva.toFixed(0), +pvaFront().toFixed(0), +qPVA().toFixed(2), +(S.usCas * M.deadShare).toFixed(1), +S.mistake.toFixed(1), +S.cost.toFixed(1), +S.pvaC.toFixed(0)]);
  }
  S.t = MN - 0.01; mark('still at war at the end of 1955');
  return finish(classify(S.line, S.yaluSince !== null && MN - 1 - S.yaluSince >= M.holdMonths && (!S.chinaIn || S.mode === 'withdrawn')), 'the end of 1955: no armistice; judged by the line');
}

export function batch(set, n, seedBase, H, over, mech, econ) {
  const P = { ...oddsFor(set), ...(over || {}) }, out = { n, outcomes: {}, events: {}, endYear: {}, deadSum: 0, endSum: 0, lineSum: 0, fight: 0, nuke: 0, nukeOut: {}, slightly: 0 };
  const undo = []; for (const [k, v] of Object.entries(mech || {})) { undo.push([MECH, k, MECH[k]]); MECH[k] = v; } for (const [k, v] of Object.entries(econ || {})) { undo.push([ECONOMY, k, ECONOMY[k]]); ECONOMY[k] = v; } if (undo.length) resetRef();
  try { for (let i = 0; i < n; i++) { const r = war(P, rng(warSeed(seedBase, i)), H || {}); out.outcomes[r.outcome] = (out.outcomes[r.outcome] || 0) + 1; for (const e of r.ev) out.events[e] = (out.events[e] || 0) + 1; const y = Math.floor(r.y); out.endYear[y] = (out.endYear[y] || 0) + 1;
    if (r.outcome !== O_OUT) { out.fight++; out.deadSum += r.usDead; out.endSum += r.y; out.lineSum += r.line; } if (r.nuke) { out.nuke++; out.nukeOut[r.outcome] = (out.nukeOut[r.outcome] || 0) + 1; } if (r.outcome === O_DRAW && r.line >= ARM53 + BAND) out.slightly++; } }
  finally { for (const [o, k, v] of undo.reverse()) o[k] = v; if (undo.length) resetRef(); }
  out.win = out.outcomes[O_WIN] || 0; out.deadMean = out.deadSum / Math.max(1, out.fight); out.endMean = out.endSum / Math.max(1, out.fight); out.lineMean = out.lineSum / Math.max(1, out.fight); return out;
}

// INPUTS.md, generated from this file's own text (one source of truth; the test checks the file matches)
export function inputsMarkdown(src) {
  const blk = name => { const a = src.indexOf('export const ' + name + ' = {'); return src.slice(a, src.indexOf('\n};', a)).split('\n').slice(1); };
  let md = '# Inputs of the Korean War model (v3)\n\nGenerated from sim/sim.mjs by inputsMarkdown() (node run.mjs writes it; sim_test checks it matches). Every odd is our judgment; the note beside it says what informed it (00_research: SRC_A = the 1950 story and the decisions, SRC_B = the battles (B1-B3), SRC_C = forces, logistics, economy, will and the red lines (C1, C2, R), SRC_FORKS = the forks (F); KIM-CWH-2016 read directly by the history reviewer). Three values: against America, the middle (the headline), for America. For a battle the value is P(the UN wins it). "per month", "per half-year", "within 12 months" mean hazards. Notes marked UNVERIFIED, [S], [W] or [X] are to be closed before the lock.\n\n';
  md += '## Lines and definitions\n| Name | Value | What informed it |\n|---|---|---|\n' + Object.entries(LAT).map(([k, v]) => `| LAT.${k} | ${v} | the front as an average latitude over 126.1-129.4°E; measured on 01_script/CONTROL_KR.json where the project has the line (neck, kansas); the rest from the named places (judgment) |`).join('\n') + `\n| ARM53 | ${ARM53} | the 1953 Military Demarcation Line, measured (CONTROL_KR.json: Hermes Map IX, OHM) |\n| BAND | ${BAND} | ±30 km (DESIGN) |\n| BETTER_LAT | ${BETTER_LAT} | BETTER PEACE: the neck, Pyongyang (39.02) and Wonsan (39.15) held (DESIGN_v2, fixed before the v2 run) |\n\n`;
  md += '## Odds\n| Name | Against | Middle | For | What informed it |\n|---|---|---|---|---|\n';
  for (const l of blk('ODDS')) { const h = l.match(/^\s*\/\/\s*(.+)$/); if (h) { md += `| **${h[1]}** | | | | |\n`; continue; } const m = l.match(/^\s*(\w+):\s*\[([^\]]+)\],?\s*\/\/\s*(.*)$/); if (m) { const v = m[2].split(',').map(s => s.trim()); md += `| ${m[1]} | ${v[0]} | ${v[1]} | ${v[2]} | ${m[3].replace(/\|/g, '/')} |\n`; } }
  md += '\n## The economy (production, resources, replacement, blockade)\n| Name | Value | What informed it |\n|---|---|---|\n';
  for (const l of blk('ECONOMY')) { const m = l.match(/^\s*(\w+):\s*(.+?),\s*\/\/\s*(.*)$/); if (m) md += `| ${m[1]} | ${m[2].trim().replace(/\|/g, '/')} | ${m[3].replace(/\|/g, '/')} |\n`; }
  md += '\n## Mechanics and every judgment constant the war reads (varied in RESULTS)\n| Name | Value | What informed it |\n|---|---|---|\n';
  for (const l of blk('MECH')) { const note = l.includes('//') ? l.slice(l.indexOf('//') + 2).trim() : ''; const body = l.includes('//') ? l.slice(0, l.indexOf('//')) : l; for (const mm of body.matchAll(/(\w+):\s*(-?[\d.]+)/g)) md += `| ${mm[1]} | ${mm[2]} | ${note.replace(/\|/g, '/')} |\n`; }
  md += '\n## Battles (every one an event; loss = [US, ROK, enemy] casualties in thousands by result; real = fought in the real war)\n| Id | Battle | Real | Odds | Reference ratio | What it decides | Losses if the UN wins / if it loses | Source |\n|---|---|---|---|---|---|---|---|\n';
  { const a = src.indexOf('export const BATTLES = ['); for (const l of src.slice(a, src.indexOf('\n];', a)).split('\n').slice(1)) { const id = (l.match(/id: '(\w+)'/) || [])[1]; if (!id) continue; const b = BMAP[id]; md += `| ${id} | ${b.name} | ${b.real ? 'yes' : 'judgment'} | ${b.odds} | ${b.fixed ? 'none: odds fixed' : b.ref || (['pvaOff', 'unOff'].includes(id) ? 'the real ratio at that stage' : id)} | ${b.decides} | ${b.loss.UN.join(', ')} / ${b.loss.EN.join(', ')} | ${(l.split('//')[1] || '').trim()} |\n`; } }
  return md;
}
