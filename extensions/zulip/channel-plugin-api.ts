// Keep bundled channel entry imports narrow so bootstrap/discovery paths do
// not drag Zulip runtime/send surfaces into lightweight plugin loads.
// TODO: export zulipPlugin from ./src/channel.js once channel.ts is fully implemented
export const zulipPlugin = undefined; // Placeholder — Phase 1 WIP
