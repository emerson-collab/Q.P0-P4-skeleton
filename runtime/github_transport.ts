import { createHash } from "node:crypto";

export const SYSTEM_INTERFACE_REF =
  "Q.WORKFLOW.INTERFACE.WORKFLOW_EXECUTION_INVOKE@V0101" as const;

export interface GitHubSystemInterfaceEventFacts {
  readonly event_name: string;
  readonly repository: string;
  readonly target_commit: string;
  readonly ref?: string | undefined;
  readonly before_sha?: string | undefined;
  readonly pull_request_number?: string | undefined;
  readonly sender?: string | undefined;
  readonly run_id?: string | undefined;
  readonly run_attempt?: string | undefined;
}

export interface GitHubSystemInterfaceTransportOptions {
  readonly system_interface_url: string;
  readonly bearer_token?: string | undefined;
  readonly fetch_impl?: typeof fetch | undefined;
}

function required(value: string | undefined, field: string): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) throw new Error(`${field}_REQUIRED`);
  return normalized;
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim() ?? "";
  return normalized || undefined;
}

function stableRequestRef(facts: GitHubSystemInterfaceEventFacts): string {
  const canonical = JSON.stringify({
    event_name: facts.event_name,
    repository: facts.repository,
    target_commit: facts.target_commit,
    ref: facts.ref ?? null,
    before_sha: facts.before_sha ?? null,
    pull_request_number: facts.pull_request_number ?? null,
    sender: facts.sender ?? null,
    run_id: facts.run_id ?? null,
    run_attempt: facts.run_attempt ?? null,
  });
  return `urn:q:workflow:system-interface-request:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function githubEventFactsFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): GitHubSystemInterfaceEventFacts {
  return Object.freeze({
    event_name: required(env.GITHUB_EVENT_NAME, "GITHUB_EVENT_NAME"),
    repository: required(env.GITHUB_REPOSITORY, "GITHUB_REPOSITORY"),
    target_commit: required(env.Q_TARGET_COMMIT ?? env.GITHUB_SHA, "Q_TARGET_COMMIT"),
    ref: optional(env.GITHUB_REF),
    before_sha: optional(env.Q_BEFORE_SHA),
    pull_request_number: optional(env.Q_PULL_REQUEST_NUMBER),
    sender: optional(env.GITHUB_ACTOR),
    run_id: optional(env.GITHUB_RUN_ID),
    run_attempt: optional(env.GITHUB_RUN_ATTEMPT),
  });
}

export async function invokeSystemInterfaceFromGitHubEvent(
  facts: GitHubSystemInterfaceEventFacts,
  options: GitHubSystemInterfaceTransportOptions,
): Promise<unknown> {
  const systemInterfaceUrl = required(
    options.system_interface_url,
    "Q_WORKFLOW_SYSTEM_INTERFACE_URL",
  );
  const fetchImpl = options.fetch_impl ?? fetch;
  const headers = new Headers({ "content-type": "application/json" });
  if (options.bearer_token?.trim()) {
    headers.set("authorization", `Bearer ${options.bearer_token.trim()}`);
  }

  const response = await fetchImpl(systemInterfaceUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      request_ref: stableRequestRef(facts),
      target_commit: facts.target_commit,
      transport_context: {
        source: "github",
        system_interface_ref: SYSTEM_INTERFACE_REF,
        event_name: facts.event_name,
        repository: facts.repository,
        ref: facts.ref ?? null,
        before_sha: facts.before_sha ?? null,
        pull_request_number: facts.pull_request_number ?? null,
        sender: facts.sender ?? null,
        run_id: facts.run_id ?? null,
        run_attempt: facts.run_attempt ?? null,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Q_WORKFLOW_SYSTEM_INTERFACE_GITHUB_TRANSPORT_FAILED:${response.status}:${JSON.stringify(payload)}`,
    );
  }
  return payload;
}
