// Read-only questions never become form mutations just because they mention
// rotation, "use", or an existing crop. Model output cannot override this boundary.
export function isEvidenceQuestion(question) {
  const text = String(question ?? '').normalize('NFKC').trim();
  if (/^(?:please )?help me (?:understand|learn|know|interpret|explain)\b/i.test(text)) return true;
  if (/\b(?:help me|guide me|walk me through|take me through)\s+(?:plan|pick|select|choose|find|compare|set|use)\b/i.test(text)) return false;
  if (/^(?:please\s+)?(?:use|select|choose|pick|set|find|plan|compare|rotate|continue|next|proceed)\b/i.test(text)) return false;
  // The keyword must be a word on its own: “Is-Swieqi” and “Canóvanas” are Maltese and Puerto
  // Rican place names, not the questions “Is …?” / “Can …?”.
  return /(?:^|[.!]\s+)(?:tell me about|what|why|how|when|where|can|could|should|would|will|is|are|does|do|give me|ignore your sources)(?=\s|$)/i.test(text) ||
    /^(?:show me )?(?:rainfall|temperature|weather|soil evidence|source evidence)\b/i.test(text) ||
    /\?/.test(text);
}
