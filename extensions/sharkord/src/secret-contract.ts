import {
  collectSimpleChannelFieldAssignments,
  getChannelSurface,
  type ResolverContext,
  type SecretDefaults,
  type SecretTargetRegistryEntry,
} from "openclaw/plugin-sdk/channel-secret-basic-runtime";

export const secretTargetRegistryEntries = [
  {
    id: "channels.sharkord.bridgeSecret",
    targetType: "channels.sharkord.bridgeSecret",
    configFile: "openclaw.json",
    pathPattern: "channels.sharkord.bridgeSecret",
    secretShape: "secret_input",
    expectedResolvedValue: "string",
    includeInPlan: true,
    includeInConfigure: true,
    includeInAudit: true,
  },
] satisfies SecretTargetRegistryEntry[];

export function collectRuntimeConfigAssignments(params: {
  config: { channels?: Record<string, unknown> };
  defaults: SecretDefaults | undefined;
  context: ResolverContext;
}): void {
  const resolved = getChannelSurface(params.config, "sharkord");
  if (!resolved) {
    return;
  }

  const { channel: sharkord, surface } = resolved;
  collectSimpleChannelFieldAssignments({
    channelKey: "sharkord",
    field: "bridgeSecret",
    channel: sharkord,
    surface,
    defaults: params.defaults,
    context: params.context,
    topInactiveReason: "no enabled account inherits this top-level Sharkord bridge secret.",
    accountInactiveReason: "Sharkord account is disabled.",
  });
}

export const channelSecrets = {
  secretTargetRegistryEntries,
  collectRuntimeConfigAssignments,
};
