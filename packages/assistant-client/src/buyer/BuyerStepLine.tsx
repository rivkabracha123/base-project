import type { BuyerMessage } from './messages';

// Pause after the "searching…" line before the lines that report what was found.
const SEARCHING_PAUSE_MS = 1000;
// Delay between two step lines that arrive together, so they appear one after another.
const STEP_STAGGER_MS = 400;

// When the step at this position starts appearing: the opener first, the rest a second later, one after another.
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
  if (/^(?:מחפשים|Searching)/.test(text)) return '🔍';
  if (/ארכיון|archive/i.test(text)) return '🗂️';
  if (/^(?:שימו לב|Note)/.test(text)) return 'ℹ️';
  return '📚';
}

// Time the sweep takes on one step line; matches buyer-step-shimmer in index.css.
const STEP_SHIMMER_MS = 1600;

// Position of each step line inside its run of consecutive step lines, keyed by message id.
export function buyerStepPositions(messages: BuyerMessage[]): Map<string, number> {
  const positions = new Map<string, number>();
  let run = 0;
  for (const message of messages) {
    if (isBuyerStepMessage(message)) positions.set(message.id, run++);
    else run = 0;
  }
  return positions;
}

// Delay for the messages that come right after a run of steps (cards, no-results), so they appear once the last step finished.
export function buyerRevealDelays(messages: BuyerMessage[]): Map<string, number> {
  const delays = new Map<string, number>();
  let run = 0;
  let waiting = 0;
  for (const message of messages) {
    if (isBuyerStepMessage(message)) {
      run++;
      continue;
    }
    if (run > 0) waiting = stepDelay(run - 1) + STEP_SHIMMER_MS;
    run = 0;
    if (message.speaker === 'buyer') waiting = 0;
    if (waiting > 0) delays.set(message.id, waiting);
  }
  return delays;
}

// One search progress line: small grey text with an icon that slides in and shimmers once.
export function BuyerStepLine({ speaker, text, position }: { speaker: string; text: string; position: number }) {
  return (
    <li
      data-speaker={speaker}
      data-step="true"
      className="buyer-step flex items-center gap-2 self-start text-sm text-stone-400"
      style={{ animationDelay: `${stepDelay(position)}ms` }}
    >
      <span aria-hidden="true">{stepIcon(text)}</span>
      <span className="buyer-step-text" style={{ animationDelay: `${stepDelay(position)}ms` }}>
        {text}
      </span>
    </li>
  );
}
