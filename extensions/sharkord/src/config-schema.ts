import { buildChannelConfigSchema } from "openclaw/plugin-sdk/channel-config-primitives";
import { DmPolicySchema } from "openclaw/plugin-sdk/channel-config-schema";
import { z } from "openclaw/plugin-sdk/zod";

export const SharkordConfigSchema = z
  .object({
    bridgeUrl: z.string().optional(),
    bridgeSecret: z.string().optional(),
    listenPort: z.number().optional().default(4994),
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
  })
  .strict();

export const SharkordChannelConfigSchema = buildChannelConfigSchema(SharkordConfigSchema);
