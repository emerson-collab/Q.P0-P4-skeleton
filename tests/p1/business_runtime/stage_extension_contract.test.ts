import assert from "node:assert/strict";
import test from "node:test";
import { P0_CONTRACT_REF } from "#q/p0/runtime_contract";
import {
  P1_CAPABILITY_GENERAL_SLOT_REFS,
  P1_CAPABILITY_GENERAL_SLOT_CATALOG,
  P1_RUNTIME_SLOT_IDS,
  P1_RUNTIME_SLOT_REFS,
  P1_RUNTIME_SLOT_CATALOG,
  P1_CONTRACT_REF,
  P1_FRAMEWORK_ANCHOR_CROSSWALK,
  create_p1_capability_stage_extension,
  project_p1_capability_general_slots,
  resolve_p1_framework_anchor,
} from "../../../src/p1/business_runtime/stage_extension_contract.ts";

const CAPABILITY_REF = "Q.TEST.CAPABILITY.EXAMPLE@V0100";
const CAPABILITY_CONTRACT_REF = "Q.TEST.CONTRACT.CAPABILITY.EXAMPLE@V0100";
const OPERATION_ID = "read_example";
const OPERATION_REF = `${CAPABILITY_CONTRACT_REF}#/operations/${OPERATION_ID}`;
const INTERFACE_REF = `${CAPABILITY_CONTRACT_REF}#/interfaces/read_example`;

function slots() {
  return project_p1_capability_general_slots({
    capability_ref: CAPABILITY_REF,
    capability_id: "example",
    capability_version: "V0100",
    capability_contract_ref: CAPABILITY_CONTRACT_REF,
    capability_contract_content_hash: `sha256:${"a".repeat(64)}`,
    stage_contract_ref: P1_CONTRACT_REF,
    runtime_contract_ref: P0_CONTRACT_REF,
    operation_id: OPERATION_ID,
    operation_ref: OPERATION_REF,
    interface_ref: INTERFACE_REF,
    surface: "CALL",
    kind: "CALL_INVOKE",
    method_ref: "invoke_business_operation",
  });
}

test("V0186 GENERAL facts project only into exact predeclared P1 slot identities", () => {
  const projection = slots();
  for (const [slotId, slotRef] of Object.entries(P1_CAPABILITY_GENERAL_SLOT_REFS)) {
    const binding = projection[slotId as keyof typeof projection];
    assert.equal(binding.slot_ref, slotRef);
  }
  assert.equal(projection.operation_ref.value, OPERATION_REF);
  assert.equal(Object.isFrozen(projection), true);
});

test("StageExtension consumes the exact bound slots directly with no runtime binder", () => {
  const projection = slots();
  const extension = create_p1_capability_stage_extension({
    general_slots: projection,
    implementation_ref: CAPABILITY_CONTRACT_REF,
    provided_interface_refs: [INTERFACE_REF],
  });

  assert.equal(extension.status, "active");
  assert.equal(extension.stage_contract_ref, P1_CONTRACT_REF);
  assert.equal(extension.implementation_ref, CAPABILITY_CONTRACT_REF);
  assert.deepEqual(extension.provided_interface_refs, [INTERFACE_REF]);
});

test("StageExtension rejects field-name-only or wrong slot identity drift", () => {
  const projection = slots();
  const drifted = {
    ...projection,
    operation_ref: {
      slot_ref: "operation_ref",
      value: OPERATION_REF,
    },
  } as typeof projection;

  assert.throws(
    () => create_p1_capability_stage_extension({
      general_slots: drifted,
      implementation_ref: CAPABILITY_CONTRACT_REF,
      provided_interface_refs: [INTERFACE_REF],
    }),
    /exact predeclared P1 V0186 slot_ref/,
  );
});


test("V0186 framework-anchor crosswalk closes all eight supported concrete Interface kinds", () => {
  const cases = [
    ["CALL", "CALL_INVOKE", "read_example", "invoke_business_operation"],
    ["HOOK", "HOOK_BIND", "bind_example", "bind_business_hook"],
    ["HOOK", "HOOK_EVALUATE", "evaluate_example", "evaluate_business_hook"],
    ["EVENT", "EVENT_PUBLISH", "publish_business_event", "publish_business_event"],
    ["EVENT", "EVENT_CONSUME", "consume_business_event", "consume_business_event"],
    ["REGISTRY", "REGISTRY_REGISTER", "register_example", "register_business_object"],
    ["REGISTRY", "REGISTRY_RESOLVE", "resolve_example", "resolve_business_object"],
    ["REGISTRY", "REGISTRY_LOOKUP", "lookup_example", "lookup_business_object"],
  ] as const;

  assert.equal(Object.keys(P1_FRAMEWORK_ANCHOR_CROSSWALK).length, 8);
  for (const [surface, kind, method_ref, framework_entry_method_ref] of cases) {
    const anchor = resolve_p1_framework_anchor({ surface, kind, method_ref });
    assert.equal(anchor.surface, surface);
    assert.equal(anchor.kind, kind);
    assert.equal(anchor.framework_entry_method_ref, framework_entry_method_ref);
    assert.match(anchor.framework_interface_ref, /Q\.SS\.STD\.P1\.CONTRACT\.BUSINESS_RUNTIME@V0186#\/interfaces\//);
  }
});

test("CALL concrete method_ref remains separate from the framework entry method", () => {
  const anchor = resolve_p1_framework_anchor({
    surface: "CALL",
    kind: "CALL_INVOKE",
    method_ref: "read_example",
  });
  assert.equal(anchor.framework_entry_method_ref, "invoke_business_operation");
  assert.notEqual("read_example", anchor.framework_entry_method_ref);
});

test("EVENT preserves the existing P1 method equality rule", () => {
  assert.throws(
    () => resolve_p1_framework_anchor({
      surface: "EVENT",
      kind: "EVENT_CONSUME",
      method_ref: "custom_consume",
    }),
    /EVENT concrete method_ref must equal/,
  );
});

test("unknown Surface/Kind cannot create or infer a new framework anchor", () => {
  assert.throws(
    () => resolve_p1_framework_anchor({
      surface: "REGISTRY",
      kind: "REGISTRY_WATCH",
      method_ref: "watch_business_object",
    }),
    /must resolve exactly one pre-existing P1 V0186 framework anchor/,
  );
});

test("V0186 runtime slot catalog preserves all 18 exact identities, source classes and phases", () => {
  const expected = [
    "route_key", "trace_id", "request_id", "manifest", "qreg", "qconfig",
    "operation_contract", "policy_refs", "hook_binding_refs", "input",
    "runtime_context", "validated_context", "operation_attempt",
    "outcome_type", "runtime_result", "stable_error", "execution_receipt", "rule_evidence",
  ];
  assert.deepEqual(P1_RUNTIME_SLOT_IDS, expected);
  assert.equal(new Set(P1_RUNTIME_SLOT_IDS).size, 18);
  for (const slotId of P1_RUNTIME_SLOT_IDS) {
    assert.equal(
      P1_RUNTIME_SLOT_REFS[slotId],
      `${P1_CONTRACT_REF}#/overlay_slot_catalog/runtime_slots/${slotId}`,
    );
    assert.equal(P1_RUNTIME_SLOT_CATALOG[slotId].accepted_source_fact.length > 0, true);
  }
  assert.equal(P1_RUNTIME_SLOT_CATALOG.route_key.source_class, "P1_DERIVED_RUNTIME");
  assert.equal(P1_RUNTIME_SLOT_CATALOG.route_key.binding_phase, "PRE_DISPATCH_ROUTE_BIND");
  for (const id of ["manifest", "qreg", "qconfig", "operation_contract", "policy_refs", "hook_binding_refs"] as const) {
    assert.equal(P1_RUNTIME_SLOT_CATALOG[id].source_class, "P1_STATIC_RUNTIME_PROJECTION");
    assert.equal(P1_RUNTIME_SLOT_CATALOG[id].binding_phase, "STATIC_OVERLAY_BIND");
  }
  assert.equal(P1_RUNTIME_SLOT_CATALOG.runtime_result.source_class, "P0_RUNTIME_OUTPUT");
  assert.equal(P1_RUNTIME_SLOT_CATALOG.runtime_result.binding_phase, "P0_RUNTIME_RETURN");
  assert.equal(P1_RUNTIME_SLOT_CATALOG.execution_receipt.binding_phase, "POST_OUTCOME_PRE_RETURN");
  assert.equal(P1_RUNTIME_SLOT_CATALOG.rule_evidence.binding_phase, "POST_OUTCOME_PRE_RETURN");
  assert.equal(
    new Set([...Object.keys(P1_CAPABILITY_GENERAL_SLOT_REFS), ...P1_RUNTIME_SLOT_IDS]).size,
    13 + 18,
  );
});


/**
 * Non-authoritative contract-to-repository acceptance fixtures.
 * Exact interface whitelist snapshots are transcribed from P0 V0134 and P1 V0186.
 * Do not infer additional Surface, Kind, Method or three-layer fields from code.
 */
import { readFileSync } from "node:fs";

test("Contract V0186 exact interface whitelist: 10 framework methods and three disjoint field layers", () => {
  const expected = {
  "business_operation_invoke": {
    "surface": "CALL",
    "kind_code": "M1",
    "kind": "CALL_INVOKE",
    "method_ref": "invoke_business_operation",
    "path": [
      "route_key",
      "capability_id",
      "operation_id",
      "trace_id",
      "request_id"
    ],
    "static_mount": [
      "manifest",
      "surface",
      "qreg",
      "qconfig",
      "operation_contract",
      "policy_refs",
      "hook_binding_refs"
    ],
    "dynamic_mount": [
      "input",
      "runtime_context",
      "validated_context",
      "operation_attempt",
      "outcome_type",
      "runtime_result",
      "stable_error",
      "execution_receipt",
      "rule_evidence"
    ]
  },
  "internal_call_invoke": {
    "surface": "CALL",
    "kind_code": "M1",
    "kind": "CALL_INVOKE",
    "method_ref": "invoke_internal_call",
    "path": [
      "local_route_key",
      "trace_id",
      "parent_request_id",
      "call_path",
      "call_depth"
    ],
    "static_mount": [
      "target_operation_contract",
      "cycle_rule",
      "depth_rule",
      "hook_binding_refs"
    ],
    "dynamic_mount": [
      "input",
      "runtime_context",
      "child_request_id",
      "child_call_path",
      "child_call_depth",
      "outcome_type",
      "runtime_result",
      "stable_error",
      "execution_receipt",
      "rule_evidence"
    ]
  },
  "dependency_invoke": {
    "surface": "CALL",
    "kind_code": "M1",
    "kind": "CALL_INVOKE",
    "method_ref": "invoke_dependency",
    "path": [
      "local_dependency_id",
      "trace_id",
      "request_id"
    ],
    "static_mount": [
      "dependency_contract_ref",
      "dependency_client_ref",
      "dependency_binding_ref"
    ],
    "dynamic_mount": [
      "input",
      "context",
      "provider_resolution",
      "dependency_request",
      "outcome_type",
      "runtime_result",
      "stable_error",
      "execution_receipt",
      "rule_evidence"
    ]
  },
  "business_hook_bind": {
    "surface": "HOOK",
    "kind_code": "M2",
    "kind": "HOOK_BIND",
    "method_ref": "bind_business_hook",
    "path": [
      "hook_point_value",
      "consumer_id"
    ],
    "static_mount": [
      "p0_runtime_hook_bind_ref",
      "consumer_contract",
      "order",
      "enabled_rule"
    ],
    "dynamic_mount": [
      "binding_validation",
      "outcome_type",
      "binding_receipt",
      "stable_error"
    ]
  },
  "business_hook_evaluate": {
    "surface": "HOOK",
    "kind_code": "M3",
    "kind": "HOOK_EVALUATE",
    "method_ref": "evaluate_business_hook",
    "path": [
      "hook_point_value",
      "consumer_id",
      "trace_id",
      "request_id"
    ],
    "static_mount": [
      "p0_runtime_hook_evaluate_ref",
      "consumer_contract",
      "order"
    ],
    "dynamic_mount": [
      "hook_envelope",
      "hook_decision",
      "hook_evidence",
      "outcome_type",
      "evidence_ref",
      "stable_error"
    ]
  },
  "business_registry_register": {
    "surface": "REGISTRY",
    "kind_code": "M6",
    "kind": "REGISTRY_REGISTER",
    "method_ref": "register_business_object",
    "path": [
      "object_ref"
    ],
    "static_mount": [
      "object_contract",
      "registry_rule"
    ],
    "dynamic_mount": [
      "registration_receipt",
      "outcome_type",
      "stable_error"
    ]
  },
  "business_registry_resolve": {
    "surface": "REGISTRY",
    "kind_code": "M7",
    "kind": "REGISTRY_RESOLVE",
    "method_ref": "resolve_business_object",
    "path": [
      "resolution_key"
    ],
    "static_mount": [
      "object_contract",
      "registry_rule"
    ],
    "dynamic_mount": [
      "exact_resolution",
      "outcome_type",
      "stable_error"
    ]
  },
  "business_registry_lookup": {
    "surface": "REGISTRY",
    "kind_code": "M8",
    "kind": "REGISTRY_LOOKUP",
    "method_ref": "lookup_business_object",
    "path": [
      "lookup_query"
    ],
    "static_mount": [
      "object_contract",
      "registry_rule"
    ],
    "dynamic_mount": [
      "lookup_result",
      "outcome_type",
      "stable_error"
    ]
  },
  "business_event_publish": {
    "surface": "EVENT",
    "kind_code": "M4",
    "kind": "EVENT_PUBLISH",
    "method_ref": "publish_business_event",
    "path": [
      "subject_ref",
      "trace_id",
      "request_id"
    ],
    "static_mount": [
      "operation_contract",
      "result_contract_ref",
      "receipt_contract_ref",
      "policy_refs"
    ],
    "dynamic_mount": [
      "input",
      "runtime_context",
      "outcome_type",
      "runtime_result",
      "stable_error",
      "execution_receipt",
      "evidence_ref"
    ]
  },
  "business_event_consume": {
    "surface": "EVENT",
    "kind_code": "M5",
    "kind": "EVENT_CONSUME",
    "method_ref": "consume_business_event",
    "path": [
      "subject_ref",
      "trace_id",
      "request_id"
    ],
    "static_mount": [
      "operation_contract",
      "result_contract_ref",
      "receipt_contract_ref",
      "policy_refs"
    ],
    "dynamic_mount": [
      "input",
      "runtime_context",
      "outcome_type",
      "runtime_result",
      "stable_error",
      "execution_receipt",
      "evidence_ref"
    ]
  }
} as const;
  const file = JSON.parse(readFileSync(
    new URL("../../../spec/p1/business_runtime/interface/business_interfaces.json", import.meta.url),
    "utf8",
  )) as { interfaces: Record<string, Record<string, unknown>> };
  assert.deepEqual(Object.keys(file.interfaces), Object.keys(expected));
  for (const [name, contract] of Object.entries(expected)) {
    const actual = file.interfaces[name];
    assert.ok(actual, `missing V0186 interface ${name}`);
    for (const key of ["surface", "kind_code", "kind", "method_ref", "path", "static_mount", "dynamic_mount"] as const) {
      assert.deepEqual(actual[key], contract[key], `${name}.${key} whitelist mismatch`);
    }
    const layers = [...contract.path, ...contract.static_mount, ...contract.dynamic_mount];
    assert.equal(new Set(layers).size, layers.length, `${name} has duplicate layer members`);
  }
  assert.equal(Object.keys(P1_FRAMEWORK_ANCHOR_CROSSWALK).length, 8);
  for (const [name, contract] of Object.entries(expected)) {
    if (name === "internal_call_invoke" || name === "dependency_invoke") continue;
    const anchor = resolve_p1_framework_anchor({
      surface: contract.surface,
      kind: contract.kind,
      method_ref: contract.method_ref,
    });
    assert.equal(anchor.framework_interface_ref, `${P1_CONTRACT_REF}#/interfaces/${name}`);
    assert.equal(anchor.framework_entry_method_ref, contract.method_ref);
  }
});

test("Contract V0134 exact interface whitelist: 3 P0 public/internal methods and fields", () => {
  const expected = {
  "runtime_execution_invoke": {
    "surface": "CALL",
    "kind_code": "M1",
    "kind": "CALL_INVOKE",
    "method_ref": "invoke",
    "path": [
      "operation_id",
      "trace_id",
      "request_id"
    ],
    "static_mount": [
      "operation_contract",
      "policy_refs",
      "hook_binding_refs",
      "receipt_contract_ref"
    ],
    "dynamic_mount": [
      "input",
      "runtime_context",
      "validated_context",
      "operation_attempt",
      "outcome_type",
      "runtime_result",
      "stable_error",
      "execution_receipt",
      "evidence_ref"
    ]
  },
  "runtime_hook_bind": {
    "surface": "HOOK",
    "kind_code": "M2",
    "kind": "HOOK_BIND",
    "method_ref": "bind",
    "path": [
      "hook_point_value",
      "consumer_id"
    ],
    "static_mount": [
      "consumer_contract",
      "order",
      "enabled_rule",
      "policy_refs"
    ],
    "dynamic_mount": [
      "binding_validation",
      "binding_receipt",
      "stable_error"
    ]
  },
  "runtime_hook_evaluate": {
    "surface": "HOOK",
    "kind_code": "M3",
    "kind": "HOOK_EVALUATE",
    "method_ref": "evaluate",
    "path": [
      "hook_point_value",
      "consumer_id",
      "trace_id",
      "request_id"
    ],
    "static_mount": [
      "consumer_contract",
      "order",
      "policy_refs"
    ],
    "dynamic_mount": [
      "hook_envelope",
      "hook_decision",
      "hook_evidence",
      "evidence_ref",
      "stable_error"
    ]
  }
} as const;
  const file = JSON.parse(readFileSync(
    new URL("../../../spec/p0/interface/runtime_interfaces.json", import.meta.url),
    "utf8",
  )) as { interfaces: Record<string, Record<string, unknown>> };
  assert.deepEqual(Object.keys(file.interfaces), Object.keys(expected));
  for (const [name, contract] of Object.entries(expected)) {
    const actual = file.interfaces[name];
    assert.ok(actual, `missing V0134 interface ${name}`);
    for (const key of ["surface", "kind_code", "kind", "method_ref", "path", "static_mount", "dynamic_mount"] as const) {
      assert.deepEqual(actual[key], contract[key], `${name}.${key} whitelist mismatch`);
    }
    const layers = [...contract.path, ...contract.static_mount, ...contract.dynamic_mount];
    assert.equal(new Set(layers).size, layers.length, `${name} has duplicate layer members`);
  }
});


test("V0186 GENERAL whitelist: all 13 facts use STATIC_OVERLAY_BIND and cannot be Runtime overrides", () => {
  const expected = [
    "capability_ref", "capability_id", "capability_version", "capability_contract_ref",
    "capability_contract_content_hash", "stage_contract_ref", "runtime_contract_ref",
    "operation_id", "operation_ref", "interface_ref", "surface", "kind", "method_ref",
  ] as const;
  assert.deepEqual(Object.keys(P1_CAPABILITY_GENERAL_SLOT_CATALOG), expected);
  for (const key of expected) {
    const entry = P1_CAPABILITY_GENERAL_SLOT_CATALOG[key];
    assert.equal(entry.slot_class, "CAPABILITY_GENERAL_SLOT");
    assert.equal(entry.source_class, "CAPABILITY_GENERAL");
    assert.equal(entry.accepted_source_fact, key);
    assert.equal(entry.binding_phase, "STATIC_OVERLAY_BIND");
    assert.equal(entry.capability_instance_value_forbidden, true);
    assert.equal(entry.runtime_override_forbidden, true);
    assert.equal(
      P1_CAPABILITY_GENERAL_SLOT_REFS[key],
      `${P1_CONTRACT_REF}#/overlay_slot_catalog/capability_general_slots/${key}`,
    );
  }
  for (const key of ["capability_ref", "capability_id", "capability_version",
    "capability_contract_ref", "capability_contract_content_hash", "stage_contract_ref",
    "runtime_contract_ref"] as const) {
    assert.equal(P1_CAPABILITY_GENERAL_SLOT_CATALOG[key].source_export_group, "capability_identity");
    assert.equal(P1_CAPABILITY_GENERAL_SLOT_CATALOG[key].cardinality, "ONE_PER_CAPABILITY");
  }
  for (const key of ["operation_id", "operation_ref"] as const) {
    assert.equal(P1_CAPABILITY_GENERAL_SLOT_CATALOG[key].source_export_group, "operation_identity");
    assert.equal(P1_CAPABILITY_GENERAL_SLOT_CATALOG[key].cardinality, "ONE_PER_OPERATION");
  }
  for (const key of ["interface_ref", "surface", "kind", "method_ref"] as const) {
    assert.equal(P1_CAPABILITY_GENERAL_SLOT_CATALOG[key].source_export_group, "interface_identity");
    assert.equal(P1_CAPABILITY_GENERAL_SLOT_CATALOG[key].cardinality, "ONE_PER_INTERFACE");
  }
  const contexts = P1_CAPABILITY_GENERAL_SLOT_CATALOG.operation_ref.source_binding_contexts;
  assert.equal(contexts.length, 2);
  assert.equal(contexts[0].source_export_group, "operation_identity");
  assert.equal(contexts[1].source_export_group, "interface_identity");
  assert.equal(contexts[1].value_must_equal_bound_operation_context_operation_ref, true);
});

test("V0186 exact surface + kind whitelist: only eight matching anchors are possible", () => {
  const surfaces = ["CALL", "HOOK", "EVENT", "REGISTRY"] as const;
  const kinds = [
    "CALL_INVOKE", "HOOK_BIND", "HOOK_EVALUATE", "EVENT_PUBLISH",
    "EVENT_CONSUME", "REGISTRY_REGISTER", "REGISTRY_RESOLVE", "REGISTRY_LOOKUP",
  ] as const;
  const allowed = new Set([
    "CALL:CALL_INVOKE", "HOOK:HOOK_BIND", "HOOK:HOOK_EVALUATE",
    "EVENT:EVENT_PUBLISH", "EVENT:EVENT_CONSUME",
    "REGISTRY:REGISTRY_REGISTER", "REGISTRY:REGISTRY_RESOLVE", "REGISTRY:REGISTRY_LOOKUP",
  ]);
  assert.equal(allowed.size, 8);
  for (const surface of surfaces) {
    for (const kind of kinds) {
      const key = `${surface}:${kind}`;
      if (allowed.has(key)) {
        assert.equal(resolve_p1_framework_anchor({
          surface, kind,
          method_ref: kind === "EVENT_PUBLISH" ? "publish_business_event"
            : kind === "EVENT_CONSUME" ? "consume_business_event"
            : "owner_declared_method",
        }).surface, surface);
      } else {
        assert.throws(
          () => resolve_p1_framework_anchor({ surface, kind, method_ref: "owner_declared_method" }),
          /must resolve exactly one pre-existing/,
          `unexpected anchor: ${key}`,
        );
      }
    }
  }
});

test("V0186 rejects inferred extra GENERAL facts before binding", () => {
  const original = slots();
  const facts = Object.fromEntries(Object.entries(original).map(([key, binding]) => [key, binding.value])) as
    Parameters<typeof project_p1_capability_general_slots>[0];
  assert.throws(
    () => project_p1_capability_general_slots({
      ...facts,
      invented_business_fact: "not_in_contract",
    } as Parameters<typeof project_p1_capability_general_slots>[0]),
    /exactly the 13 predeclared V0186 facts/,
  );
});
