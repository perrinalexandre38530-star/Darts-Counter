// src/x01.ts

export type Mult = 1 | 2 | 3;
export type Dart = { value: number; mult: Mult }; // 0..20, 25 (bull)
export type Player = { id: string; name: string; score: number };

export type VisitResult = {
  nextScore: number;
  bust: boolean;
  finished: boolean;                 // manche finie (double-out)
  checkoutDartIndex: number | null;  // 0..2 si fini sur cette fléchette
};

export function dartScore(d: Dart): number {
  if (!d) return 0;
  if (d.value === 25) return d.mult === 2 ? 50 : 25;
  if (d.value < 0 || d.value > 20) return 0;
  return d.value * d.mult;
}

export function applyVisitX01(
  currentScore: number,
  darts: Dart[],
  doubleOut = true
): VisitResult {
  let score = currentScore;
  let bust = false;
  let finished = false;
  let checkoutDartIndex: number | null = null;

  for (let i = 0; i < Math.min(3, darts.length); i++) {
    const d = darts[i];
    const pts = dartScore(d);
    const proposed = score - pts;

    // dépassement
    if (proposed < 0) { bust = true; break; }

    // il reste 1 → bust si double-out
    if (doubleOut && proposed === 1) { bust = true; break; }

    // check exact 0
    if (proposed === 0) {
      if (!doubleOut) {
        finished = true; checkoutDartIndex = i; score = 0; break;
      }
      const isValidDouble =
        (d.value === 25 && d.mult === 2) || d.mult === 2;
      if (isValidDouble) {
        finished = true; checkoutDartIndex = i; score = 0; break;
      } else { bust = true; break; }
    }

    // ok
    score = proposed;
  }

  return { nextScore: bust ? currentScore : score, bust, finished, checkoutDartIndex };
}

/* ---------------- Manches / match (ultra-simple) ---------------- */

export type LegState = {
  startingScore: number;
  order: string[];                 // ordre des joueurs (ids)
  activeIndex: number;             // index du joueur actif
  players: Record<string, Player>;
  winnerId: string | null;
  finished: boolean;
};

export type MatchState = {
  totalLegs: number;
  currentLegNumber: number;        // 1-based
  legsWon: Record<string, number>;
  leg: LegState;
};

export function createLeg(
  startingScore: number,
  roster: Array<{ id: string; name: string }>,
  firstToThrowId?: string
): LegState {
  const order = [...roster.map(r => r.id)];
  if (firstToThrowId && order.includes(firstToThrowId)) {
    while (order[0] !== firstToThrowId) order.push(order.shift()!);
  }
  const players: Record<string, Player> = {};
  roster.forEach(r => (players[r.id] = { id: r.id, name: r.name, score: startingScore }));
  return { startingScore, order, activeIndex: 0, players, winnerId: null, finished: false };
}

export function createMatch(
  startingScore: number,
  roster: Array<{ id: string; name: string }>,
  totalLegs = 1
): MatchState {
  const first = createLeg(startingScore, roster);
  return {
    totalLegs,
    currentLegNumber: 1,
    legsWon: Object.fromEntries(roster.map(r => [r.id, 0])),
    leg: first,
  };
}

export function playVisit(
  leg: LegState,
  darts: Dart[],
  doubleOut = true
): { legEnded: boolean; winnerId: string | null; visit: VisitResult } {
  if (leg.finished) {
    return { legEnded: true, winnerId: leg.winnerId, visit: { nextScore: 0, bust: false, finished: true, checkoutDartIndex: 0 } };
  }
  const playerId = leg.order[leg.activeIndex];
  const p = leg.players[playerId];
  const visit = applyVisitX01(p.score, darts, doubleOut);

  leg.players[playerId] = { ...p, score: visit.nextScore };

  if (visit.finished) {
    leg.winnerId = playerId;
    leg.finished = true;
    return { legEnded: true, winnerId: playerId, visit };
  }

  // tour suivant
  if (!visit.bust) {
    leg.activeIndex = (leg.activeIndex + 1) % leg.order.length;
  } else {
    // bust → joueur suivant quand même
    leg.activeIndex = (leg.activeIndex + 1) % leg.order.length;
  }

  return { legEnded: false, winnerId: null, visit };
}

export function nextLeg(
  match: MatchState,
  roster: Array<{ id: string; name: string }>,
  startingScore?: number
): void {
  match.currentLegNumber += 1;
  match.leg = createLeg(startingScore ?? match.leg.startingScore, roster);
}
