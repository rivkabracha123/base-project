import { useEffect, useRef, useState } from 'react';

// Pause after the first step line ("searching…") before the next one shows.
const FIRST_STEP_PAUSE_MS = 1000;
// Gap between later step lines that arrive together, so they appear one after another.
const STEP_STAGGER_MS = 400;
// Time the sweep takes on one step line; matches buyer-step-shimmer in index.css.
const STEP_SHIMMER_MS = 1600;

// Speakers whose messages are typed by the user; a new user message ends the wait behind earlier steps.
const OWN_SPEAKERS = new Set(['buyer', 'seller']);

// Icons by what the step says, checked in order.
const STEP_ICONS: Array<[RegExp, string]> = [
  [/^(?:מחפש|Searching)/, '🔍'],
  [/^(?:בודק את התמונות|Checking the photos)/, '🖼️'],
  [/^(?:משווה|Comparing)/, '📊'],
  [/^(?:שימו לב|Note)/, 'ℹ️'],
  [/בתי מכירות|auction houses/i, '🏛️'],
  [/להשוואה|to compare/i, '📈'],
  [/ארכיון|קודמות|קודמים|archive|past sales|previous/i, '🗂️'],
];

type ChatMessageLike = { id: string; speaker: string };

// The "while waiting" lines the buyer and seller flows send, in both languages.
const WAITING_STEP_TEXTS = new Set([
  'מחפש…', 'Searching…', 'מחפשים פריטים…', 'Searching for lots…',
  'מחפש בתי מכירות…', 'Searching auction houses…',
  'מחפש מופעים קודמים של הפריט…', 'Searching previous appearances of the item…',
  'משווה לעסקאות קודמות…', 'Comparing with past deals…',
  'בודק את התמונות…', 'Checking the photos…',
]);

// True for a progress line: one of the "while waiting" lines, or a "found N…" line after it.
export function isStepText(text: string): boolean {
  return WAITING_STEP_TEXTS.has(text) || /^(?:נמצאו|Found) \d+ [^\n]*$/.test(text);
}

// True for a message shown as a step line: a plain system line with step text, or the buyer's "results-found" lines.
export function isStepMessage(message: ChatMessageLike): boolean {
  const fields = message as ChatMessageLike & Record<string, unknown>;
  if (typeof fields.text !== 'string') return false;
  if (message.speaker === 'results-found') return true;
  return message.speaker === 'system' && !fields.action && !fields.houseRanking && !fields.comparison && isStepText(fields.text);
}

// Picks the icon that fits what the step says.
function stepIcon(text: string): string {
  return STEP_ICONS.find(([pattern]) => pattern.test(text))?.[1] ?? '📚';
}

// Shows each new message only when its turn comes, so the chat scrolls to it as it appears:
// step lines one after another, then whatever follows them once the last step finished.
// Works both when the steps arrive together and when they arrive one by one while the app waits.
// Messages already there on the first load show at once. `delayed` holds the non-step messages that were held back.
export function useStepReveal<T extends ChatMessageLike>(messages: T[]): { visible: T[]; delayed: Set<string> } {
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const seen = useRef(new Set<string>());
  const delayed = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // When the latest step line shows, and whether messages after it are still waiting behind it.
  const lastStepAt = useRef(0);
  const holding = useRef(false);

  useEffect(() => {
    const firstLoad = seen.current.size === 0;
    const now = Date.now();
    const showNow: string[] = [];
    messages.forEach((message, index) => {
      if (seen.current.has(message.id)) return;
      seen.current.add(message.id);
      if (firstLoad) {
        showNow.push(message.id);
        return;
      }
      let at = now;
      if (isStepMessage(message)) {
        let position = 0;
        while (index - position - 1 >= 0 && isStepMessage(messages[index - position - 1]!)) position++;
        if (position > 0) at = Math.max(now, lastStepAt.current + (position === 1 ? FIRST_STEP_PAUSE_MS : STEP_STAGGER_MS));
        lastStepAt.current = at;
        holding.current = true;
      } else if (OWN_SPEAKERS.has(message.speaker)) {
        holding.current = false;
      } else if (holding.current) {
        at = Math.max(now, lastStepAt.current + STEP_SHIMMER_MS);
        if (at > now) delayed.current.add(message.id);
      }
      if (at <= now) showNow.push(message.id);
      else timers.current.push(setTimeout(() => setRevealed((ids) => new Set(ids).add(message.id)), at - now));
    });
    if (showNow.length > 0) setRevealed((ids) => new Set([...ids, ...showNow]));
  }, [messages]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return { visible: messages.filter((message) => revealed.has(message.id)), delayed: delayed.current };
}

// One progress line: small grey text with an icon that slides in and shimmers once.
export function StepLine({ speaker, text }: { speaker: string; text: string }) {
  return (
    <li data-speaker={speaker} data-step="true" className="buyer-step flex items-center gap-2 self-start text-sm text-stone-400">
      <span aria-hidden="true">{stepIcon(text)}</span>
      <span className="buyer-step-text">{text}</span>
    </li>
  );
}
