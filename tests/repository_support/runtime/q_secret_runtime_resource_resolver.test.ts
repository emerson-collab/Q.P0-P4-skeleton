import assert from "node:assert/strict";
import test from "node:test";
import type { MachineIdentityTokenProvider } from "../../../runtime/vercel_oidc_machine_identity.ts";
import {
  QSecretRuntimeResourceResolutionError,
  createQSecretRuntimeResourceResolver,
} from "../../../runtime/q_secret_runtime_resource_resolver.ts";

const ENDPOINT = "https://q-secret.example.test/runtime-resolve";
const TOKEN = "opaque-machine-token";
const TRACE_ID = "trace-1";
const REQUEST_ID = "request-1";
const SECRET_REF = "vault:secret:00000000-0000-4000-8000-000000000001";
const ENV_REF = "q-secret:environment-variable:00000000-0000-4000-8000-000000000002";
const HASH = "a".repeat(64);

const machineIdentity: MachineIdentityTokenProvider = Object.freeze({
  async resolveToken() {
    return TOKEN;
  },
});

function successBody(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    outcome_type: "response",
    resource_kind: "SECRET",
    resource_ref: SECRET_REF,
    resource_value: "resolved-value",
    value_hash: HASH,
    delivery_scope: "SERVER_ONLY",
    machine_principal_ref: "machine:test",
    evidence_ref: "q.secret.runtime.config.evidence:test",
    receipt_ref: "q.secret.runtime.config.receipt:test",
    trace_id: TRACE_ID,
    request_id: REQUEST_ID,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

test("Q.Secret resolver sends only exact resource request plus machine Authorization and returns SERVER_ONLY Secret", async () => {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;

  const resolver = createQSecretRuntimeResourceResolver({
    endpoint_url: ENDPOINT,
    machine_identity_token_provider: machineIdentity,
    fetch_impl: async (url, init) => {
      seenUrl = String(url);
      seenInit = init;
      return jsonResponse(successBody());
    },
  });

  const resolved = await resolver.resolveExact({
    resource_kind: "SECRET",
    resource_ref: SECRET_REF,
    trace_id: TRACE_ID,
    request_id: REQUEST_ID,
  });

  assert.equal(seenUrl, ENDPOINT);
  assert.equal(new Headers(seenInit?.headers).get("authorization"), `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(String(seenInit?.body)), {
    resource_kind: "SECRET",
    resource_ref: SECRET_REF,
    trace_id: TRACE_ID,
    request_id: REQUEST_ID,
  });
  assert.equal(resolved.resource_value, "resolved-value");
  assert.equal(resolved.delivery_scope, "SERVER_ONLY");
  assert.ok(Object.isFrozen(resolved));
});

test("Q.Secret resolver permits CLIENT_PUBLIC only for ENVIRONMENT_VARIABLE", async () => {
  const resolver = createQSecretRuntimeResourceResolver({
    endpoint_url: ENDPOINT,
    machine_identity_token_provider: machineIdentity,
    fetch_impl: async () => jsonResponse(successBody({
      resource_kind: "ENVIRONMENT_VARIABLE",
      resource_ref: ENV_REF,
      delivery_scope: "CLIENT_PUBLIC",
    })),
  });

  const resolved = await resolver.resolveExact({
    resource_kind: "ENVIRONMENT_VARIABLE",
    resource_ref: ENV_REF,
    trace_id: TRACE_ID,
    request_id: REQUEST_ID,
  });

  assert.equal(resolved.delivery_scope, "CLIENT_PUBLIC");
});

test("Q.Secret resolver rejects response resource_ref drift", async () => {
  const resolver = createQSecretRuntimeResourceResolver({
    endpoint_url: ENDPOINT,
    machine_identity_token_provider: machineIdentity,
    fetch_impl: async () => jsonResponse(successBody({
      resource_ref: "vault:secret:00000000-0000-4000-8000-000000000099",
    })),
  });

  await assert.rejects(
    () => resolver.resolveExact({
      resource_kind: "SECRET",
      resource_ref: SECRET_REF,
      trace_id: TRACE_ID,
      request_id: REQUEST_ID,
    }),
    (error: unknown) =>
      error instanceof QSecretRuntimeResourceResolutionError
      && error.code === "Q_SECRET_RUNTIME_RESPONSE_IDENTITY_MISMATCH",
  );
});

test("Q.Secret resolver rejects response resource_kind drift", async () => {
  const resolver = createQSecretRuntimeResourceResolver({
    endpoint_url: ENDPOINT,
    machine_identity_token_provider: machineIdentity,
    fetch_impl: async () => jsonResponse(successBody({
      resource_kind: "ENVIRONMENT_VARIABLE",
    })),
  });

  await assert.rejects(
    () => resolver.resolveExact({
      resource_kind: "SECRET",
      resource_ref: SECRET_REF,
      trace_id: TRACE_ID,
      request_id: REQUEST_ID,
    }),
    (error: unknown) =>
      error instanceof QSecretRuntimeResourceResolutionError
      && error.code === "Q_SECRET_RUNTIME_RESPONSE_IDENTITY_MISMATCH",
  );
});

test("Q.Secret resolver rejects CLIENT_PUBLIC delivery for Secret", async () => {
  const resolver = createQSecretRuntimeResourceResolver({
    endpoint_url: ENDPOINT,
    machine_identity_token_provider: machineIdentity,
    fetch_impl: async () => jsonResponse(successBody({
      delivery_scope: "CLIENT_PUBLIC",
    })),
  });

  await assert.rejects(
    () => resolver.resolveExact({
      resource_kind: "SECRET",
      resource_ref: SECRET_REF,
      trace_id: TRACE_ID,
      request_id: REQUEST_ID,
    }),
    (error: unknown) =>
      error instanceof QSecretRuntimeResourceResolutionError
      && error.code === "Q_SECRET_RUNTIME_DELIVERY_SCOPE_INVALID",
  );
});

test("Q.Secret resolver rejects empty resolved resource values", async () => {
  const resolver = createQSecretRuntimeResourceResolver({
    endpoint_url: ENDPOINT,
    machine_identity_token_provider: machineIdentity,
    fetch_impl: async () => jsonResponse(successBody({
      resource_value: "",
    })),
  });

  await assert.rejects(
    () => resolver.resolveExact({
      resource_kind: "SECRET",
      resource_ref: SECRET_REF,
      trace_id: TRACE_ID,
      request_id: REQUEST_ID,
    }),
    (error: unknown) =>
      error instanceof QSecretRuntimeResourceResolutionError
      && error.code === "Q_SECRET_RUNTIME_REQUEST_INVALID",
  );
});

test("Q.Secret resolver fails closed on upstream stable error without exposing secret material", async () => {
  const resolver = createQSecretRuntimeResourceResolver({
    endpoint_url: ENDPOINT,
    machine_identity_token_provider: machineIdentity,
    fetch_impl: async () => jsonResponse({
      outcome_type: "stable_error",
      stable_error: "Q_SECRET_RUNTIME_RESOURCE_BINDING_DENIED",
      trace_id: TRACE_ID,
      request_id: REQUEST_ID,
    }, 403),
  });

  await assert.rejects(
    () => resolver.resolveExact({
      resource_kind: "SECRET",
      resource_ref: SECRET_REF,
      trace_id: TRACE_ID,
      request_id: REQUEST_ID,
    }),
    (error: unknown) =>
      error instanceof QSecretRuntimeResourceResolutionError
      && error.code === "Q_SECRET_RUNTIME_RESOLUTION_DENIED"
      && error.message === "Q.Secret runtime resource resolution did not succeed",
  );
});

test("Q.Secret resolver fails before transport when machine identity is unavailable", async () => {
  let fetchCalled = false;
  const resolver = createQSecretRuntimeResourceResolver({
    endpoint_url: ENDPOINT,
    machine_identity_token_provider: Object.freeze({
      async resolveToken() {
        throw new Error("identity unavailable");
      },
    }),
    fetch_impl: async () => {
      fetchCalled = true;
      return jsonResponse(successBody());
    },
  });

  await assert.rejects(
    () => resolver.resolveExact({
      resource_kind: "SECRET",
      resource_ref: SECRET_REF,
      trace_id: TRACE_ID,
      request_id: REQUEST_ID,
    }),
    /identity unavailable/,
  );
  assert.equal(fetchCalled, false);
});
