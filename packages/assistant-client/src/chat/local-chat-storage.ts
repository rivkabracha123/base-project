const sensitiveStorageKeyPattern =
  /password|passwd|pwd|passcode|secret|token|authorization|credential|api.?key|profile.?id|file.?id|item.?id|(?:preview|download).?uri/i;

const sensitiveTextPatterns = [
  /\b(password|passwd|pwd|passcode|api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|client[\s_-]?secret|secret)\b\s*(?::|=)\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /\b(password|passwd|pwd|passcode|secret)\b\s+is\s+(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /(סיסמה|סיסמא|קוד גישה)\s*(?::|=)\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /(סיסמה|סיסמא|קוד גישה)(?:\s+שלי)?\s+(?:היא|הוא)\s+(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /\bBearer\s+\S+/gi,
];

function sanitizeSensitiveText(text: string): string {
  return sensitiveTextPatterns.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, (match) => {
      const separatorIndex = match.search(/[:=]|\s+(?:is|היא|הוא)\s+/i);
      return separatorIndex === -1
        ? '[REDACTED]'
        : `${match.slice(0, separatorIndex)}: [REDACTED]`;
    }),
    text,
  );
}

export function sanitizeChatForLocalStorage(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeSensitiveText(value);
  if (Array.isArray(value)) return value.map(sanitizeChatForLocalStorage);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) =>
        sensitiveStorageKeyPattern.test(key) ? [] : [[key, sanitizeChatForLocalStorage(entry)]],
      ),
    );
  }
  return value;
}

export function sanitizeExistingLocalChatStorage(): void {
  const storageKeys = [
    'monabid.chat.buyer.en',
    'monabid.chat.buyer.he',
    'monabid.chat.seller.en',
    'monabid.chat.seller.he',
  ];

  for (const key of storageKeys) {
    const stored = localStorage.getItem(key);
    if (stored === null) continue;
    try {
      const sanitized = sanitizeChatForLocalStorage(JSON.parse(stored));
      localStorage.setItem(key, JSON.stringify(sanitized));
    } catch (error) {
      console.error(`Failed to sanitize existing chat data (${key})`, error);
    }
  }
}
