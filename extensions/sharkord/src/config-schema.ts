import { buildChannelConfigSchema } from "openclaw/plugin-sdk/channel-config-schema";
import { z } from "openclaw/plugin-sdk/zod";

export const SharkordConfigSchema = z
  .object({
    bridgeUrl: z.string().optional(),
    bridgeSecret: z.string().optional(),
    listenPort: z.number().int().min(1).max(65535).optional(),
  })
  .strict();

export const SharkordChannelConfigSchema = buildChannelConfigSchema(SharkordConfigSchema);
