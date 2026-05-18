import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "./runtime-api.js";

const { setRuntime: setSharkordRuntime, getRuntime: getSharkordRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Sharkord runtime not initialized");
export { getSharkordRuntime, setSharkordRuntime };
