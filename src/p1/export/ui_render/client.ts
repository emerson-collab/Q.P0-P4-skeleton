import { public_contracts } from "./contracts.ts";
    import type { ExecuteUiRenderRequest, ExecuteUiRenderOutcome } from "./types.ts";

    export interface P1OperationInvoker {
      invoke(operation_ref: string, input: unknown): Promise<unknown>;
    }

    export class UiRenderClient {
      constructor(private readonly invoker: P1OperationInvoker) {}


async execute_ui_render(input: ExecuteUiRenderRequest): Promise<ExecuteUiRenderOutcome> {
  return await this.invoker.invoke(
    public_contracts.operations.execute_ui_render.operation_ref,
    input,
  ) as ExecuteUiRenderOutcome;
}
    }

    export function create_client(invoker: P1OperationInvoker): UiRenderClient {
      return new UiRenderClient(invoker);
    }
