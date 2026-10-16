# Local auto-materialization event boundary

Every push to the formal `main` branch writes one idempotent GitHub issue whose
identity includes the full new Skeleton commit SHA. The issue is the durable
event record while Lucas is offline.

The workflow has only `contents: read` and `issues: write`. It does not check out
code, change another repository, dispatch a deployment, merge, or store a user
token. It uses the run-scoped GitHub token only in this repository.

The Lucas runner also compares its last processed commit with `origin/main`.
That Git history fallback recovers an event if Actions or issue creation was
temporarily unavailable. Downstream code changes remain local until exact
Q.Standard CURRENT Source bytes and hashes resolve, materialization succeeds,
and every applicable test passes.
