export const zulipExtensionTestRoots = ["extensions/zulip"];

export function isZulipExtensionRoot(root) {
  return zulipExtensionTestRoots.includes(root);
}
