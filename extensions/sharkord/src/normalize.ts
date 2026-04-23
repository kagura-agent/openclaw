/**
 * Sharkord target normalization.
 *
 * Target formats:
 * - Group: "sharkord:channelId"
 * - DM:    "sharkord:dm:userId"
 * - Full:  "sharkord:<accountId>:channel:<channelId>"
 * - Full:  "sharkord:<accountId>:dm:<userId>"
 */

/**
 * Normalize a raw messaging target to canonical form.
 * Returns undefined for empty or unparseable input.
 */
export function normalizeSharkordMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  let target = trimmed;

  // Strip "sharkord:" prefix and optional account segment
  if (target.startsWith("sharkord:")) {
    target = target.slice("sharkord:".length);
    // Strip account segment if followed by channel: or dm:
    const nextColon = target.indexOf(":");
    if (nextColon > 0) {
      const after = target.slice(nextColon + 1);
      if (after.startsWith("channel:") || after.startsWith("dm:")) {
        target = after;
      }
    }
  }

  // Handle "channel:<channelId>"
  if (target.startsWith("channel:")) {
    const channelId = target.slice("channel:".length).trim();
    return channelId || undefined;
  }

  // Handle "dm:<userId>"
  if (target.startsWith("dm:")) {
    const userId = target.slice("dm:".length).trim();
    return userId ? `dm:${userId}` : undefined;
  }

  // Short form — return as-is
  return target || undefined;
}

/**
 * Determine if a normalized target is a DM.
 */
export function isDmTarget(target: string): boolean {
  return target.startsWith("dm:");
}

/**
 * Extract the channel or user ID from a normalized target.
 */
export function extractTargetId(target: string): string {
  if (target.startsWith("dm:")) {
    return target.slice("dm:".length);
  }
  return target;
}
