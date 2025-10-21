// src/x01.ts

/** --- Types de base --- */
export type Mult = 1 | 2 | 3;
export type Dart = { value: number; mult: Mult };        // 0..20, 25 (bull)
export type Player = { id: string; name: string; score: number };

export type VisitResult = {
  nextScore: number;
  bust: boolean;
  finished: boolean;                 // a terminé la manche (double-out)
  checkoutDartIndex: number | null;  // 0..2 si fini sur cette fléchette
};

/** --- Utilitaires de score --- */
export function dartScore(d: Dart): number {
  if (d.value === 25) return d.mult === 2 ? 50 : 25; // bull (25/50)
  return d.value * d.mult;
}

export function isDouble(d: Dart): boolean {
  if (d.value === 25 && d.mult === 2) return true; // inner bull = double
  return d.mult === 2;
}

/** Applique une volée de 1..3 fléchettes (double-out, bust). */
export function applyVisitX01(startScore: number, darts: Dart[]): VisitResult {
  let score = startScore;
  let bust = false;
  let finished = false;
  let checkoutDartIndex: number | null = null;

  for (let i = 0; i < darts.length; i++) {
    const d = darts[i];
    const s = dartScore(d);
    const proposed = score - s;

    // dépassement ou reste 1 => bust (rollback au début de volée)
    if (proposed < 0 || proposed === 1) {
      bust = true;
      score = startScore;
      break;
    }

    // proposé 0 => doit finir en double
    if (proposed === 0) {
      if (isDouble(d)) {
        finished = true;
        checkoutDartIndex = i;
        score = 0;
      } else {
        bust = true;
        score = startScore;
      }
      break;
    }

    // sinon on valide et on continue
    score = proposed;
  }

  return { nextScore: score, bust, finished, checkoutDartIndex };
}

/** --- Gestion de manche / match --- */
export type LegState = {
  startingScore: number;      // 301/501/701...
  order: string[];            // ordre des joueurs (ids)
  activeIndex: number;        // index du joueur actif
  players: Record<string, Player>;
  winnerId: string | null;    // set dès qu’un joueur termine
  finished: boolean;          // manche officiellement close
};

export type MatchState = {
  totalLegs: number;          // nb de manches à jouer (ou best-of, à adapter)
  currentLegNumber: number;   // 1-based
  legsWon: Record<string, number>;
  leg: LegState;
};

/** Crée une manche (option: forcer le 1er tireur via firstToThrowId). */
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
  roster.forEach(r => {
    players[r.id] = { id: r.id, name: r.name, score: startingScore };
  });
  return {
    startingScore,
    order,
    activeIndex: 0,
    players,
    winnerId: null,
    finished: false,
  };
}

/** Crée un match avec la première manche prête. */
export function createMatch(
  startingScore: number,
  roster: Array<{ id: string; name: string }>,
  totalLegs = 1
): MatchState {
  return {
    totalLegs,
    currentLegNumber: 1,
    legsWon: Object.fromEntries(roster.map(r => [r.id, 0])),
    leg: createLeg(startingScore, roster),
  };
}

/** Joue une volée pour le joueur actif. */
export function playVisit(
  match: MatchState,
  darts: Dart[]
): {
  match: MatchState;
  legEnded: boolean;
  winnerId: string | null;
  visit: VisitResult;
} {
  const leg = match.leg;

  if (leg.finished) {
    return {
      match,
      legEnded: true,
      winnerId: leg.winnerId,
      visit: { nextScore: 0, bust: false, finished: true, checkoutDartIndex: 0 },
    };
  }

  const playerId = leg.order[leg.activeIndex];
  const p = leg.players[playerId];
  const visit = applyVisitX01(p.score, darts);

  leg.players[playerId] = { ...p, score: visit.nextScore };

  if (visit.finished) {
    leg.winnerId = playerId;
    leg.finished = true;
    match.legsWon[playerId] = (match.legsWon[playerId] ?? 0) + 1;
    return { match, legEnded: true, winnerId: playerId, visit };
  }

  // pas fini => joueur suivant
  leg.activeIndex = (leg.activeIndex + 1) % leg.order.length;
  return { match, legEnded: false, winnerId: null, visit };
}

/** Prépare la manche suivante (option: rotation du 1er tireur). */
export function nextLeg(match: MatchState, rotateFirst = true): MatchState {
  const prev = match.leg;
  const firstOfNext = rotateFirst
    ? prev.order[prev.activeIndex % prev.order.length] // le suivant commence
    : prev.order[0];

  match.currentLegNumber = Math.min(match.currentLegNumber + 1, match.totalLegs);
  match.leg = createLeg(prev.startingScore, Object.values(prev.players), firstOfNext);
  return match;
}
