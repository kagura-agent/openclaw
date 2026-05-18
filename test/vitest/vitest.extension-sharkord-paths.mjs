import { bundledPluginRoot } from "../../scripts/lib/bundled-plugin-paths.mjs";

export const sharkordExtensionIds = ["sharkord"];

export const sharkordExtensionTestRoots = sharkordExtensionIds.map((id) => bundledPluginRoot(id));

export function isSharkordExtensionRoot(root) {
  return sharkordExtensionTestRoots.includes(root);
}
