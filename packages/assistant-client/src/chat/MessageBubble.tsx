import type { ReactNode } from 'react';

interface MessageBubbleProps {
  speaker: string;
  // true כשההודעה נשלחה על ידי המשתמש עצמו (קונה / מוכר); false לכל דובר אחר.
  isOwn: boolean;
  children: ReactNode;
}

// מחזירה את מחלקות העיצוב לפי סוג הדובר: בועה שחורה למשתמש עצמו, טקסט על הרקע למערכת, בלוק אדום לשגיאה.
function bubbleClass(speaker: string, isOwn: boolean) {
  const base = 'max-w-lg whitespace-pre-wrap text-sm';
  if (isOwn) {
    return `${base} self-end rounded-2xl bg-neutral-900 px-4 py-2 text-white`;
  }
  if (speaker === 'error') {
    return `${base} self-start rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-red-900`;
  }
  return `${base} self-start text-neutral-600`;
}

// Text bubble shared by every conversation role (buyer, seller, ...): one list item styled by who spoke.
export function MessageBubble({ speaker, isOwn, children }: MessageBubbleProps) {
  return (
    <li data-speaker={speaker} className={bubbleClass(speaker, isOwn)}>
      {children}
    </li>
  );
}
