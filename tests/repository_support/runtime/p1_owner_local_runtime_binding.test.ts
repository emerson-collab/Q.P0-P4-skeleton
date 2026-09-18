import assert from "node:assert/strict";
import test from "node:test";
import {
  resolve_p1_owner_local_runtime_binding,
  type P1OwnerLocalRuntimeBindingResolver,
} from "../../../runtime/p1_owner_local_runtime_binding.ts";

const CAPABILITY_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
const OPERATION_REF = `${CAPABILITY_REF}#/operations/read_example`;
const INTERFACE_REF = `${CAPABILITY_REF}#/interfaces/example_read_invoke`;

test("owner-local P1 runtime binding preserves exact dynamic identity and opaque ports", async () => {
  let seen: unknown;
  const resolver: P1OwnerLocalRuntimeBindingResolver = Object.freeze({
    resolveExact(identity) {
      seen = identity;
      return {
        binding_set_ref: "binding-set:test",
        attributes: {
          readExample: async () => ({ value: "ok" }),
        },
        port_refs: ["port:test"],
      };
    },
  });

  const resolved = await resolve_p1_owner_local_runtime_binding(
    {
      capability_contract_ref: CAPABILITY_REF,
      operation_ref: OPERATION_REF,
      interface_ref: INTERFACE_REF,
    },
    resolver,
  );

  assert.deepEqual(seen, {
    capability_contract_ref: CAPABILITY_REF,
    operation_ref: OPERATION_REF,
    interface_ref: INTERFACE_REF,
  });
  assert.equal(resolved?.binding_set_ref, "binding-set:test");
  assert.equal(typeof resolved?.attributes.readExample, "function");
  assert.deepEqual(resolved?.port_refs, ["port:test"]);
  assert.ok(Object.isFrozen(resolved));
  assert.ok(Object.isFrozen(resolved?.attributes));
});

test("owner-local P1 runtime binding returns undefined when receiving repository has no binding", async () => {
  const resolved = await resolve_p1_owner_local_runtime_binding(
    {
      capability_contract_ref: CAPABILITY_REF,
      operation_ref: OPERATION_REF,
      interface_ref: INTERFACE_REF,
    },
    Object.freeze({ resolveExact: () => undefined }),
  );
  assert.equal(resolved, undefined);
});

test("owner-local P1 runtime binding rejects cross-capability Operation or Interface identity", async () => {
  const resolver = Object.freeze({ resolveExact: () => undefined });
  await assert.rejects(
    () => resolve_p1_owner_local_runtime_binding(
      {
        capability_contract_ref: CAPABILITY_REF,
        operation_ref: "Q.TEST.CONTRACT.CAPABILITY.OTHER@V0100#/operations/read_example",
        interface_ref: INTERFACE_REF,
      },
      resolver,
    ),
    /operation_ref must be an exact member of capability_contract_ref/,
  );
  await assert.rejects(
    () => resolve_p1_owner_local_runtime_binding(
      {
        capability_contract_ref: CAPABILITY_REF,
        operation_ref: OPERATION_REF,
        interface_ref: "Q.TEST.CONTRACT.CAPABILITY.OTHER@V0100#/interfaces/example_read_invoke",
      },
      resolver,
    ),
    /interface_ref must be an exact member of capability_contract_ref/,
  );
});
