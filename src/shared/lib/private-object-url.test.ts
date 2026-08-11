import { describe, expect, it, vi } from "vitest";

import { createAbortBoundObjectUrl } from "./private-object-url";

function objectUrlApi(controller?: AbortController) {
  return {
    createObjectURL: vi.fn(() => {
      controller?.abort();
      return "blob:rigstage-private-fixture";
    }),
    revokeObjectURL: vi.fn(),
  };
}

describe("abort-bound private object URLs", () => {
  it("does not materialize a URL after its private-file request was cancelled", () => {
    const controller = new AbortController();
    controller.abort();
    const api = objectUrlApi();

    expect(
      createAbortBoundObjectUrl(
        new Blob([new Uint8Array([0x01])]),
        controller.signal,
        api,
      ),
    ).toBeNull();
    expect(api.createObjectURL).not.toHaveBeenCalled();
    expect(api.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revokes an active private URL once when the request scope is aborted", () => {
    const controller = new AbortController();
    const api = objectUrlApi();
    const lease = createAbortBoundObjectUrl(
      new Blob([new Uint8Array([0x02])]),
      controller.signal,
      api,
    );

    expect(lease?.url).toBe("blob:rigstage-private-fixture");
    controller.abort();
    lease?.revoke();
    lease?.revoke();

    expect(api.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(api.revokeObjectURL).toHaveBeenCalledWith(
      "blob:rigstage-private-fixture",
    );
  });

  it("removes the abort cleanup after an explicit idempotent revoke", () => {
    const controller = new AbortController();
    const api = objectUrlApi();
    const lease = createAbortBoundObjectUrl(
      new Blob([new Uint8Array([0x03])]),
      controller.signal,
      api,
    );

    lease?.revoke();
    controller.abort();

    expect(api.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("revokes immediately if cancellation wins during URL creation", () => {
    const controller = new AbortController();
    const api = objectUrlApi(controller);

    expect(
      createAbortBoundObjectUrl(
        new Blob([new Uint8Array([0x04])]),
        controller.signal,
        api,
      ),
    ).toBeNull();
    expect(api.createObjectURL).toHaveBeenCalledTimes(1);
    expect(api.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
