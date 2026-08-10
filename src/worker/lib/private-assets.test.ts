import { describe, expect, it, vi } from "vitest";

import { deletePrivateObjectQuietly } from "./private-assets";

function deleteBucket(outcomes: Array<"failure" | "success">) {
  let attempt = 0;
  const deleteObject = vi.fn(async () => {
    const outcome = outcomes[Math.min(attempt, outcomes.length - 1)];
    attempt += 1;
    if (outcome === "failure") {
      throw new Error("synthetic R2 delete failure");
    }
  });
  const bucket: Pick<R2Bucket, "delete"> = { delete: deleteObject };

  return { bucket, deleteObject };
}

describe("private R2 cleanup", () => {
  it("skips a missing or empty exact object key", async () => {
    const { bucket, deleteObject } = deleteBucket(["success"]);

    await deletePrivateObjectQuietly(bucket, null);
    await deletePrivateObjectQuietly(bucket, "");

    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("deletes one exact object key once when R2 succeeds", async () => {
    const { bucket, deleteObject } = deleteBucket(["success"]);

    await deletePrivateObjectQuietly(bucket, "private/exact-object");

    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject).toHaveBeenCalledWith("private/exact-object");
  });

  it("retries one transient delete failure with the same exact key", async () => {
    const { bucket, deleteObject } = deleteBucket(["failure", "success"]);

    await deletePrivateObjectQuietly(bucket, "private/transient-object");

    expect(deleteObject).toHaveBeenCalledTimes(2);
    expect(deleteObject.mock.calls).toEqual([
      ["private/transient-object"],
      ["private/transient-object"],
    ]);
  });

  it("stops after two persistent failures without reversing committed state", async () => {
    const { bucket, deleteObject } = deleteBucket(["failure", "failure"]);

    await expect(
      deletePrivateObjectQuietly(bucket, "private/persistent-object"),
    ).resolves.toBeUndefined();
    expect(deleteObject).toHaveBeenCalledTimes(2);
  });
});
