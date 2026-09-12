import { public_contracts } from "./contracts.ts";
import type { ActivateUiHostRequest, ActivateUiHostOutcome, DeactivateUiHostRequest, DeactivateUiHostOutcome } from "./types.ts";

export interface P1OperationInvoker {
  invoke(operation_ref: string, input: unknown): Promise<unknown>;
}

export class UiHostClient {
  constructor(private readonly invoker: P1OperationInvoker) {}

  async activate_ui_host(input: ActivateUiHostRequest): Promise<ActivateUiHostOutcome> {
    return await this.invoker.invoke(public_contracts.operations.activate_ui_host.operation_ref, input) as ActivateUiHostOutcome;
  }

  async deactivate_ui_host(input: DeactivateUiHostRequest): Promise<DeactivateUiHostOutcome> {
    return await this.invoker.invoke(public_contracts.operations.deactivate_ui_host.operation_ref, input) as DeactivateUiHostOutcome;
  }
}

export function create_client(invoker: P1OperationInvoker): UiHostClient {
  return new UiHostClient(invoker);
}
