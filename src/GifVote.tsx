/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

// -----------------------------
// Types
// -----------------------------

type VoteType = "like" | "funny";
type Side = "left" | "right";

type GifItem = {
  id: string;
  title: string;
  // We keep a "displayUrl" that points to an image/gif URL to render in <img />
  displayUrl: string;
};

type VoteRecord = {
  round: number;
  theme: string;
  voteType: VoteType;
  winnerSide: Side;
  leftId: string;
  rightId: string;
  ts: number;
};

type Score = {
  like: { left: number; right: number };
  funny: { left: number; right: number };
};

type GameState = {
  theme: string;
  round: number;
  leftGif: GifItem | null;
  rightGif: GifItem | null;
  poolCount: number; // how many GIFs we currently have in the cached pool for this theme
  score: Score;
  history: VoteRecord[];
  isLoading: boolean;
  error: string | null;
};

type Action =
  | { type: "SET_THEME"; theme: string }
  | { type: "LOAD_PAIR_START" }
  | {
      type: "LOAD_PAIR_SUCCESS";
      leftGif: GifItem;
      rightGif: GifItem;
      poolCount: number;
    }
  | { type: "LOAD_PAIR_ERROR"; error: string }
  | { type: "VOTE"; voteType: VoteType; winnerSide: Side }
  | { type: "UNDO_LAST_VOTE" }
  | { type: "RESET_RUN" };

// -----------------------------
// Initial State
// ---------------------------

const initialState: GameState = {
  theme: "cats",
  round: 1,
  leftGif: null,
  rightGif: null,
  poolCount: 0,
  score: {
    like: { left: 0, right: 0 },
    funny: { left: 0, right: 0 },
  },
  history: [],
  isLoading: false,
  error: null,
};

// -----------------------------
// Reducer (pure, predictable transitions)
// -----------------------------

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SET_THEME": {
      // Reset “run” state when theme changes (new scoreboard, new rounds)
      return {
        ...state,
        theme: action.theme,
        round: 1,
        leftGif: null,
        rightGif: null,
        poolCount: 0,
        score: {
          like: { left: 0, right: 0 },
          funny: { left: 0, right: 0 },
        },
        history: [],
        error: null,
      };
    }

    case "LOAD_PAIR_START":
      return { ...state, isLoading: true, error: null };

    case "LOAD_PAIR_SUCCESS":
      return {
        ...state,
        isLoading: false,
        error: null,
        leftGif: action.leftGif,
        rightGif: action.rightGif,
        poolCount: action.poolCount,
      };

    case "LOAD_PAIR_ERROR":
      return { ...state, isLoading: false, error: action.error };

    case "VOTE": {
      // Guard: if pair not loaded, do nothing (shouldn't happen with disabled buttons)
      if (!state.leftGif || !state.rightGif) return state;

      // Update score based on vote type and winner side
      const nextScore: Score = {
        like: { ...state.score.like },
        funny: { ...state.score.funny },
      };

      if (action.voteType === "like") {
        nextScore.like[action.winnerSide] += 1;
      } else {
        nextScore.funny[action.winnerSide] += 1;
      }

      const record: VoteRecord = {
        round: state.round,
        theme: state.theme,
        voteType: action.voteType,
        winnerSide: action.winnerSide,
        leftId: state.leftGif.id,
        rightId: state.rightGif.id,
        ts: Date.now(),
      };

      return {
        ...state,
        score: nextScore,
        history: [record, ...state.history], // newest first
        round: state.round + 1,
      };
    }

    case "UNDO_LAST_VOTE": {
      // Undo the most recent vote (nice for practice + real UX)
      const [last, ...rest] = state.history;
      if (!last) return state;

      const nextScore: Score = {
        like: { ...state.score.like },
        funny: { ...state.score.funny },
      };

      // Reverse the exact score increment we applied
      if (last.voteType === "like") {
        nextScore.like[last.winnerSide] = Math.max(
          0,
          nextScore.like[last.winnerSide] - 1,
        );
      } else {
        nextScore.funny[last.winnerSide] = Math.max(
          0,
          nextScore.funny[last.winnerSide] - 1,
        );
      }

      return {
        ...state,
        score: nextScore,
        history: rest,
        round: Math.max(1, state.round - 1),
      };
    }

    case "RESET_RUN":
      return {
        ...state,
        round: 1,
        leftGif: null,
        rightGif: null,
        poolCount: 0,
        score: {
          like: { left: 0, right: 0 },
          funny: { left: 0, right: 0 },
        },
        history: [],
        error: null,
      };

    default:
      return state;
  }
}

// -----------------------------
// GIPHY API helpers
// -----------------------------

function getGiphyApiKey(): string {
  // Supports both Vite and CRA conventions
  const vite = (import.meta as any)?.env?.VITE_GIPHY_API_KEY;
  const cra = (import.meta.env as any)?.env?.REACT_APP_GIPHY_API_KEY;
  return vite || cra || "";
}

function normalizeGif(raw: any): GifItem {
  // GIPHY returns many image variants. We pick something that works for <img />.
  // "fixed_width" is a good balance for UI.
  const displayUrl =
    raw?.images?.fixed_width?.url ||
    raw?.images?.downsized?.url ||
    raw?.images?.original?.url ||
    "";

  return {
    id: String(raw?.id ?? crypto.randomUUID()),
    title: String(raw?.title ?? "Untitled"),
    displayUrl,
  };
}

function randomInt(min: number, max: number): number {
  // inclusive min, exclusive max
  return Math.floor(Math.random() * (max - min)) + min;
}

function pickTwoDistinct<T>(arr: T[]): [T, T] | null {
  if (arr.length < 2) return null;
  const i = randomInt(0, arr.length);
  let j = randomInt(0, arr.length);
  while (j === i) j = randomInt(0, arr.length);
  return [arr[i], arr[j]];
}

// -----------------------------
// Context (share state + actions without prop drilling)
// -----------------------------

type GifDuelContextValue = {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  // Helpers: keep components clean
  setTheme: (theme: string) => void;
  loadNextPair: () => Promise<void>;
  vote: (voteType: VoteType, winnerSide: Side) => void;
  undo: () => void;
};

const GifDuelContext = createContext<GifDuelContextValue | null>(null);

function useGifDuel(): GifDuelContextValue {
  const ctx = useContext(GifDuelContext);
  if (!ctx) throw new Error("useGifDuel must be used within GifDuelProvider");
  return ctx;
}

function GifDuelProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // UI-only state belongs in useState (NOT reducer)
  const [rating, setRating] = useState<"g" | "pg" | "pg-13">("pg"); // GIPHY rating
  const [limit] = useState<number>(25); // how many GIFs to fetch per theme

  // Cache pools by theme so we don’t hammer the API every round.
  // Map<themeKey, { gifs: GifItem[] }>
  const poolCacheRef = React.useRef<Map<string, GifItem[]>>(new Map());

  const apiKey = useMemo(() => getGiphyApiKey(), []);

  async function fetchPool(theme: string): Promise<GifItem[]> {
    if (!apiKey) {
      throw new Error(
        "Missing GIPHY API key. Set VITE_GIPHY_API_KEY or REACT_APP_GIPHY_API_KEY.",
      );
    }

    const params = new URLSearchParams({
      api_key: apiKey,
      q: theme,
      limit: String(limit),
      rating,
      lang: "en",
    });

    const url = `https://api.giphy.com/v1/gifs/search?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`GIPHY error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const data = Array.isArray(json?.data) ? json.data : [];

    // Normalize into our GifItem type
    const normalized = data
      .map(normalizeGif)
      .filter((g: GifItem) => g.displayUrl);

    if (normalized.length < 2) {
      throw new Error(
        "Not enough GIF results for that theme. Try another theme.",
      );
    }

    return normalized;
  }

  async function ensurePool(theme: string): Promise<GifItem[]> {
    // Key includes rating so “cats + pg” differs from “cats + g”
    const key = `${theme.trim().toLowerCase()}|${rating}`;

    // If cached and large enough, reuse
    const cached = poolCacheRef.current.get(key);
    if (cached && cached.length >= 2) return cached;

    // Otherwise fetch and cache
    const fresh = await fetchPool(theme);
    poolCacheRef.current.set(key, fresh);
    return fresh;
  }

  async function loadNextPair() {
    dispatch({ type: "LOAD_PAIR_START" });

    try {
      const theme = state.theme.trim();
      if (!theme) throw new Error("Theme is empty. Type something.");

      const pool = await ensurePool(theme);

      // Pick two distinct GIFs from the pool
      const pair = pickTwoDistinct(pool);
      if (!pair)
        throw new Error("Not enough GIFs in the pool. Try another theme.");

      const [leftGif, rightGif] = pair;

      dispatch({
        type: "LOAD_PAIR_SUCCESS",
        leftGif,
        rightGif,
        poolCount: pool.length,
      });
    } catch (err: any) {
      dispatch({
        type: "LOAD_PAIR_ERROR",
        error: err?.message ?? "Unknown error",
      });
    }
  }

  function setTheme(theme: string) {
    // This resets the run in reducer and then we’ll load a new pair via effect below.
    dispatch({ type: "SET_THEME", theme: theme.trim() || "cats" });
  }

  function vote(voteType: VoteType, winnerSide: Side) {
    dispatch({ type: "VOTE", voteType, winnerSide });

    // Immediately load the next pair after voting.
    // (This is a “side effect”, so it should NOT live in the reducer.)
    void loadNextPair();
  }

  function undo() {
    dispatch({ type: "UNDO_LAST_VOTE" });
  }

  // On first mount, load initial pair.
  useEffect(() => {
    void loadNextPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When theme changes, load a new pair automatically.
  // (Reducer resets left/right to null; this fills them.)
  useEffect(() => {
    void loadNextPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.theme, rating]);

  const value: GifDuelContextValue = {
    state,
    dispatch,
    setTheme,
    loadNextPair,
    vote,
    undo,
  };

  return (
    <GifDuelContext.Provider value={value}>
      {/* Small settings panel shows where useState can live in provider too */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <header style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <h1 style={{ margin: 0 }}>GIF Duel</h1>
          <span style={{ opacity: 0.75 }}>
            Theme: <b>{state.theme}</b> · Round: <b>{state.round}</b> · Pool:{" "}
            <b>{state.poolCount}</b>
          </span>
        </header>

        <div
          style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}
        >
          <ThemePicker />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ opacity: 0.85 }}>Rating</label>
            {/* rating is UI-only, so useState is fine */}
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value as any)}
              style={{ padding: 8 }}
              title="GIPHY rating filter"
            >
              <option value="g">G</option>
              <option value="pg">PG</option>
              <option value="pg-13">PG-13</option>
            </select>
          </div>

          <button
            onClick={() => void loadNextPair()}
            style={{ padding: "8px 12px", cursor: "pointer" }}
          >
            🔄 New Pair
          </button>

          <button
            onClick={undo}
            disabled={state.history.length === 0}
            style={{ padding: "8px 12px", cursor: "pointer" }}
          >
            ↩️ Undo
          </button>
        </div>

        {children}
      </div>
    </GifDuelContext.Provider>
  );
}

// -----------------------------
// UI Components
// -----------------------------

function ThemePicker() {
  const { state, setTheme } = useGifDuel();

  // useState is perfect for “draft input” before applying it to reducer state
  const [draft, setDraft] = useState(state.theme);
  const [isOpen, setIsOpen] = useState(false);

  const suggestions = useMemo(
    () => [
      "cats",
      "anime",
      "football",
      "coding",
      "memes",
      "dance",
      "fails",
      "victory",
    ],
    [],
  );

  useEffect(() => {
    // Keep draft in sync if theme changes elsewhere (e.g. reset)
    setDraft(state.theme);
  }, [state.theme]);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a theme…"
          style={{ padding: 8, width: 220 }}
          onFocus={() => setIsOpen(true)}
        />
        <button
          onClick={() => setTheme(draft)}
          style={{ padding: "8px 12px", cursor: "pointer" }}
          title="Apply theme"
        >
          🎯 Apply
        </button>
        <button
          onClick={() => setIsOpen((v) => !v)}
          style={{ padding: "8px 12px", cursor: "pointer" }}
          title="Toggle suggestions"
        >
          ⬇️
        </button>
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 0,
            width: 320,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 8,
            zIndex: 5,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            Quick picks (so you don’t type “cat” 900 times):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setDraft(s);
                  setTheme(s);
                  setIsOpen(false);
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  background: "#f7f7f7",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={() => setIsOpen(false)}
              style={{ padding: "6px 10px", cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GifArena() {
  const { state, vote } = useGifDuel();

  if (state.isLoading) {
    return (
      <div
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        Loading GIFs… (summoning the meme spirits—jk, just HTTP)
      </div>
    );
  }

  if (state.error) {
    return (
      <div
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid #f2b8b8",
          borderRadius: 12,
          background: "#fff5f5",
        }}
      >
        <b>Oops:</b> {state.error}
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Try a different theme or check your API key.
        </div>
      </div>
    );
  }

  const left = state.leftGif;
  const right = state.rightGif;

  if (!left || !right) {
    return (
      <div
        style={{
          marginTop: 18,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        No GIF pair yet.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <GifCard
          side="left"
          gif={left}
          onLike={() => vote("like", "left")}
          onFunny={() => vote("funny", "left")}
        />
        <GifCard
          side="right"
          gif={right}
          onLike={() => vote("like", "right")}
          onFunny={() => vote("funny", "right")}
        />
      </div>
    </div>
  );
}

function GifCard({
  side,
  gif,
  onLike,
  onFunny,
}: {
  side: Side;
  gif: GifItem;
  onLike: () => void;
  onFunny: () => void;
}) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>{side.toUpperCase()}</div>
        <div
          style={{
            fontSize: 12,
            opacity: 0.7,
            maxWidth: 280,
            textAlign: "right",
          }}
        >
          {gif.title || "Untitled"}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #eee",
          background: "#fafafa",
          height: 320,
          display: "grid",
          placeItems: "center",
        }}
      >
        {/* Render the GIF */}
        <img
          src={gif.displayUrl}
          alt={gif.title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
      </div>

      {/* Voting buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button
          onClick={onLike}
          style={{
            flex: 1,
            padding: "10px 12px",
            cursor: "pointer",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#f7f7ff",
          }}
          title="Vote: best overall"
        >
          👍 Like
        </button>
        <button
          onClick={onFunny}
          style={{
            flex: 1,
            padding: "10px 12px",
            cursor: "pointer",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff7f2",
          }}
          title="Vote: funniest"
        >
          😂 Funny
        </button>
      </div>
    </div>
  );
}

function Scoreboard() {
  const { state } = useGifDuel();
  const { like, funny } = state.score;

  return (
    <div
      style={{
        marginTop: 18,
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 800 }}>Scoreboard</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <ScoreBlock title="👍 Like" left={like.left} right={like.right} />
        <ScoreBlock title="😂 Funny" left={funny.left} right={funny.right} />
      </div>
    </div>
  );
}

function ScoreBlock({
  title,
  left,
  right,
}: {
  title: string;
  left: number;
  right: number;
}) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>
          LEFT: <b>{left}</b>
        </span>
        <span>
          RIGHT: <b>{right}</b>
        </span>
      </div>
    </div>
  );
}

function HistoryPanel() {
  const { state, dispatch } = useGifDuel();
  const top = state.history.slice(0, 8);

  return (
    <div
      style={{
        marginTop: 18,
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div style={{ fontWeight: 800 }}>Recent Votes</div>
        <button
          onClick={() => dispatch({ type: "RESET_RUN" })}
          style={{ padding: "6px 10px", cursor: "pointer" }}
          title="Reset scoreboard for current theme"
        >
          🧼 Reset
        </button>
      </div>

      {top.length === 0 ? (
        <div style={{ opacity: 0.7, marginTop: 8 }}>
          No votes yet. Choose violence: click a button.
        </div>
      ) : (
        <ul style={{ marginTop: 10, paddingLeft: 18 }}>
          {top.map((v) => (
            <li key={`${v.ts}-${v.round}`} style={{ marginBottom: 6 }}>
              Round <b>{v.round}</b>:{" "}
              <b>{v.voteType === "like" ? "👍 Like" : "😂 Funny"}</b> winner was{" "}
              <b>{v.winnerSide.toUpperCase()}</b>
              <span style={{ opacity: 0.7 }}>
                {" "}
                · theme: <b>{v.theme}</b>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { HistoryPanel, Scoreboard, GifArena, GifDuelProvider };
