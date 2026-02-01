import { GifDuelProvider } from "./GifVote";
import { GifArena } from "./GifVote";
import { Scoreboard } from "./GifVote";
import { HistoryPanel } from "./GifVote";

export default function App() {
  return (
    <GifDuelProvider>
      <GifArena />
      <Scoreboard />
      <HistoryPanel />
    </GifDuelProvider>
  );
}