import React, { useMemo, useState } from "react";
import StatsPage from "./pages/StatsPage";
import Avatar from "./components/Avatar";
import NeonDartBoxes from "./components/NeonDartBoxes";
import {
  createMatch as x01CreateMatch,
  playVisit as x01PlayVisit,
  nextLeg as x01NextLeg,
  createLeg as x01CreateLeg,
  type Dart as X01Dart,
} from "./x01";

/* ---------------- Utils ---------------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/* ---------------- Types (UI) ---------------- */
type Profile = { id: string; name: string; avatarDataUrl?: string };
type Player = { id: string; name: string; profileId?: string; avatarDataUrl?: string; x01Score: number };

type MatchRules = {
  startingScore: number; // 301 / 501 / 701...
  doubleOut: boolean;
};

type Route = "home" | "profiles" | "game" | "stats" | "settings";

/* ---------------- Defaults ---------------- */
const DEFAULT_RULES: MatchRules = { startingScore: 501, doubleOut: true };

/* ---------------- LocalStorage hook ---------------- */
function useLocalStorage<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch {
      return init;
    }
  });
  React.useEffect(() => {
    localStorage.setItem(key, JSON.stringify(v));
  }, [key, v]);
  return [v, setV] as const;
}

/* ---------------- UI helpers ---------------- */
const Button = (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...p}
    style={{
      padding: "8px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,.1)",
      background: "rgba(255,255,255,.06)",
      color: "#fff",
      fontWeight: 700,
      cursor: "pointer",
      ...(p.style || {}),
    }}
  />
);

/* ---------------- App ---------------- */
export default function App() {
  const [route, setRoute] = useLocalStorage<Route>("dc.route", "home");

  const [profiles, setProfiles] = useLocalStorage<Profile[]>("dc.profiles", [
    { id: uid(), name: "Joueur 1" },
    { id: uid(), name: "Joueur 2" },
  ]);

  const [rules, setRules] = useLocalStorage<MatchRules>("dc.rules", DEFAULT_RULES);

  const [players, setPlayers] = useState<Player[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // X01 state minimal (recréé à la volée)
  const roster = useMemo(() => players.map((p) => ({ id: p.id, name: p.name })), [players]);
  const [leg, setLeg] = useState(() =>
    x01CreateLeg(rules.startingScore, roster, roster[0]?.id)
  );

  React.useEffect(() => {
    // Recréer la manche si le roster ou les règles changent
    setLeg(x01CreateLeg(rules.startingScore, roster, roster[0]?.id));
    setActiveId(roster[0]?.id ?? "");
    setPlayers((ps) =>
      ps.map((p) => ({ ...p, x01Score: rules.startingScore }))
    );
  }, [rules.startingScore, roster.map((r) => r.id).join(",")]);

  /* ---------- HOME ---------- */
  if (route === "home") {
    return (
      <section style={{ padding: 16, display: "grid", gap: 12 }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, textAlign: "center" }}>DARTS COUNTER</h1>
        <div style={{ display: "grid", gap: 10 }}>
          <Button onClick={() => setRoute("profiles")}>Profils</Button>
          <Button onClick={() => setRoute("game")}>Jouer (X01)</Button>
          <Button onClick={() => setRoute("stats")}>Stats</Button>
          <Button onClick={() => setRoute("settings")}>Réglages</Button>
        </div>
      </section>
    );
  }

  /* ---------- PROFILES ---------- */
  if (route === "profiles") {
    const [newName, setNewName] = React.useState("");
    function addProfile() {
      const n = newName.trim();
      if (!n) return;
      setProfiles([...profiles, { id: uid(), name: n }]);
      setNewName("");
    }
    function removeProfile(id: string) {
      setProfiles(profiles.filter((p) => p.id !== id));
    }
    return (
      <section style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button onClick={() => setRoute("home")}>← Retour</Button>
          <h2 style={{ fontWeight: 900 }}>Profils</h2>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom du profil"
            style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #333", background: "#0f0f10", color: "#eee" }}
          />
          <Button onClick={addProfile}>Ajouter</Button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {profiles.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, border: "1px solid rgba(255,255,255,.08)", borderRadius: 12 }}>
              <Avatar name={p.name} src={p.avatarDataUrl} size={40} />
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ marginLeft: "auto" }}>
                <Button onClick={() => removeProfile(p.id)}>Supprimer</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  /* ---------- GAME (X01) ---------- */
  if (route === "game") {
    // sélection joueurs depuis profils
    const [selectedIds, setSelectedIds] = React.useState<string[]>(players.map(p => p.id));

    function toggleProfile(id: string) {
      setSelectedIds((arr) => (arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]));
    }

    function startMatch() {
      const chosen = profiles.filter((p) => selectedIds.includes(p.id));
      if (chosen.length === 0) return alert("Sélectionne au moins 1 joueur.");
      const rosterPs: Player[] = chosen.map((p) => ({
        id: p.id,
        name: p.name,
        profileId: p.id,
        avatarDataUrl: p.avatarDataUrl,
        x01Score: rules.startingScore,
      }));
      setPlayers(rosterPs);
      setActiveId(rosterPs[0].id);
      setLeg(x01CreateLeg(rules.startingScore, rosterPs.map(p => ({ id: p.id, name: p.name })), rosterPs[0].id));
    }

    const active = players.find((p) => p.id === activeId);
    const [turnDarts, setTurnDarts] = useState<Array<X01Dart | null>>([null, null, null]);

    function setDart(slot: number, val: number, mult: 1 | 2 | 3) {
      setTurnDarts((ds) => {
        const next = [...ds] as Array<X01Dart | null>;
        next[slot] = { value: val, mult };
        return next;
      });
    }

    function submitVisit() {
      if (!active) return;
      const darts = turnDarts.filter(Boolean) as X01Dart[];
      const legCopy = { ...leg, players: { ...leg.players } };
      const { legEnded, winnerId } = x01PlayVisit(legCopy, darts, rules.doubleOut);
      setLeg(legCopy);

      // maj scores UI
      setPlayers((ps) =>
        ps.map((p) => (p.id === active.id ? { ...p, x01Score: legCopy.players[p.id].score } : p))
      );

      // joueur suivant
      const nextIdx = legCopy.activeIndex;
      setActiveId(legCopy.order[nextIdx]);

      // reset volée
      setTurnDarts([null, null, null]);

      if (legEnded && winnerId) {
        alert(`Manche terminée ! Gagnant : ${players.find(p => p.id === winnerId)?.name ?? "?"}`);
      }
    }

    const keypad = (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {[20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0,25].map((v) => (
          <Button key={v} onClick={() => {
            // place sur le premier slot vide
            const i = turnDarts.findIndex((x) => !x);
            if (i === -1) return;
            setDart(i, v, 1);
          }}>
            {v === 25 ? "BULL" : v}
          </Button>
        ))}
        <Button onClick={() => {
          const i = turnDarts.findIndex((x) => !x);
          const idx = i === -1 ? 2 : i;
          const cur = turnDarts[idx];
          if (!cur) return;
          setDart(idx, cur.value, 2);
        }}>Double</Button>
        <Button onClick={() => {
          const i = turnDarts.findIndex((x) => !x);
          const idx = i === -1 ? 2 : i;
          const cur = turnDarts[idx];
          if (!cur) return;
          setDart(idx, cur.value, 3);
        }}>Triple</Button>
        <Button onClick={() => setTurnDarts([null,null,null])}>Effacer</Button>
        <Button onClick={submitVisit}>Valider la volée</Button>
      </div>
    );

    return (
      <section style={{ padding: 16, display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button onClick={() => setRoute("home")}>← Accueil</Button>
          <h2 style={{ fontWeight: 900 }}>X01</h2>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <select
              value={rules.startingScore}
              onChange={(e) => setRules({ ...rules, startingScore: clamp(parseInt(e.target.value) || 501, 101, 1001) })}
              style={{ padding: 8, borderRadius: 10, background: "#0f0f10", color: "#eee", border: "1px solid #333" }}
            >
              {[301, 501, 701, 1001].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={rules.doubleOut} onChange={(e) => setRules({ ...rules, doubleOut: e.target.checked })} />
              Double-out
            </label>
          </div>
        </div>

        {/* Sélection des joueurs */}
        <details open={!players.length} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Joueurs</summary>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {profiles.map((p) => {
              const is = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProfile(p.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: 8,
                    borderRadius: 10, border: "1px solid rgba(255,255,255,.08)",
                    background: is ? "rgba(245,158,11,.18)" : "transparent",
                    color: is ? "#fbbf24" : "#e7e7e7",
                    fontWeight: is ? 800 : 600, cursor: "pointer",
                  }}
                >
                  <Avatar name={p.name} src={p.avatarDataUrl} size={36} />
                  <span>{p.name}</span>
                  <span style={{ marginLeft: "auto", opacity: .7 }}>{is ? "✓" : ""}</span>
                </button>
              );
            })}
            <div><Button onClick={startMatch}>Démarrer la partie</Button></div>
          </div>
        </details>

        {/* Zone de jeu */}
        {!!players.length && (
          <>
            <div style={{ display: "grid", gap: 8 }}>
              {players.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  style={{
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 10,
                    alignItems: "center",
                    padding: 8,
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 12,
                    background: p.id === activeId ? "rgba(245,158,11,.12)" : "transparent",
                  }}
                >
                  <Avatar name={p.name} src={p.avatarDataUrl} size={44} />
                  <div style={{ fontWeight: 800 }}>{p.name}</div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: "#fbbf24" }}>{p.x01Score}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <NeonDartBoxes darts={turnDarts as Array<X01Dart | null>} />
              {keypad}
            </div>
          </>
        )}
      </section>
    );
  }

  /* ---------- STATS ---------- */
  if (route === "stats") {
    return (
      <section style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button onClick={() => setRoute("home")}>← Retour</Button>
          <h2 style={{ fontWeight: 900 }}>Statistiques</h2>
        </div>
        <StatsPage />
      </section>
    );
  }

  /* ---------- SETTINGS ---------- */
  if (route === "settings") {
    return (
      <section style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button onClick={() => setRoute("home")}>← Retour</Button>
          <h2 style={{ fontWeight: 900 }}>Réglages</h2>
        </div>
        <div>À venir…</div>
      </section>
    );
  }

  return null;
}
