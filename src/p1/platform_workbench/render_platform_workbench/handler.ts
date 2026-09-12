import { createHash } from "node:crypto";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

type StableErrorCode =
  | "PLATFORM_PRESENTATION_DESIGN_REQUIREMENTS_INVALID"
  | "PLATFORM_PRESENTATION_DESIGN_CONFLICT"
  | "PLATFORM_BUSINESS_SEMANTIC_INPUT_FORBIDDEN"
  | "PLATFORM_Q_UI_RENDER_OWNERSHIP_VIOLATION"
  | "PLATFORM_THEME_OWNERSHIP_VIOLATION"
  | "PLATFORM_UNDECLARED_PRESENTATION_FIELD";

type PlatformWorkbenchStableError = Readonly<{
  error_code: StableErrorCode;
  message: string;
}>;

type PlatformDesignRequirements = Readonly<{
  workspace_design: JsonObject;
  domain_aggregation_design: JsonObject;
  navigation_design: JsonObject;
  arrangement_design: JsonObject;
  dock_design: JsonObject;
  responsive_composition_requirements: JsonObject;
}>;

type RenderPlatformWorkbenchResponse = Readonly<{
  platform_presentation_context: Readonly<{
    presentation_context_ref: string;
    presentation_context_kind: "PLATFORM";
    workspace_design: JsonObject;
    domain_aggregation_design: JsonObject;
    navigation_design: JsonObject;
    arrangement_design: JsonObject;
    dock_design: JsonObject;
    responsive_composition_requirements: JsonObject;
    surface_requirements: JsonObject;
    content_hash: string;
  }>;
}>;

export type PlatformWorkbenchOperationResult =
  | Readonly<{ kind: "response"; response: RenderPlatformWorkbenchResponse }>
  | Readonly<{ kind: "stable_error"; stable_error: PlatformWorkbenchStableError }>;

const INVALID_MESSAGE =
  "Platform presentation design requirements are incomplete or invalid.";
const UNDECLARED_MESSAGE =
  "The request contains an undeclared platform presentation design field.";

const REQUIRED_DESIGN_KEYS = [
  "workspace_design",
  "domain_aggregation_design",
  "navigation_design",
  "arrangement_design",
  "dock_design",
  "responsive_composition_requirements",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validateJsonSafe(
  value: unknown,
  ancestors: WeakSet<object>,
): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object") {
    return false;
  }

  const objectValue = value as object;
  if (ancestors.has(objectValue) || Object.getOwnPropertySymbols(objectValue).length !== 0) {
    return false;
  }

  ancestors.add(objectValue);
  try {
    if (Array.isArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const enumerableKeys = Object.keys(value);
      if (enumerableKeys.length !== value.length) {
        return false;
      }
      for (let index = 0; index < value.length; index += 1) {
        const key = String(index);
        const descriptor = descriptors[key];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true ||
          !validateJsonSafe(descriptor.value, ancestors)
        ) {
          return false;
        }
      }
      for (const key of enumerableKeys) {
        if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
          return false;
        }
      }
      return true;
    }

    if (!isPlainObject(value)) {
      return false;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const descriptor of Object.values(descriptors)) {
      if (
        !("value" in descriptor) ||
        descriptor.enumerable !== true ||
        !validateJsonSafe(descriptor.value, ancestors)
      ) {
        return false;
      }
    }
    return true;
  } finally {
    ancestors.delete(objectValue);
  }
}

function cloneJson(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneJson(item));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, cloneJson(child)]),
  ) as JsonObject;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      deepFreeze(child);
    }
  } else {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(",")}}`;
}

function hashJson(value: JsonValue): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function invalid(): PlatformWorkbenchOperationResult {
  return deepFreeze({
    kind: "stable_error" as const,
    stable_error: {
      error_code: "PLATFORM_PRESENTATION_DESIGN_REQUIREMENTS_INVALID" as const,
      message: INVALID_MESSAGE,
    },
  });
}

function undeclared(): PlatformWorkbenchOperationResult {
  return deepFreeze({
    kind: "stable_error" as const,
    stable_error: {
      error_code: "PLATFORM_UNDECLARED_PRESENTATION_FIELD" as const,
      message: UNDECLARED_MESSAGE,
    },
  });
}

function validateRequest(
  value: unknown,
):
  | { ok: true; presentationRef: string; design: PlatformDesignRequirements }
  | { ok: false; undeclared: boolean } {
  if (!isPlainObject(value) || !validateJsonSafe(value, new WeakSet<object>())) {
    return { ok: false, undeclared: false };
  }

  const allowed = new Set(["platform_presentation_ref", "platform_design_requirements"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      return { ok: false, undeclared: true };
    }
  }

  if (
    typeof value.platform_presentation_ref !== "string" ||
    value.platform_presentation_ref.length < 1 ||
    !isPlainObject(value.platform_design_requirements)
  ) {
    return { ok: false, undeclared: false };
  }

  const rawDesign = value.platform_design_requirements;
  const allowedDesign = new Set<string>(REQUIRED_DESIGN_KEYS);
  for (const key of Object.keys(rawDesign)) {
    if (!allowedDesign.has(key)) {
      return { ok: false, undeclared: true };
    }
  }
  for (const key of REQUIRED_DESIGN_KEYS) {
    if (!isPlainObject(rawDesign[key])) {
      return { ok: false, undeclared: false };
    }
  }

  return {
    ok: true,
    presentationRef: value.platform_presentation_ref,
    design: cloneJson(rawDesign as JsonObject) as PlatformDesignRequirements,
  };
}

export function render_platform_workbench(input: unknown): PlatformWorkbenchOperationResult {
  const validated = validateRequest(input);
  if (!validated.ok) {
    return validated.undeclared ? undeclared() : invalid();
  }

  const body: JsonObject = {
    presentation_context_ref: validated.presentationRef,
    presentation_context_kind: "PLATFORM",
    workspace_design: validated.design.workspace_design,
    domain_aggregation_design: validated.design.domain_aggregation_design,
    navigation_design: validated.design.navigation_design,
    arrangement_design: validated.design.arrangement_design,
    dock_design: validated.design.dock_design,
    responsive_composition_requirements:
      validated.design.responsive_composition_requirements,
    surface_requirements: {},
  };

  const context = deepFreeze({
    ...body,
    content_hash: hashJson(body),
  }) as RenderPlatformWorkbenchResponse["platform_presentation_context"];

  return deepFreeze({
    kind: "response" as const,
    response: { platform_presentation_context: context },
  });
}

export default render_platform_workbench;
