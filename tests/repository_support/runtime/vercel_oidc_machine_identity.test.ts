import assert from "node:assert/strict";
import test from "node:test";
import {
  MachineIdentityRuntimeError,
  createVercelOidcMachineIdentityTokenProvider,
} from "../../../runtime/vercel_oidc_machine_identity.ts";

test("Vercel OIDC machine identity provider returns the exact opaque token", async () => {
  const provider = createVercelOidcMachineIdentityTokenProvider(
    async () => "header.payload.signature",
  );

  assert.equal(await provider.resolveToken(), "header.payload.signature");
  assert.ok(Object.isFrozen(provider));
});

test("Vercel OIDC machine identity provider fails closed when no token is available", async () => {
  const provider = createVercelOidcMachineIdentityTokenProvider(() => undefined);

  await assert.rejects(
    () => provider.resolveToken(),
    (error: unknown) =>
      error instanceof MachineIdentityRuntimeError
      && error.code === "RUNTIME_MACHINE_IDENTITY_UNAVAILABLE",
  );
});

test("Vercel OIDC machine identity provider normalizes token acquisition failure", async () => {
  const provider = createVercelOidcMachineIdentityTokenProvider(() => {
    throw new Error("provider-specific failure");
  });

  await assert.rejects(
    () => provider.resolveToken(),
    (error: unknown) =>
      error instanceof MachineIdentityRuntimeError
      && error.code === "RUNTIME_MACHINE_IDENTITY_UNAVAILABLE"
      && !error.message.includes("provider-specific failure"),
  );
});
