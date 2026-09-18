import { getVercelOidcToken } from "@vercel/oidc";
import { StableRuntimeError } from "../src/p0/runtime_contract.ts";

export interface MachineIdentityTokenProvider {
  resolveToken(): Promise<string>;
}

export type VercelOidcTokenReader =
  () => string | undefined | Promise<string | undefined>;

export class MachineIdentityRuntimeError extends StableRuntimeError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "MachineIdentityRuntimeError";
  }
}

/**
 * Repository deployment/runtime support for acquiring the current Vercel
 * machine identity token. This helper owns no Domain, Capability, Operation,
 * Interface, Provider, Secret, or resource-selection semantics.
 */
export function createVercelOidcMachineIdentityTokenProvider(
  readToken: VercelOidcTokenReader = getVercelOidcToken,
): MachineIdentityTokenProvider {
  return Object.freeze({
    async resolveToken(): Promise<string> {
      let token: string | undefined;
      try {
        token = await readToken();
      } catch {
        throw new MachineIdentityRuntimeError(
          "RUNTIME_MACHINE_IDENTITY_UNAVAILABLE",
          "Vercel OIDC machine identity is unavailable",
        );
      }

      if (typeof token !== "string" || token.length === 0) {
        throw new MachineIdentityRuntimeError(
          "RUNTIME_MACHINE_IDENTITY_UNAVAILABLE",
          "Vercel OIDC machine identity is unavailable",
        );
      }

      return token;
    },
  });
}
