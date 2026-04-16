import { normalizeOptionalLowercaseString } from "../../shared/string-coerce.js";
import type {
  RegisteredSandboxBackend,
  SandboxBackendFactory,
  SandboxBackendId,
  SandboxBackendManager,
  SandboxBackendRegistration,
} from "./backend.types.js";

export type {
  CreateSandboxBackendParams,
  SandboxBackendFactory,
  SandboxBackendId,
  SandboxBackendManager,
  SandboxBackendRegistration,
  SandboxBackendRuntimeInfo,
} from "./backend.types.js";
export type {
  SandboxBackendCommandParams,
  SandboxBackendCommandResult,
  SandboxBackendExecSpec,
  SandboxBackendHandle,
  SandboxFsBridgeContext,
} from "./backend-handle.types.js";

// Use globalThis + Symbol.for so that plugin Jiti loaders (which may create a
// separate module instance of this file) share the same registry as core.
const SANDBOX_BACKEND_FACTORIES_KEY = Symbol.for("openclaw.sandboxBackendFactories");

type GlobalWithSandboxBackends = typeof globalThis & {
  [key: symbol]: Map<SandboxBackendId, RegisteredSandboxBackend> | undefined;
};

function getSandboxBackendFactoriesMap(): Map<SandboxBackendId, RegisteredSandboxBackend> {
  const g = globalThis as GlobalWithSandboxBackends;
  let map = g[SANDBOX_BACKEND_FACTORIES_KEY];
  if (!map) {
    map = new Map();
    g[SANDBOX_BACKEND_FACTORIES_KEY] = map;
  }
  return map;
}

function normalizeSandboxBackendId(id: string): SandboxBackendId {
  const normalized = normalizeOptionalLowercaseString(id);
  if (!normalized) {
    throw new Error("Sandbox backend id must not be empty.");
  }
  return normalized;
}

export function registerSandboxBackend(
  id: string,
  registration: SandboxBackendRegistration,
): () => void {
  const normalizedId = normalizeSandboxBackendId(id);
  const resolved = typeof registration === "function" ? { factory: registration } : registration;
  const factories = getSandboxBackendFactoriesMap();
  const previous = factories.get(normalizedId);
  factories.set(normalizedId, resolved);
  return () => {
    if (previous) {
      getSandboxBackendFactoriesMap().set(normalizedId, previous);
      return;
    }
    getSandboxBackendFactoriesMap().delete(normalizedId);
  };
}

export function getSandboxBackendFactory(id: string): SandboxBackendFactory | null {
  return getSandboxBackendFactoriesMap().get(normalizeSandboxBackendId(id))?.factory ?? null;
}

export function getSandboxBackendManager(id: string): SandboxBackendManager | null {
  return getSandboxBackendFactoriesMap().get(normalizeSandboxBackendId(id))?.manager ?? null;
}

export function requireSandboxBackendFactory(id: string): SandboxBackendFactory {
  const factory = getSandboxBackendFactory(id);
  if (factory) {
    return factory;
  }
  throw new Error(
    [
      `Sandbox backend "${id}" is not registered.`,
      "Load the plugin that provides it, or set agents.defaults.sandbox.backend=docker.",
    ].join("\n"),
  );
}

import { createDockerSandboxBackend, dockerSandboxBackendManager } from "./docker-backend.js";
import { createSshSandboxBackend, sshSandboxBackendManager } from "./ssh-backend.js";

registerSandboxBackend("docker", {
  factory: createDockerSandboxBackend,
  manager: dockerSandboxBackendManager,
});

registerSandboxBackend("ssh", {
  factory: createSshSandboxBackend,
  manager: sshSandboxBackendManager,
});
