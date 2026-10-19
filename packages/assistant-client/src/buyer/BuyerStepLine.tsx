import { useEffect, useRef, useState } from 'react';
import type { BuyerMessage } from './messages';

// Pause after the "searching…" line before the lines that report what was found.
const SEARCHING_PAUSE_MS = 1000;
// Delay between two step lines that arrive together, so they appear one after another.
const STEP_STAGGER_MS = 400;
// Time the sweep takes on one step line; matches buyer-step-shimmer in index.css.
const STEP_SHIMMER_MS = 1600;

// When the step at this position appears: the opener first, the rest a second later, one after another.
function stepDelay(position: number): number {
  return position === 0 ? 0 : SEARCHING_PAUSE_MS + (position - 1) * STEP_STAGGER_MS;
}

// True for the search progress lines: the "searching…" opener and the "found…" steps after it.
export function isBuyerStepMessage(message: BuyerMessage): boolean {
  if (message.speaker === 'results-found') return true;
  return message.speaker === 'system' && /^(?:מחפש(?:ים פריטים)?|Searching(?: for lots)?)…$/.test(message.text);
}

// Picks the icon that fits what the step says.
function stepIcon(text: string): string {
  if (/^(?:מחפש|Searching)/.test(text)) return '🔍';
  if (/ארכיון|archive/i.test(text)) return '🗂️';
  if (/^(?:שימו לב|Note)/.test(text)) return 'ℹ️';
  return '📚';
}

// How long after arriving each message waits before it shows: steps one after another, then what follows them.
export function buyerRevealDelays(messages: BuyerMessage[]): Map<string, number> {
  const delays = new Map<string, number>();
  let run = 0;
  let waiting = 0;
  for (const message of messages) {
    if (isBuyerStepMessage(message)) {
      delays.set(message.id, stepDelay(run++));
      continue;
    }
    if (run > 0) waiting = stepDelay(run - 1) + STEP_SHIMMER_MS;
    run = 0;
    if (message.speaker === 'buyer') waiting = 0;
    if (waiting > 0) delays.set(message.id, waiting);
  }
  return delays;
}

// Shows each new message only when its turn comes, so the chat scrolls to it as it appears.
// Messages already there on the first load show at once.
export function useBuyerReveal(messages: BuyerMessage[]): BuyerMessage[] {
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const seen = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const firstLoad = seen.current.size === 0;
    const delays = buyerRevealDelays(messages);
    const now: string[] = [];
    for (const message of messages) {
      if (seen.current.has(message.id)) continue;
      seen.current.add(message.id);
      const delay = firstLoad ? 0 : delays.get(message.id) ?? 0;
      if (delay === 0) now.push(message.id);
      else timers.current.push(setTimeout(() => setRevealed((ids) => new Set(ids).add(message.id)), delay));
    }
    if (now.length > 0) setRevealed((ids) => new Set([...ids, ...now]));
  }, [messages]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return messages.filter((message) => revealed.has(message.id));
}

// One search progress line: small grey text with an icon that slides in and shimmers once.
export function BuyerStepLine({ speaker, text }: { speaker: string; text: string }) {
  return (
    <li data-speaker={speaker} data-step="true" className="buyer-step flex items-center gap-2 self-start text-sm text-stone-400">
      <span aria-hidden="true">{stepIcon(text)}</span>
      <span className="buyer-step-text">{text}</span>
    </li>
  );
}
