import { bundledPluginRoot } from "./scripts/lib/bundled-plugin-paths.mjs";

export const zulipExtensionIds = ["zulip"];

export const zulipExtensionTestRoots = zulipExtensionIds.map((id) => bundledPluginRoot(id));

export function isZulipExtensionRoot(root) {
  return zulipExtensionTestRoots.includes(root);
}
