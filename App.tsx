import React, { useEffect, useMemo, useRef, useState } from "react";

/* =========================================
   Utils
   ========================================= */
function uid() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return (crypto as any).randomUUID();
    }
  } catch {}
  return "id-" + Math.random().toString(36).slice(2);
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function useLocalStorage<T>(key: string, def: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : def;
    } catch {
      return def;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV] as const;
}

function downloadFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fileToDataURL = (file: File) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(file);
  });

/* =========================================
   Types
   ========================================= */
type Theme = { primary: string; secondary: string; surface: string; text: string };

type Team = { id: string; name: string; color: string; logoDataUrl?: string };

type Profile = {
  id: string;
  name: string;
  avatarDataUrl?: string;
  teamId?: string;
  stats?: { games: number; legs: number; sets?: number; darts: number };
  // tu pourras étendre plus tard
};

type Player = {
  id: string;
  name: string;
  profileId?: string;
  avatarDataUrl?: string;
  teamId?: string;
  x01Score: number;
  legs: number;
  sets: number;
  dartsUsed: number;
  lastScore: number;
  points: number;
  lives: number;
  atcTarget: number;
    // Killer
    killerTarget?: number;   // 1..20
    isKiller?: boolean;      // a validé sa double
    // Shanghai
    shanghaiRound?: number;  // 1..20 (compteur local par joueur, ou global)  
};

type MatchRules = { startingScore: number; doubleOut: boolean; legsToWinSet: number; setsToWinMatch: number; randomOrder?: boolean; };

type Mode =
  | "X01"
  | "Cricket"
  | "Tour de l'horloge"
  | "Battle Royale"
  | "Killer"
  | "Shanghai"
  | "Bob's 27"
  | "Baseball"
  | "Tic-Tac-Toe"
  | "Mario Dart"
  | "Knockout"
  | "Halve-It"
  | "Scram"
  | "Shooter"
  | "Prisonner"
  | "Finish 170"
  | "Finish 121"
  | "Training";

  type Route = 'home' | 'games' | 'lobby' | 'game' | 'gamestats' | 'profiles' | 'stats' | 'teams' | 'settings';

/* ---------- Events / Games (journal & historique) ---------- */
type Dart = { mult: 1 | 2 | 3; val: number }; // 25 = bull (DB si mult===2)

type GameEvent = {
  id: string;
  ts: number;
  profileId: string;
  mode: Mode;
  darts: Dart[];
  total: number;
  tags?: string[];
  meta?: { gameId?: string; leg?: number; x01Before?: number; x01After?: number };
};

type GameRecord = {
  id: string;
  mode: Mode;
  startedAt: number;
  finishedAt?: number;
  players: { profileId: string; name: string }[];
  winnerId?: string;
  notes?: string;
};

/* =========================================
   Defaults
   ========================================= */
const DEFAULT_THEME: Theme = {
  primary: "#f59e0b",
  secondary: "#0ea5e9",
  surface: "#0b0b0d",
  text: "#f5f5f5",
};
const DEFAULT_RULES: MatchRules = { startingScore: 501, doubleOut: true, legsToWinSet: 3, setsToWinMatch: 2, randomOrder: false, };

/* =========================================
   Global mini styles helper
   ========================================= */
function GlobalStyles() {
  return (
    <style>{`
      :root{
        --c-primary: ${DEFAULT_THEME.primary};
        --c-text: ${DEFAULT_THEME.text};
      }
      *{ box-sizing: border-box; }
      html, body, #root { height: 100%; }
      button { font: inherit; }
      @media (max-width: 768px){
        .hide-sm { display: none !important; }
        .show-sm { display: initial !important; }
      }
      @media (min-width: 769px){
        .hide-lg { display: none !important; }
      }
    `}</style>
  );
}

// ============================
// 📘 RÈGLES OFFICIELLES PAR JEU
// ============================

const GAME_RULES: Record<string, string> = {
  X01: `
Objectif : Atteindre exactement zéro en partant de 501 (ou 301).
Chaque fléchette soustrait son score du total. 
La dernière fléchette doit être un double (ou le Bull double) pour finir la manche.
`,
  CRICKET: `
Objectif : Fermer les numéros 15 à 20 et le Bull avant l’adversaire.
Un simple compte pour 1, un double pour 2 et un triple pour 3. 
Une fois fermé, tu marques des points si ton adversaire ne l’a pas encore fermé.
`,
  TOUR_DE_LHORLOGE: `
Objectif : Toucher tous les numéros dans l’ordre de 1 à 20, puis le Bull.
Un seul tir par chiffre. Le premier joueur à finir gagne la partie.
`,
  BATTLE_ROYALE: `
Objectif : Survivre le plus longtemps possible. 
Tous les joueurs commencent avec 3 vies. 
À chaque tour, le joueur avec le plus petit score perd une vie. 
Quand il ne reste qu’un joueur, il remporte la manche !
`,
  KILLER: `
Chaque joueur reçoit un numéro aléatoire entre 1 et 20. 
Il doit d’abord toucher le double de ce numéro pour devenir un "Killer". 
Une fois Killer, chaque double touché du numéro d’un adversaire lui enlève une vie.
Dernier joueur en vie gagne la partie.
`,
  SHANGHAI: `
Chaque manche cible un numéro (1 à 20). 
Simple = 1 point, double = 2, triple = 3. 
Faire simple + double + triple du même chiffre dans la manche = “Shanghai” → victoire immédiate !
`,
  BOBS_27: `
Chaque joueur commence avec 27 points. 
Chaque manche cible un double spécifique. 
Si tu touches, tu gagnes le double de la valeur (ex: D10 = +20). 
Si tu rates les 3 fléchettes, tu perds la valeur du double. 
Le score tombe à zéro → éliminé.
`,
  BASEBALL: `
Jeu en 9 manches. Chaque manche cible un numéro (1 à 9). 
Simple = 1 point, double = 2, triple = 3. 
Le joueur avec le plus haut total à la fin gagne.
`,
  TIC_TAC_TOE: `
Deux joueurs s’affrontent sur une grille de 9 cases (3x3). 
Chaque case correspond à un numéro à fermer. 
Ferme une ligne (horizontal, vertical, diagonal) pour gagner.
`,
  MARIO_DART: `
Variante fun : chaque volée active un bonus ou un malus aléatoire. 
Exemples : “+50 points”, “inversion du score”, “lancer annulé”.
`,
  KNOCKOUT: `
Chaque joueur joue après l’autre. 
Si ton score est inférieur à celui du joueur précédent, tu perds une vie. 
À zéro vie → éliminé. Dernier joueur restant gagne.
`,
  HALVE_IT: `
Chaque tour a un objectif (ex : T20, D16, Bull). 
Rater l’objectif divise ton score total par deux. 
Le joueur avec le plus haut score à la fin gagne.
`,
  SCRAM: `
Deux rôles : un marqueur et un bloqueur. 
Le bloqueur tente de fermer les chiffres 1 à 20 et Bull. 
Une fois fermé, le marqueur ne peut plus marquer dessus. 
Les rôles s’inversent à mi-partie.
`,
  SHOOTER: `
Objectif : marquer le plus haut score possible sur un nombre de tours fixe. 
Tous les chiffres et multiplications comptent.
`,
  PRISONNER: `
Rater la cible Bull te met en prison. 
Pour sortir, tu dois toucher le Double 20. 
Tu ne peux pas marquer tant que tu es prisonnier !
`,
  FINISH_121: `
Commence à 121 points. 
Tu as 9 fléchettes maximum pour finir exactement à zéro. 
Double obligatoire pour finir. Si tu rates → échec.
`,
  FINISH_170: `
Commence à 170 points. 
Objectif : checkout parfait en 3 fléchettes (T20 + T20 + Bull). 
Moins de 3 fléchettes → manche perdue.
`,
};
/* Associe les valeurs du type Mode aux clés de GAME_RULES */
const MODE_TO_RULE_KEY: Record<string, string> = {
  "X01": "X01",
  "Cricket": "CRICKET",
  "Tour de l'horloge": "TOUR_DE_LHORLOGE",
  "Battle Royale": "BATTLE_ROYALE",
  "Killer": "KILLER",
  "Shanghai": "SHANGHAI",
  "Bob's 27": "BOBS_27",
  "Baseball": "BASEBALL",
  "Tic-Tac-Toe": "TIC_TAC_TOE",
  "Mario Dart": "MARIO_DART",
  "Knockout": "KNOCKOUT",
  "Halve-It": "HALVE_IT",
  "Scram": "SCRAM",
  "Shooter": "SHOOTER",
  "Prisonner": "PRISONNER",
  "Finish 121": "FINISH_121",
  "Finish 170": "FINISH_170",
  "Training": "TRAINING", // si tu as ajouté TRAINING dans GAME_RULES
};
// =========================================
// GameStatsPage (aperçu des stats de partie)
// =========================================
function GameStatsPage({
  players,
  onBack,
}: {
  players: Player[];
  onBack: () => void;
}) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <button
        onClick={onBack}
        style={{
          background: "#111",
          color: "#fff",
          border: "1px solid #333",
          padding: "8px 12px",
          borderRadius: 12,
        }}
      >
        ← Retour
      </button>

      <h3 style={{ fontWeight: 800, fontSize: 18 }}>📊 Stats de la partie</h3>

      <div style={{ display: "grid", gap: 8 }}>
        {players.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: 10,
              background: "#121212",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={p.name} src={p.avatarDataUrl} size={40} />
              <b>{p.name}</b>
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 13 }}>
              Darts <b>{p.dartsUsed}</b> • Dernière volée <b>{p.lastScore}</b> • Moy 3D{" "}
              <b>
                {(((501 - p.x01Score) / Math.max(1, p.dartsUsed)) * 3).toFixed(2)}
              </b>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================
   App
   ========================================= */
   export default function App() {
    return (
      <div style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(1200px 600px at 30% -10%, #141517, #0a0a0a 40%, #000)",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      }}>
        <div style={{
          padding: 24,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.08)",
          background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
          textAlign: "center"
        }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Darts Counter</h1>
          <p style={{ opacity: .8, marginTop: 8 }}>Build de test — Vercel OK</p>
        </div>
      </div>
    );
  }
  

/* =========================================
   Header (bouton installer PWA)
   ========================================= */
function Header({ onInstall }: { onInstall: () => void }) {
  return (
    <header className="hide-sm" style={{ maxWidth: 1000, margin: "0 auto", padding: "8px 16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Darts Counter</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>UI “verre dépoli” • PWA ready</div>
        </div>
        <button
          onClick={onInstall}
          style={{
            background: "var(--c-primary)",
            color: "#111",
            padding: "8px 12px",
            border: "none",
            borderRadius: 10,
            fontWeight: 800,
          }}
        >
          Installer
        </button>
      </div>
    </header>
  );
}

/* =========================================
   Home (avec logo + boutons d'accueil)
   ========================================= */
   function Home({
    onGoProfiles,
    onGoGames,
    onGoOnline = () => alert("Le jeu en ligne arrive bientôt 👀"),
    onGoStats,
  }: {
    onGoProfiles: () => void;
    onGoGames: () => void;
    onGoOnline?: () => void;
    onGoStats: () => void;
  }) {
    return (
      <section style={{ display: "grid", gap: 24 }}>
        {/* HEADER AVEC LOGO + TITRE */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginBottom: 8,
          }}
        >
          <img
            src="/LOGO DARTS COUNTER.png"
            alt="Darts Counter Logo"
            style={{
              width: 150,
              height: 150,
              objectFit: "contain",
              filter: "drop-shadow(0 0 8px rgba(245,158,11,.35))",
            }}
          />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 18, opacity: 0.9 }}>Bienvenue</div>
            <div
              style={{
                fontWeight: 900,
                fontSize: 34,
                letterSpacing: 0.3,
                marginTop: 2,
                color: "var(--c-primary)",
                textShadow:
                  "0 3px 0 rgba(0,0,0,.55), 0 0 18px rgba(245,158,11,.25), 0 10px 16px rgba(0,0,0,.35)",
              }}
            >
              DARTS COUNTER
            </div>
          </div>
        </div>
  
        {/* === BOUTONS PRINCIPAUX === */}
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          }}
        >
          {/* 1. PROFILS */}
          <button
            onClick={onGoProfiles}
            style={buttonStyle}
          >
            <div style={titleRow}><Icon name="user" /><b>PROFILS</b></div>
            <div style={descStyle}>Création et gestion de profils</div>
          </button>
  
          {/* 2. JEU LOCAL */}
          <button
            onClick={onGoGames}
            style={buttonStyle}
          >
            <div style={titleRow}><Icon name="dart" /><b>JEU LOCAL</b></div>
            <div style={descStyle}>Accède à tous les modes de jeu</div>
          </button>
  
          {/* 3. JEU ONLINE */}
          <button
            onClick={onGoOnline}
            style={buttonStyle}
          >
            <div style={titleRow}><Icon name="folder" /><b>JEU ONLINE</b></div>
            <div style={descStyle}>Fonctionnalité à venir (parties à distance)</div>
          </button>
  
          {/* 4. STATS */}
          <button
            onClick={onGoStats}
            style={buttonStyle}
          >
            <div style={titleRow}><Icon name="chart" /><b>STATS</b></div>
            <div style={descStyle}>Statistiques et historiques de parties</div>
          </button>
        </div>
      </section>
    );
  }
  
  /* === STYLES COMMUNS === */
  const buttonStyle: React.CSSProperties = {
    textAlign: "left",
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.08)",
    background:
      "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
    display: "grid",
    gap: 8,
    cursor: "pointer",
    transition: "all 0.25s ease",
  };
  
  const titleRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 900,
    fontSize: 16,
    color: "var(--c-primary)",
  };
  
  const descStyle: React.CSSProperties = {
    opacity: 0.8,
    fontSize: 13,
    color: "#ccc",
  };  

/* =========================================
   GamesHub (placeholder)
   ========================================= */
/* ===================== GamesHub (menu des jeux) ===================== */
function GamesHub({
  current,
  onPick,
}: {
  current: string;
  onPick: (mode: string) => void;
}) {
  // Liste visible
  const games: Array<{ key: string; label: string; desc: string }> = [
    { key: "X01", label: "X01", desc: "301/501/701/1001 — double-out" },
    { key: "Cricket", label: "Cricket", desc: "15–20 + Bull, fermetures & points" },
    { key: "Tour de l'horloge", label: "Tour de l'horloge", desc: "1→20 puis Bull, en ordre" },
    { key: "Battle Royale", label: "Battle Royale", desc: "Vies, manches, éliminations" },
    { key: "Killer", label: "Killer", desc: "Double de ton numéro → deviens Killer" },
    { key: "Shanghai", label: "Shanghai", desc: "Cible du tour, S/D/T — Shanghai = win" },
    { key: "Bob's 27", label: "Bob’s 27", desc: "Doubles successifs, +/− points" },
    { key: "Baseball", label: "Baseball", desc: "9 manches, S=1 D=2 T=3" },
    { key: "Tic-Tac-Toe", label: "Tic-Tac-Toe", desc: "Grille 3×3, fermer une ligne" },
    { key: "Mario Dart", label: "Mario Dart", desc: "Bonus/malus fun à chaque volée" },
    { key: "Knockout", label: "Knockout", desc: "Score < joueur précédent → vie −1" },
    { key: "Halve-It", label: "Halve-It", desc: "Rater l’objectif = score ÷ 2" },
    { key: "Scram", label: "Scram", desc: "Bloquer vs marquer, rôles alternés" },
    { key: "Shooter", label: "Shooter", desc: "Maximiser le score sur tours fixes" },
    { key: "Prisonner", label: "Prisonner", desc: "Prison si échec, D20 pour sortir" },
    { key: "Finish 121", label: "Finish 121", desc: "Finir 121 en 9 darts (double-out)" },
    { key: "Finish 170", label: "Finish 170", desc: "Checkout parfait T20+T20+Bull" },
    { key: "Training", label: "TRAINING", desc: "Simple · Double · Score" },
  ];

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Tous les jeux</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Choisis un mode — clique sur <b>i</b> pour voir les règles
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {games.map((g) => (
          <div
            key={g.key}
            style={{
              borderRadius: 16,
              border: "1px solid #2a2a2a",
              background:
                "linear-gradient(180deg, rgba(20,20,24,.55), rgba(10,10,12,.85))",
              padding: 14,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>{g.label}</div>
              <div style={{ marginLeft: "auto" }}>
                <InfoButton mode={g.key} />
              </div>
            </div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{g.desc}</div>
            <button
              onClick={() => onPick(g.key)}
              style={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.08)",
                background:
                  current === g.key
                    ? "linear-gradient(180deg, #fbbf24, #f59e0b)"
                    : "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
                color: current === g.key ? "#111" : "#eee",
                padding: "8px 12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {current === g.key ? "Sélectionné" : "Choisir"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================
   ProfilesPage (minimal, compile)
   ========================================= */
function ProfilesPage({
  profiles,
  setProfiles,
  teams,
  setTeams,
  events,
}: {
  profiles: Profile[];
  setProfiles: (u: any) => void;
  teams: Team[];
  setTeams: (u: any) => void;
  events: GameEvent[];
}) {
  const [selectedId, setSelectedId] = useState<string>(() => profiles[0]?.id || "");
  const selected = useMemo(() => profiles.find((p) => p.id === selectedId), [profiles, selectedId]);

  const [newName, setNewName] = useState("");

  async function uploadAvatar(f?: File) {
    if (!selected || !f) return;
    const url = await fileToDataURL(f);
    setProfiles((arr: Profile[]) => arr.map((p) => (p.id === selected.id ? { ...p, avatarDataUrl: url } : p)));
  }

  function addProfile() {
    const name = newName.trim() || `Joueur ${profiles.length + 1}`;
    const p: Profile = { id: uid(), name, stats: { games: 0, legs: 0, darts: 0, sets: 0 } };
    setProfiles((arr: Profile[]) => [...arr, p]);
    setNewName("");
    setSelectedId(p.id);
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div className="hide-sm">
        <SectionTabs
          tabs={[
            { key: "list", label: "Profils", icon: "user" },
            { key: "stats", label: "Stats (bêta)", icon: "chart" },
          ]}
          value={"list"}
          onChange={() => {}}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12 }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,.08)",
            background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
            borderRadius: 12,
            padding: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
  <input
    value={newName}
    onChange={(e) => setNewName(e.target.value)}
    placeholder="Nom du profil"
    style={{
      flex: 1,
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid #333",
      background: "#0f0f10",
      color: "#eee",
      fontSize: 14,
    }}
  />

  <button
    onClick={addProfile}
    aria-label="Ajouter un joueur"
    title="Ajouter un joueur"
    onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
    onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    style={{
      width: 32,
      height: 32,
      minWidth: 32,
      minHeight: 32,
      borderRadius: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--c-primary)",
      color: "#111",
      border: "1px solid rgba(0,0,0,.25)",
      boxShadow: "0 6px 14px rgba(0,0,0,.35)",
      lineHeight: 1,
      padding: 0,
      cursor: "pointer",
      fontWeight: 800,
    }}
  >
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {/* Silhouette de joueur */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        style={{ opacity: 0.9 }}
      >
        <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-6-5-6-5 2.686-5 6 2.239 6 5 6zm0 2c-4.418 0-8 2.239-8 5v3h16v-3c0-2.761-3.582-5-8-5z"/>
      </svg>
      <span>+</span>
    </span>
  </button>
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 380, overflow: "auto", paddingRight: 4 }}>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 8,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.08)",
                  background:
                    selectedId === p.id
                      ? "radial-gradient(120px 60px at 50% -20%, rgba(245,158,11,.35), rgba(245,158,11,.08))"
                      : "#0e0e10",
                  color: selectedId === p.id ? "var(--c-primary)" : "#e7e7e7",
                  fontWeight: selectedId === p.id ? 800 : 600,
                }}
              >
                <Avatar name={p.name} src={p.avatarDataUrl} />
                <div>
                  <div>{p.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {p.stats?.games ?? 0} parties · {p.stats?.legs ?? 0} legs · {p.stats?.darts ?? 0} darts
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,.08)",
            background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {!selected ? (
            <div style={{ opacity: 0.7 }}>Sélectionne un profil.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Avatar name={selected.name} src={selected.avatarDataUrl} size={100} />
                <input
                  value={selected.name}
                  onChange={(e) =>
                    setProfiles((arr: Profile[]) =>
                      arr.map((p) => (p.id === selected.id ? { ...p, name: e.target.value } : p))
                    )
                  }
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #333",
                    background: "#0f0f10",
                    color: "#eee",
                  }}
                />
                <label
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.08)",
                    background: "#111",
                    cursor: "pointer",
                  }}
                >
                  Changer avatar
                  <input
                    type="file"
                    accept="image/*"
                    className="hide-lg"
                    onChange={(e) => uploadAvatar(e.target.files?.[0])}
                  />
                </label>
              </div>

              <div style={{ fontWeight: 700, marginBottom: 6 }}>Aperçu des stats (volées)</div>
              <div style={{ fontSize: 14, opacity: 0.85 }}>
                Volées enregistrées pour ce profil :{" "}
                {events.filter((ev) => ev.profileId === selected.id).length}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* =========================================
   LobbyPage (avec ordre, mélange, badges)
   ========================================= */
   function LobbyPage({
    mode,
    teams,
    profiles,
    rules,
    setRules,
    onStart,
    onBack,
  }: {
    mode: Mode;
    teams: Team[];
    profiles: Profile[];
    rules: MatchRules;
    setRules: (r: MatchRules) => void;
    onStart: (players: Player[], customRules?: MatchRules) => void;
    onBack: () => void;
  }) {
    // état local
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [localRules, setLocalRules] = React.useState<MatchRules>(rules);
  
    // shuffle Fisher–Yates
    function shuffle<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
  
    function toggle(id: string) {
      setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    }
  
    function reshuffleSelected() {
      setSelectedIds((ids) => shuffle(ids));
    }
  
    function onToggleRandomOrder(checked: boolean) {
      setLocalRules((r) => ({ ...r, randomOrder: checked }));
      if (checked) reshuffleSelected();
    }
  
    function start() {
      // respecte l’ordre coché dans selectedIds
      const chosen = selectedIds
        .map((id) => profiles.find((p) => p.id === id))
        .filter(Boolean)
        .map<Player>((p) => ({
          id: uid(),
          name: p!.name,
          profileId: p!.id,
          avatarDataUrl: p!.avatarDataUrl,
          teamId: p!.teamId,
          x01Score: localRules.startingScore,
          legs: 0,
          sets: 0,
          dartsUsed: 0,
          lastScore: 0,
          points: 0,
          lives: 3,
          atcTarget: 1,
        }));
  
      if (chosen.length === 0) {
        alert("Sélectionne au moins 1 joueur.");
        return;
      }
  
      const finalPlayers = localRules.randomOrder ? shuffle(chosen) : chosen;
      onStart(finalPlayers, localRules);
    }
  
    return (
      <section style={{ display: "grid", gap: 12 }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <GlassButton onClick={onBack} leftIcon="folder">Retour</GlassButton>
          <div style={{ opacity: 0.8 }}>Mode : <b>{mode}</b></div>
        </div>
  
        {/* Deux colonnes : Joueurs / Paramètres */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* === Colonne Joueurs === */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,.08)",
              background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Joueurs</div>
            <div style={{ display: "grid", gap: 6, maxHeight: 360, overflow: "auto", paddingRight: 4 }}>
              {profiles.map((p) => {
                const index = selectedIds.indexOf(p.id);
                const is = index !== -1;
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      textAlign: "left",
                      padding: 8,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,.08)",
                      background: is
                        ? "radial-gradient(120px 60px at 50% -20%, rgba(245,158,11,.35), rgba(245,158,11,.08))"
                        : "#0e0e10",
                      color: is ? "var(--c-primary)" : "#e7e7e7",
                      fontWeight: is ? 800 : 600,
                      cursor: "pointer",
                    }}
                  >
                    {/* badge d'ordre */}
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 900,
                        background: is ? "var(--c-primary)" : "#222",
                        color: is ? "#111" : "#aaa",
                        border: "1px solid rgba(255,255,255,.12)",
                      }}
                      title={is ? `Ordre #${index + 1}` : "Non sélectionné"}
                    >
                      {is ? index + 1 : "—"}
                    </div>
  
                    <Avatar name={p.name} src={p.avatarDataUrl} />
                    <div>
                      <div>{p.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {teams.find((t) => t.id === p.teamId)?.name || "(Aucune équipe)"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
  
          {/* === Colonne Paramètres === */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,.08)",
              background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Paramètres</div>
  
            {mode === "X01" && (
              <>
                <div style={{ marginBottom: 6, opacity: 0.8 }}>Score de départ</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {[301, 501, 701, 1001].map((s) => (
                    <GlassButton
                      key={s}
                      onClick={() => setLocalRules({ ...localRules, startingScore: s })}
                      active={localRules.startingScore === s}
                    >
                      {s}
                    </GlassButton>
                  ))}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.9 }}>
                  <input
                    type="checkbox"
                    checked={localRules.doubleOut}
                    onChange={(e) => setLocalRules({ ...localRules, doubleOut: e.target.checked })}
                  />
                  Sortie en double
                </label>
              </>
            )}
  
            {/* Legs / Sets */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div>
                <div style={{ marginBottom: 4, opacity: 0.8 }}>Legs / set</div>
                <input
                  type="number"
                  min={1}
                  value={localRules.legsToWinSet}
                  onChange={(e) =>
                    setLocalRules({
                      ...localRules,
                      legsToWinSet: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #333",
                    background: "#0f0f10",
                    color: "#eee",
                  }}
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, opacity: 0.8 }}>Sets / match</div>
                <input
                  type="number"
                  min={1}
                  value={localRules.setsToWinMatch}
                  onChange={(e) =>
                    setLocalRules({
                      ...localRules,
                      setsToWinMatch: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #333",
                    background: "#0f0f10",
                    color: "#eee",
                  }}
                />
              </div>
            </div>
  
            {/* ===== Ordre de jeu ===== */}
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.08)",
                background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Ordre de jeu</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: 0.9 }}>
                <input
                  type="checkbox"
                  checked={!!localRules.randomOrder}
                  onChange={(e) => onToggleRandomOrder(e.target.checked)}
                />
                Tirage aléatoire au lancement
              </label>
  
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <GlassButton onClick={reshuffleSelected}>Mélanger maintenant</GlassButton>
              </div>
  
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                Astuce : l’ordre affiché (#1, #2, …) est celui utilisé au démarrage.
              </div>
            </div>
  
            {/* Actions */}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <GlassButton onClick={start} leftIcon="dart">Lancer la partie</GlassButton>
              <GlassButton onClick={onBack} leftIcon="folder">Annuler</GlassButton>
            </div>
          </div>
        </div>
      </section>
    );
  }  

/* =========================================
   GamePage — volée = 3 fléchettes (dartsUsed +3 par volée)
   ========================================= */
   function GamePage({
    mode,
    rules,
    players,
    setPlayers,
    activeId,
    setActiveId,
    onEnd,
    speak,
    ttsLang,
  }: {
    mode: Mode;
    rules: MatchRules;
    players: Player[];
    setPlayers: (u: any) => void;
    activeId: string;
    setActiveId: (id: string) => void;
    onEnd: () => void;
    speak: (text: string) => void;
    ttsLang: string;
  }) {
    // ===== helpers joueurs =====
    const idx = (id: string) => players.findIndex((p) => p.id === id);
    const nextId = (id: string) =>
      players[(idx(id) + 1) % Math.max(players.length, 1)]?.id || id;
    const active = players.find((p) => p.id === activeId) || players[0];
  
    // ===== volée courante (3 fléchettes) =====
    const [turnDarts, setTurnDarts] = React.useState<Array<Dart | null>>([null, null, null]);
    React.useEffect(() => { setTurnDarts([null, null, null]); }, [activeId]);
  
    // ===== utilitaires =====
    const dartPoints = (d: Dart) => (d.val === 25 ? (d.mult === 2 ? 50 : 25) : d.val * d.mult);
    const fmtD = (d?: Dart | null) => {
      if (!d) return "•";
      if (d.val === 0) return "0";
      if (d.val === 25) return d.mult === 2 ? "DBull" : "Bull";
      return (d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S") + d.val;
    };
    const turnTotal = React.useMemo(
      () => turnDarts.map(d => d ?? ({mult:1,val:0} as Dart)).reduce((s,d)=> s + dartPoints(d), 0),
      [turnDarts]
    );
  
    // Score restant live pour X01 (sans valider)
    const liveRemaining = React.useMemo(() => {
      if (!active || mode !== "X01") return 0;
      return Math.max(0, (active.x01Score ?? rules.startingScore) - turnTotal);
    }, [active, mode, rules, turnTotal]);
  
    // Moyenne PAR VOLÉE (3D) — n'utilise QUE dartsUsed (pas la volée en cours)
    function avgPerVolee(p: Player): string {
      const darts = p.dartsUsed ?? 0;
      const total = (p as any).scoredTotal ?? 0; // cumul points validés
      if (darts === 0) return "0.00";
      return ((total / darts) * 3).toFixed(2);
    }
  
    // Checkout live (X01 uniquement, 2..170)
    const liveCheckout = React.useMemo(() => {
      if (!active || mode !== "X01") return "";
      const s = liveRemaining;
      if (s <= 1 || s > 170) return "";
      const MAP: Record<number, string> | undefined = (globalThis as any).CHECKOUTS;
      return MAP && MAP[s] ? MAP[s] : "";
    }, [active, mode, liveRemaining]);
  
    // ===== appliquer la volée =====
    function applyX01(darts: Dart[]) {
      if (!active) return;
  
      const total = darts.reduce((s,d)=> s + dartPoints(d), 0);
      const current = active.x01Score ?? rules.startingScore;
      const next = current - total;
      const last = darts[2] || darts[1] || darts[0];
  
      let bust = false;
      if (next < 0) bust = true;
      if (rules.doubleOut && next === 1) bust = true;
      if (rules.doubleOut && next === 0) {
        const okDouble = last && (last.mult === 2 || (last.val === 25 && last.mult === 2));
        if (!okDouble) bust = true;
      }
  
      // ➜ +3 darts EXACTEMENT ici, une seule fois par volée
      setPlayers((ps: Player[]) =>
        ps.map((p) => {
          if (p.id !== active.id) return p;
  
          const base = {
            ...p,
            dartsUsed: (p.dartsUsed ?? 0) + 3,
            lastScore: bust ? 0 : total,
            scoredTotal: ((p as any).scoredTotal ?? 0) + (bust ? 0 : total),
            ...( { lastDarts: bust ? [] : darts } as any ),
          };
  
          if (next === 0 && !bust) {
            // victoire du leg → reset score, +1 leg, gestion set
            let newLegs = (p.legs ?? 0) + 1;
            let newSets = p.sets ?? 0;
            if (rules?.legsToWinSet && newLegs >= rules.legsToWinSet) {
              newLegs = 0; newSets += 1;
            }
            return {
              ...base,
              x01Score: rules.startingScore,
              legs: newLegs,
              sets: newSets,
            };
          }
  
          return {
            ...base,
            x01Score: bust ? p.x01Score : next,
          };
        })
      );
  
      // TTS (feedback)
      if (next === 0 && !bust) {
        speak(ttsLang?.startsWith("fr") ? `${active.name}, ${total}` : `${active.name}, ${total}`);
      } else if (bust) {
        speak(ttsLang?.startsWith("fr") ? `${active.name}, raté` : `${active.name}, bust`);
      } else {
        speak(ttsLang?.startsWith("fr") ? `${active.name}, ${total}` : `${active.name}, ${total}`);
      }
  
      setTurnDarts([null, null, null]);
      setActiveId(nextId(active.id));
    }
  
    function applyGeneric(darts: Dart[]) {
      if (!active) return;
  
      const t = darts.reduce((s,d)=> s + dartPoints(d), 0);
  
      setPlayers((ps: Player[]) =>
        ps.map((p) =>
          p.id === active.id
            ? {
                ...p,
                points: (p.points ?? 0) + t,
                dartsUsed: (p.dartsUsed ?? 0) + 3,             // ➜ +3 EXACT par volée
                lastScore: t,
                scoredTotal: ((p as any).scoredTotal ?? 0) + t, // cumul pour moyenne
                ...( { lastDarts: darts } as any ),
              }
            : p
        )
      );
  
      speak(ttsLang?.startsWith("fr") ? `${active.name}, ${t}` : `${active.name}, ${t}`);
  
      setTurnDarts([null, null, null]);
      setActiveId(nextId(active.id));
    }
  
    function submitTurn(darts: Dart[]) {
      if (mode === "X01") return applyX01(darts);
      return applyGeneric(darts);
    }
  
    // Le clavier envoie chaque fléchette pour l’affichage live
    function onDart(dart: Dart, index: number) {
      setTurnDarts((ds) => { const c=[...ds]; c[index]=dart; return c; });
    }
  
    // ===== early exit s'il n'y a pas de joueurs =====
    if (!active) {
      return (
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ opacity: 0.7 }}>Aucun joueur.</div>
          <button
            onClick={onEnd}
            style={{ background:"#111", color:"#fff", border:"1px solid #333", padding:"8px 12px", borderRadius:12, cursor:"pointer" }}
          >
            ← Quitter
          </button>
        </section>
      );
    }
  
    // ===== styles cartoon =====
    const cartoonScore: React.CSSProperties = {
      fontFamily: `"Luckiest Guy", Impact, "Lilita One", system-ui, sans-serif`,
      fontSize: 52,
      lineHeight: 1,
      letterSpacing: 0.5,
      color: "var(--c-primary)",
      textShadow: "0 3px 0 rgba(0,0,0,.55), 0 0 18px rgba(245,158,11,.25), 0 10px 16px rgba(0,0,0,.35)",
    };
    const cartoonNumberSmall: React.CSSProperties = {
      ...cartoonScore,
      fontSize: 28,
      textShadow: "0 2px 0 rgba(0,0,0,.55), 0 0 10px rgba(245,158,11,.20), 0 6px 10px rgba(0,0,0,.30)",
    };
  
    const currentThrowStr = turnDarts.map(fmtD).join("  +  ");
    const inTurn = turnDarts.filter(Boolean).length; // 0..3 (affichage seulement)
  
    // ===== rendu principal =====
    return (
      <section style={{ display: "grid", gap: 12 }}>
        {/* Top bar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
          <button onClick={onEnd} style={{ background:"#111", color:"#fff", border:"1px solid #333", borderRadius:12, padding:"8px 12px", cursor:"pointer" }}>
            ← Quitter
          </button>
          <div style={{ opacity: 0.85 }}>Mode : <b>{mode}</b></div>
        </div>
  
        {/* Joueur actif : avatar XL + score XXL + volée en cours + checkout */}
        <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:16, alignItems:"center", border:"1px solid #2a2a2a", background:"#0f0f0f", borderRadius:16, padding:14 }}>
          <Avatar name={active.name} src={(active as any).avatarDataUrl} size={120} />
          <div style={{ display:"grid", gap:8 }}>
            {/* SCORE XXL cartoon */}
            <div style={cartoonScore}>
              {mode === "X01" ? (active.x01Score ?? rules.startingScore) - turnTotal : (active.points ?? 0)}
            </div>
  
            {/* Stats sous le score — Darts ne compte PAS la volée en cours */}
            <div style={{ fontSize: 13, opacity: .9 }}>
              Darts : <b>{active.dartsUsed ?? 0}</b> &nbsp;•&nbsp; Moy/3D : <b>{avgPerVolee(active)}</b>
            </div>
            <div style={{ fontSize: 12, opacity: .7 }}>
              Volée : {inTurn}/3
            </div>

            <NeonDartBoxes darts={turnDarts} />

            {/* Checkout uniquement s’il est possible */}
            {!!liveCheckout && ( 
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
              Checkout : <b>{liveCheckout}</b>
            </div>
          )}
          </div>
        </div>
  
        {/* Roster repliable : chaque joueur avec dernière volée + score cartoon small + stats */}
        <details style={{ border:"1px solid #2a2a2a", background:"#0f0f0f", borderRadius:16, padding:10 }}>
          <summary style={{ cursor:"pointer", fontWeight:800, opacity:.9 }}>Joueurs</summary>
          <div style={{ display:"grid", gap:8, marginTop:8, maxHeight:260, overflow:"auto", paddingRight:4 }}>
            {players.map((p) => {
              const lastD: Dart[] = ((p as any).lastDarts as Dart[]) || [];
              const lastStr = lastD.length ? lastD.map(fmtD).join(" + ") : "—";
              const scoreNow = mode === "X01" ? p.x01Score : (p.points ?? 0);
              return (
                <div
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  style={{
                    cursor:"pointer",
                    display:"grid",
                    gridTemplateColumns:"auto 1fr auto",
                    gap:10, alignItems:"center",
                    padding:10,
                    borderRadius:12,
                    background: p.id===activeId ? "#191919" : "#121212",
                    border:"1px solid #2a2a2a",
                  }}
                >
                  <Avatar name={p.name} src={(p as any).avatarDataUrl} size={56} />
                  <div>
                    <div style={{ fontWeight:800 }}>{p.name}</div>
                    <div style={{ fontSize:12, opacity:.75 }}>
                      Dernière volée : <b>{lastStr}</b>{p.lastScore ? ` = ${p.lastScore}` : ""}
                    </div>
                    <div style={{ fontSize:12, opacity:.75, marginTop:2 }}>
                      Darts : <b>{p.dartsUsed ?? 0}</b> • Moy/3D : <b>{avgPerVolee(p)}</b>
                    </div>
                  </div>
                  <div style={cartoonNumberSmall}>{scoreNow}</div>
                </div>
              );
            })}
          </div>
        </details>
  
        {/* Keypad fixe : DOIT appeler onDart(dart, index) et onSubmit(darts) */}
        <div style={{ border:"1px solid #2a2a2a", background:"#0f0f0f", borderRadius:16, padding:12 }}>
          <X01Keypad
            onDart={(d, i)=> setTurnDarts((ds)=>{ const c=[...ds]; c[i]=d; return c; })}
            onSubmit={submitTurn}
          />
        </div>
      </section>
    );
  }   

/* =========================================
   SettingsPage (avec option voix / TTS)
   ========================================= */
   function SettingsPage({
    rules,
    setRules,
    arcade,
    setArcade,
    ttsEnabled,
    setTtsEnabled,
    ttsLang,
    setTtsLang,
  }: {
    rules: MatchRules;
    setRules: (r: MatchRules) => void;
    arcade: boolean;
    setArcade: (b: boolean) => void;
    ttsEnabled: boolean;
    setTtsEnabled: (b: boolean) => void;
    ttsLang: string;
    setTtsLang: (v: string) => void;
  }) {
    return (
      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Réglages</div>
  
        {/* ===== Bloc X01 ===== */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,.08)",
            background:
              "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>X01</div>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            {[301, 501, 701, 1001].map((s) => (
              <GlassButton
                key={s}
                onClick={() => setRules({ ...rules, startingScore: s })}
                active={rules.startingScore === s}
              >
                {s}
              </GlassButton>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={rules.doubleOut}
              onChange={(e) =>
                setRules({ ...rules, doubleOut: e.target.checked })
              }
            />
            Sortie en double
          </label>
        </div>

        {/* Ordre de jeu */}
<div
  style={{
    border: "1px solid rgba(255,255,255,.08)",
    background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  }}
>
  <div style={{ fontWeight: 700, marginBottom: 8 }}>Ordre de jeu</div>
  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <input
      type="checkbox"
      checked={!!rules.randomOrder}
      onChange={(e) => setRules({ ...rules, randomOrder: e.target.checked })}
    />
    Tirage **aléatoire** de l’ordre des joueurs au début de la partie
  </label>
</div>
  
        {/* ===== Bloc Ambiance ===== */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,.08)",
            background:
              "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Ambiance</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={arcade}
              onChange={(e) => setArcade(e.target.checked)}
            />
            Mode arcade (fond néon)
          </label>
        </div>
  
        {/* ===== Bloc Voix / TTS ===== */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,.08)",
            background:
              "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Annonces vocales (TTS)
          </div>
  
          {/* Activation de la voix */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => setTtsEnabled(e.target.checked)}
            />
            <span>Activer la voix à la 3ᵉ fléchette</span>
          </label>
  
          {/* Sélecteur de langue */}
          <div>
            <div style={{ marginBottom: 4, opacity: 0.8 }}>Langue</div>
            <select
              value={ttsLang}
              onChange={(e) => setTtsLang(e.target.value)}
              style={{
                background: "#111",
                color: "#eee",
                borderRadius: 8,
                border: "1px solid #333",
                padding: "6px 10px",
              }}
            >
              <option value="fr-FR">Français</option>
              <option value="en-US">English</option>
            </select>
          </div>
        </div>
      </section>
    );
  }  

/* ===================== Flèche retour harmonisée ===================== */
function BackArrowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Retour"
      style={{
        padding: "10px 0",
        borderRadius: 10,
        border: "1px solid #3a2a00",
        background: "#151515",
        color: "#fbbf24",
        fontWeight: 800,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {/* Flèche jaune sobre, style cartoon plat */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="34"
        height="34"
        fill="#fbbf24"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 3px rgba(255,191,36,0.4))" }}
      >
        <polygon points="15,4 5,12 15,20 15,14 21,14 21,10 15,10" />
      </svg>
    </button>
  );
}

/* ========= X01Keypad (3 fléchettes, auto-avance, BULL, retour ← néon) ========= */
function X01Keypad({
  onSubmit,
  onCancel,
  onDart,
  label = "Valider la volée",
  onPreview, // <-- nouveau : pour afficher les 3 carrés néon dans le profil actif
}: {
  onSubmit: (darts: Dart[]) => void;
  onCancel?: () => void;
  label?: string;
  onPreview?: (slots: Array<Dart | null>) => void;
}) {
  const [darts, setDarts] = React.useState<Array<Dart | null>>([null, null, null]); // 3 fléchettes
  const [active, setActive] = React.useState<number>(0);          // 0..2
  const [multNext, setMultNext] = React.useState<1 | 2 | 3>(1);   // multiplicateur à appliquer au prochain appui (S par défaut)

  // total pour affichage local (si tu veux l'utiliser)
  const total = React.useMemo(() => {
    const filled = darts.map((d) => d ?? { mult: 1, val: 0 });
    return filled.reduce((s, d) => (d.val === 25 ? s + (d.mult === 2 ? 50 : 25) : s + d.val * d.mult), 0);
  }, [darts]);

  // Place un nombre (0..20 ou 25=BULL) sur la fléchette active, avance, et soumet si 3e
  function putNumber(n: number) {
    const current = { mult: multNext, val: n } as Dart;
  
    // met à jour localement
    const copyAfter = [...darts];
    copyAfter[active] = current;
    setDarts(copyAfter);
  
    // informe GamePage -> met à jour turnDarts pour <NeonDartBoxes/>
    onDart?.(current, active);
  
    // prochaine fléchette en "Simple" par défaut
    setMultNext(1);
  
    // si 3e fléchette: soumettre immédiatement, sinon passer à la suivante
    if (active === 2) {
      onSubmit(copyAfter as Dart[]);
      // reset pour le tour suivant
      setDarts([null, null, null]);
      setActive(0);
      setMultNext(1);
    } else {
      setActive(active + 1);
    }
  }  

  // Efface la dernière fléchette saisie et revient dessus
  function backspace() {
    const last = [2, 1, 0].find((i) => darts[i] !== null) ?? 0;
    const copy = [...darts];
    copy[last] = null;
    setDarts(copy);
  
    // préviens GamePage qu'on efface cette fléchette
    onDart?.(null, last);
  
    setActive(last);
  }  

  // Soumission manuelle (rarement utile car on soumet auto à la 3e)
  function submitManuel() {
    const payload = darts.map((d) => d ?? ({ mult: 1, val: 0 } as Dart)) as Dart[];
    onSubmit(payload);
    const reset = [null, null, null] as Array<Dart | null>;
    setDarts(reset);
    onPreview?.(reset);
    setActive(0);
    setMultNext(1);
  }

  // styles utilitaires locale pour éviter les collisions
  const btnBase: React.CSSProperties = {
    padding: "10px 0",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.08)",
    background: "#151515",
    color: "#ddd",
    cursor: "pointer",
  };

  const neonBlue = (active: boolean): React.CSSProperties => ({
    padding: "10px 0",
    borderRadius: 12,
    border: "1px solid #1f3a45",
    background: active ? "#0c2530" : "#102228",
    color: "#aee3ff",
    fontWeight: 800,
    cursor: "pointer",
  });

  const neonPink = (active: boolean): React.CSSProperties => ({
    padding: "10px 0",
    borderRadius: 12,
    border: "1px solid #3a1f45",
    background: active ? "#2a0c30" : "#281022",
    color: "#ffb3e1",
    fontWeight: 800,
    cursor: "pointer",
  });

  const neonAmberBack: React.CSSProperties = {
    padding: "10px 0",
    borderRadius: 12,
    border: "1px solid rgba(245,158,11,.35)",
    background: "radial-gradient(100px 50px at 50% -20%, rgba(245,158,11,.25), rgba(245,158,11,.06))",
    color: "#fbbf24",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.15s ease",
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Flèche active 1/2/3 (indicateur) */}
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.08)",
              background: active === i
                ? "radial-gradient(120px 60px at 50% -20%, rgba(245,158,11,.28), rgba(245,158,11,.07))"
                : "#111",
              color: active === i ? "var(--c-primary)" : "#ddd",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Flèche {i + 1} {darts[i] ? "• ✓" : ""}
          </button>
        ))}
      </div>

      {/* DOUBLE / TRIPLE / ← Retour (harmonisés néon) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        <button onClick={() => setMultNext(2)} style={neonBlue(multNext === 2)}>DOUBLE</button>
        <button onClick={() => setMultNext(3)} style={neonPink(multNext === 3)}>TRIPLE</button>

        {/* Retour (flèche large vers la gauche) */}
        <button
          onClick={backspace}
          title="Retour"
          style={neonAmberBack}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {/* Icône flèche gauche lisible */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Pavé 0..20 + BULL */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
        <button style={btnBase} onClick={() => putNumber(0)}>0</button>
        {[...Array(20)].map((_, i) => (
          <button key={i + 1} style={btnBase} onClick={() => putNumber(i + 1)}>
            {i + 1}
          </button>
        ))}
        <button style={btnBase} onClick={() => putNumber(25)}>BULL</button>
      </div>

      {/* Actions (optionnel) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: "monospace", opacity: 0.85 }}>
          Total : <b>{total}</b> &nbsp;|&nbsp; Multi suivant :{" "}
          <b>{multNext === 1 ? "S" : multNext === 2 ? "D" : "T"}</b>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.08)",
                background: "#111",
                color: "#eee",
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
          )}
          <button
            onClick={submitManuel}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "none",
              background: "#fbbf24",
              color: "#111",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   Avatar
   ========================================= */
function Avatar({ name, src, size = 70 }: { name: string; src?: string; size?: number }) {
  const initials = (name || "?")
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return src ? (
    <img
      src={src}
      alt={name}
      style={{ width: size, height: size, borderRadius: 999, objectFit: "cover", border: "1px solid #333" }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "linear-gradient(180deg, #1a1a1d, #0e0e11)",
        border: "1px solid #333",
        display: "grid",
        placeItems: "center",
        fontSize: size < 28 ? 11 : 12,
        fontWeight: 800,
      }}
    >
      {initials}
    </div>
  );
}

/* =========================================
   NeonDartBoxes — 3 carrés néon pour la volée
   ========================================= */
   function NeonDartBoxes({ darts }: { darts: Array<Dart | null> }) {
    // injecte l'animation une seule fois
    useEffect(() => {
      const id = "dc-neon-box-style";
      if (!document.getElementById(id)) {
        const s = document.createElement("style");
        s.id = id;
        s.textContent = `
          @keyframes neonGlow {
            0%   { box-shadow: 0 0 0 rgba(245,158,11,0.0); }
            50%  { box-shadow: 0 0 16px 4px rgba(245,158,11,.55); }
            100% { box-shadow: 0 0 0 rgba(245,158,11,0.0); }
          }
        `;
        document.head.appendChild(s);
      }
    }, []);
  
    const boxBase: React.CSSProperties = {
      width: 54,
      height: 54,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,.08)",
      display: "grid",
      placeItems: "center",
      fontWeight: 900,
      fontSize: 18,
      letterSpacing: .3,
      background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
      color: "#eee",
    };
  
    function boxStyle(d: Dart | null): React.CSSProperties {
      if (!d) return boxBase;
      if (d.val === 0) return boxBase;
  
      // Couleurs selon multiplicateur
      if (d.val === 25) {
        // BULL : vert néon
        return {
          ...boxBase,
          color: "#0ff39b",
          border: "1px solid rgba(0, 255, 170, .35)",
          animation: "neonGlow 1.6s ease-in-out infinite",
        };
      }
      if (d.mult === 2) {
        // DOUBLE : bleu néon
        return {
          ...boxBase,
          color: "#91cbff",
          border: "1px solid rgba(145,203,255,.35)",
          animation: "neonGlow 1.6s ease-in-out infinite",
        };
      }
      if (d.mult === 3) {
        // TRIPLE : rose néon
        return {
          ...boxBase,
          color: "#ffb3e1",
          border: "1px solid rgba(255,179,225,.35)",
          animation: "neonGlow 1.6s ease-in-out infinite",
        };
      }
      // SIMPLE (par défaut)
      return {
        ...boxBase,
        color: "var(--c-primary)",
        border: "1px solid rgba(245,158,11,.35)",
        animation: "neonGlow 1.6s ease-in-out infinite",
      };
    }
  
    function label(d: Dart | null) {
      if (!d) return "—";
      if (d.val === 0) return "0";
      if (d.val === 25) return "BULL";
      const prefix = d.mult === 2 ? "D" : d.mult === 3 ? "T" : "S";
      return `${prefix}${d.val}`;
    }
  
    return (
      <div style={{ display: "flex", gap: 10 }}>
        <div style={boxStyle(darts[0] || null)}>{label(darts[0] || null)}</div>
        <div style={boxStyle(darts[1] || null)}>{label(darts[1] || null)}</div>
        <div style={boxStyle(darts[2] || null)}>{label(darts[2] || null)}</div>
      </div>
    );
  }  

/* =========================================
   Glass UI helpers
   ========================================= */
function GlassButton({
  children,
  onClick,
  active,
  leftIcon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  leftIcon?: IconName;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        border: active ? "1px solid rgba(245,158,11,.35)" : "1px solid rgba(255,255,255,.08)",
        background: active
          ? "radial-gradient(120px 60px at 50% -20%, rgba(245,158,11,.28), rgba(245,158,11,.07))"
          : "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
        color: active ? "var(--c-primary)" : "#e7e7e7",
        padding: "10px 14px",
        borderRadius: 14,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        transition: "all 160ms ease",
        fontWeight: active ? 800 : 700,
      }}
    >
      {leftIcon && <Icon name={leftIcon} active={active} />}
      {children}
    </button>
  );
}

/* =========================================
   Top & Bottom nav (verre dépoli + SVG)
   ========================================= */
type IconName = "home" | "dart" | "user" | "folder" | "chart" | "settings";

function TopGlassNav({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  return (
    <nav
      className="hide-sm"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        display: "flex",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,.07)",
        background: "linear-gradient(180deg, rgba(18,18,22,.55), rgba(10,10,12,.72))",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <NavButtons route={route} setRoute={setRoute} layout="row" />
    </nav>
  );
}

function BottomNav({ route, setRoute }: { route: Route; setRoute: (r: Route) => void }) {
  return (
    <nav
      className="show-sm"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: "grid",
        gridTemplateColumns: "repeat(6,1fr)",
        alignItems: "center",
        gap: 6,
        padding: "10px 12px",
        borderTop: "1px solid rgba(255,255,255,.07)",
        background: "linear-gradient(180deg, rgba(18,18,22,.55), rgba(10,10,12,.72))",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <NavButtons route={route} setRoute={setRoute} layout="grid" />
    </nav>
  );
}

function NavButtons({ route, setRoute, layout }: { route: Route; setRoute: (r: Route) => void; layout: "row" | "grid" }) {
  const items: { key: Route; label: string; icon: IconName }[] = [
    { key: "home", label: "Accueil", icon: "home" },
    { key: "games", label: "Jeux", icon: "dart" },
    { key: "profiles", label: "Profils", icon: "user" },
    { key: "allgames", label: "Tous les jeux", icon: "folder" },
    { key: "stats", label: "Stats", icon: "chart" },
    { key: "settings", label: "Réglages", icon: "settings" },
  ];
  const btnBase: React.CSSProperties = {
    appearance: "none",
    border: "1px solid transparent",
    background: "transparent",
    color: "#e7e7e7",
    padding: layout === "row" ? "8px 10px" : "8px 4px",
    borderRadius: 12,
    display: "flex",
    flexDirection: layout === "row" ? "row" : "column",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    transition: "transform 120ms ease, background 160ms ease, color 160ms ease, border 160ms ease",
    fontSize: 12,
    lineHeight: 1.1,
  };
  const activeBg = "radial-gradient(120px 60px at 50% -20%, rgba(245,158,11,.35), rgba(245,158,11,.08))";

  return (
    <>
      {items.map((it) => {
        const active = route === it.key;
        return (
          <button
            key={it.key}
            onClick={() => setRoute(it.key)}
            aria-current={active ? "page" : undefined}
            title={it.label}
            style={{
              ...btnBase,
              background: active ? activeBg : "transparent",
              color: active ? "var(--c-primary)" : "#e7e7e7",
              border: active ? "1px solid rgba(245,158,11,.35)" : "1px solid transparent",
              fontWeight: active ? 800 : 600,
            }}
          >
            <Icon name={it.icon} active={active} />
            <span style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", maxWidth: 120 }}>
              {it.label}
            </span>
          </button>
        );
      })}
    </>
  );
}

function Icon({ name, active }: { name: IconName; active?: boolean }) {
  const stroke = active ? "var(--c-primary)" : "#e7e7e7";
  const dim = 22;
  const common = {
    width: dim,
    height: dim,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10.5V21h14V10.5" />
          <path d="M9 21v-6h6v6" />
        </svg>
      );
    case "dart":
      return (
        <svg {...common}>
          <path d="M3 3l4 1 4 4-2 2-4-4-1-4z" />
          <path d="M11 8l9 9" />
          <path d="M14 14l-3 6 6-3" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <path d="M12 12a4.5 4.5 0 1 0-0.001-9.001A4.5 4.5 0 0 0 12 12z" />
          <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M3 7h6l2 2h10v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z" />
          <path d="M3 7V6a3 3 0 0 1 3-3h3l2 2" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <rect x="5" y="10" width="3" height="8" rx="1" />
          <rect x="10.5" y="6" width="3" height="12" rx="1" />
          <rect x="16" y="13" width="3" height="5" rx="1" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.02.02a2 2 0 1 1-2.83 2.83l-.02-.02A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-3 0 1.8 1.8 0 0 0-1.98.36l-.02.02a2 2 0 1 1-2.83-2.83l.02-.02A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0 0-3 1.8 1.8 0 0 0-.36-1.98l-.02-.02a2 2 0 1 1 2.83-2.83l.02.02A1.8 1.8 0 0 0 9 4.6a1.8 1.8 0 0 0 3 0 1.8 1.8 0 0 0 1.98-.36l.02-.02a2 2 0 1 1 2.83 2.83l-.02.02A1.8 1.8 0 0 0 19.4 12c0 .35.12.69.36 1z" />
        </svg>
      );
  }
}

/* =========================================
   SectionTabs (verre dépoli, réutilisable)
   ========================================= */
type TabItem = { key: string; label: string; icon?: IconName };
function SectionTabs({
  tabs,
  value,
  onChange,
  rightSlot,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (k: string) => void;
  rightSlot?: React.ReactNode;
}) {
  const bar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: 6,
    borderRadius: 14,
    background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
    border: "1px solid rgba(255,255,255,.07)",
    backdropFilter: "blur(6px)",
  };
  const btn: React.CSSProperties = {
    appearance: "none",
    border: "1px solid transparent",
    background: "transparent",
    color: "#e7e7e7",
    padding: "8px 10px",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    fontSize: 13,
    transition: "all 160ms ease",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={bar}>
        {tabs.map((t) => {
          const active = t.key === value;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              style={{
                ...btn,
                background: active
                  ? "radial-gradient(100px 50px at 50% -20%, rgba(245,158,11,.28), rgba(245,158,11,.07))"
                  : "transparent",
                color: active ? "var(--c-primary)" : "#e7e7e7",
                border: active ? "1px solid rgba(245,158,11,.35)" : "1px solid transparent",
                fontWeight: active ? 800 : 600,
              }}
            >
              {t.icon && <Icon name={t.icon} active={active} />}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
      {rightSlot}
    </div>
  );
}
/* ===================== Modal (verre dépoli) ===================== */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 92vw)",
          maxHeight: "80vh",
          overflow: "auto",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.08)",
          background:
            "linear-gradient(180deg, rgba(20,20,24,.65), rgba(10,10,12,.85))",
          padding: 16,
          color: "#eee",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              border: "1px solid rgba(255,255,255,.08)",
              background: "#0e0e11",
              color: "#eee",
              padding: "6px 10px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </div>
        <div style={{ marginTop: 10, lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}
function InfoButton({ mode }: { mode: string }) {
  const [open, setOpen] = React.useState(false);
  const key = MODE_TO_RULE_KEY[mode] || mode;
  const text = GAME_RULES[key];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Règles"
        style={{
          border: "1px solid rgba(255,255,255,.08)",
          background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
          color: "#e7e7e7",
          padding: "8px 10px",
          borderRadius: 12,
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        i
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Règles — ${mode}`}>
        {text ? (
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{text}</pre>
        ) : (
          <div>Règles à venir.</div>
        )}
      </Modal>
    </>
  );
}
