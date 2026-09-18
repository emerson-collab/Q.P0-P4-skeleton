import { StableRuntimeError } from "../src/p0/runtime_contract.ts";
import type { MachineIdentityTokenProvider } from "./vercel_oidc_machine_identity.ts";

export type RuntimeResourceKind = "SECRET" | "ENVIRONMENT_VARIABLE";
export type RuntimeResourceDeliveryScope = "SERVER_ONLY" | "CLIENT_PUBLIC";

export interface RuntimeResourceResolutionRequest {
  readonly resource_kind: RuntimeResourceKind;
  readonly resource_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface ResolvedRuntimeResource {
  readonly resource_kind: RuntimeResourceKind;
  readonly resource_ref: string;
  readonly resource_value: string;
  readonly value_hash: string;
  readonly delivery_scope: RuntimeResourceDeliveryScope;
  readonly machine_principal_ref: string;
  readonly evidence_ref: string;
  readonly receipt_ref: string;
  readonly trace_id: string;
  readonly request_id: string;
}

export interface QSecretRuntimeResourceResolver {
  resolveExact(
    request: Readonly<RuntimeResourceResolutionRequest>,
  ): Promise<ResolvedRuntimeResource>;
}

export interface QSecretRuntimeResourceResolverOptions {
  readonly endpoint_url: string;
  readonly machine_identity_token_provider: MachineIdentityTokenProvider;
  readonly fetch_impl?: typeof fetch;
}

export class QSecretRuntimeResourceResolutionError extends StableRuntimeError {
  constructor(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(code, message, details);
    this.name = "QSecretRuntimeResourceResolutionError";
  }
}

type JsonObject = Readonly<Record<string, unknown>>;

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new QSecretRuntimeResourceResolutionError(
      "Q_SECRET_RUNTIME_REQUEST_INVALID",
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function exactResourceKind(value: unknown): RuntimeResourceKind {
  if (value !== "SECRET" && value !== "ENVIRONMENT_VARIABLE") {
    throw new QSecretRuntimeResourceResolutionError(
      "Q_SECRET_RUNTIME_REQUEST_INVALID",
      "resource_kind must be SECRET or ENVIRONMENT_VARIABLE",
    );
  }
  return value;
}

function objectValue(value: unknown): JsonObject | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonObject;
}

function deliveryScope(value: unknown): RuntimeResourceDeliveryScope | undefined {
  return value === "SERVER_ONLY" || value === "CLIENT_PUBLIC" ? value : undefined;
}

/**
 * Repository deployment/runtime support for resolving one already-selected
 * Q.Secret runtime resource. Callers supply the exact resource_ref; this helper
 * does not select, infer, translate, or own Domain/Capability resource semantics.
 */
export function createQSecretRuntimeResourceResolver(
  options: Readonly<QSecretRuntimeResourceResolverOptions>,
): QSecretRuntimeResourceResolver {
  const endpointUrl = nonEmptyString(options.endpoint_url, "endpoint_url");
  const fetchImpl = options.fetch_impl ?? fetch;

  return Object.freeze({
    async resolveExact(
      request: Readonly<RuntimeResourceResolutionRequest>,
    ): Promise<ResolvedRuntimeResource> {
      const resourceKind = exactResourceKind(request.resource_kind);
      const resourceRef = nonEmptyString(request.resource_ref, "resource_ref");
      const traceId = nonEmptyString(request.trace_id, "trace_id");
      const requestId = nonEmptyString(request.request_id, "request_id");

      const machineToken = await options.machine_identity_token_provider.resolveToken();

      let response: Response;
      try {
        response = await fetchImpl(endpointUrl, {
          method: "POST",
          cache: "no-store",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${machineToken}`,
          },
          body: JSON.stringify({
            resource_kind: resourceKind,
            resource_ref: resourceRef,
            trace_id: traceId,
            request_id: requestId,
          }),
        });
      } catch {
        throw new QSecretRuntimeResourceResolutionError(
          "Q_SECRET_RUNTIME_TRANSPORT_UNAVAILABLE",
          "Q.Secret runtime resolution transport is unavailable",
        );
      }

      const body = objectValue(await response.json().catch(() => undefined));
      if (!response.ok || body?.outcome_type !== "response") {
        const upstreamCode = typeof body?.stable_error === "string"
          ? body.stable_error
          : "Q_SECRET_RUNTIME_RESOLUTION_FAILED";
        throw new QSecretRuntimeResourceResolutionError(
          "Q_SECRET_RUNTIME_RESOLUTION_DENIED",
          "Q.Secret runtime resource resolution did not succeed",
          Object.freeze({
            upstream_code: upstreamCode,
            http_status: response.status,
          }),
        );
      }

      const responseKind = exactResourceKind(body.resource_kind);
      const responseRef = nonEmptyString(body.resource_ref, "response.resource_ref");
      const resourceValue = nonEmptyString(body.resource_value, "response.resource_value");
      const valueHash = nonEmptyString(body.value_hash, "response.value_hash");
      const scope = deliveryScope(body.delivery_scope);
      const machinePrincipalRef = nonEmptyString(
        body.machine_principal_ref,
        "response.machine_principal_ref",
      );
      const evidenceRef = nonEmptyString(body.evidence_ref, "response.evidence_ref");
      const receiptRef = nonEmptyString(body.receipt_ref, "response.receipt_ref");
      const responseTraceId = nonEmptyString(body.trace_id, "response.trace_id");
      const responseRequestId = nonEmptyString(body.request_id, "response.request_id");

      if (
        responseKind !== resourceKind
        || responseRef !== resourceRef
        || responseTraceId !== traceId
        || responseRequestId !== requestId
      ) {
        throw new QSecretRuntimeResourceResolutionError(
          "Q_SECRET_RUNTIME_RESPONSE_IDENTITY_MISMATCH",
          "Q.Secret runtime response does not preserve the exact request identity",
        );
      }

      if (!SHA256_HEX_PATTERN.test(valueHash)) {
        throw new QSecretRuntimeResourceResolutionError(
          "Q_SECRET_RUNTIME_RESPONSE_INVALID",
          "Q.Secret runtime response value_hash is invalid",
        );
      }

      if (scope === undefined || (resourceKind === "SECRET" && scope !== "SERVER_ONLY")) {
        throw new QSecretRuntimeResourceResolutionError(
          "Q_SECRET_RUNTIME_DELIVERY_SCOPE_INVALID",
          "Q.Secret runtime response delivery_scope is invalid for the requested resource",
        );
      }

      return Object.freeze({
        resource_kind: responseKind,
        resource_ref: responseRef,
        resource_value: resourceValue,
        value_hash: valueHash,
        delivery_scope: scope,
        machine_principal_ref: machinePrincipalRef,
        evidence_ref: evidenceRef,
        receipt_ref: receiptRef,
        trace_id: responseTraceId,
        request_id: responseRequestId,
      });
    },
  });
}
