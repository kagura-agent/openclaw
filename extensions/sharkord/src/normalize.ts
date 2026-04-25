/**
 * Normalize a Sharkord messaging target for outbound delivery.
 * Accepts formats like:
 *   - "channel:123" → "sharkord:default:channel:123"
 *   - "sharkord:default:channel:123" → passthrough
 */
export function normalizeSharkordMessagingTarget(raw: string, accountId?: string): string {
  const acct = accountId ?? "default";

  // Already fully qualified
  if (raw.startsWith("sharkord:")) {
    return raw;
  }

  // channel:123
  if (raw.startsWith("channel:")) {
    return `sharkord:${acct}:${raw}`;
  }

  // dm:userId
  if (raw.startsWith("dm:")) {
    return `sharkord:${acct}:${raw}`;
  }

  // Bare number = channel ID
  if (/^\d+$/.test(raw)) {
    return `sharkord:${acct}:channel:${raw}`;
  }

  return `sharkord:${acct}:channel:${raw}`;
}
