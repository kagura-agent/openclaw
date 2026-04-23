import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";

export interface SharkordPluginRuntime {
  bridgeUrl: string;
  bridgeSecret: string;
}

const { setRuntime: setSharkordRuntime, getRuntime: getSharkordRuntime } =
  createPluginRuntimeStore<SharkordPluginRuntime>("Sharkord runtime not initialized");

export { getSharkordRuntime, setSharkordRuntime };
