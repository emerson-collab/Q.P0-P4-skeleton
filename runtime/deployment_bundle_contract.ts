export const DEPLOYMENT_BUNDLE_REQUIRED_REPOSITORY_PATHS = Object.freeze([
  "src/**",
  "runtime/**",
  "spec/p1/**",
] as const);

export class DeploymentBundleContractError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DeploymentBundleContractError";
    this.code = code;
  }
}

export function deploymentBundleIncludePatterns(repositoryPrefix = ""): readonly string[] {
  return Object.freeze(
    DEPLOYMENT_BUNDLE_REQUIRED_REPOSITORY_PATHS.map((path) => `${repositoryPrefix}${path}`),
  );
}

export function assertDeploymentBundleCoverage(
  includePatterns: readonly string[],
  repositoryPrefix = "",
): void {
  const required = deploymentBundleIncludePatterns(repositoryPrefix);
  const missing = required.filter((pattern) => !includePatterns.includes(pattern));
  if (missing.length > 0) {
    throw new DeploymentBundleContractError(
      "RUNTIME_DEPLOYMENT_BUNDLE_INCOMPLETE",
      `deployment bundle is missing fixed repository runtime paths: ${missing.join(", ")}`,
    );
  }
}
