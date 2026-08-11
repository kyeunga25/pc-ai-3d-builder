export type ObjectUrlApi = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
};

export type AbortBoundObjectUrl = {
  readonly url: string;
  revoke(): void;
};

export function createAbortBoundObjectUrl(
  blob: Blob,
  signal: AbortSignal,
  objectUrlApi: ObjectUrlApi = URL,
): AbortBoundObjectUrl | null {
  if (signal.aborted) {
    return null;
  }

  const url = objectUrlApi.createObjectURL(blob);
  let revoked = false;
  const revoke = () => {
    if (revoked) {
      return;
    }
    revoked = true;
    signal.removeEventListener("abort", revoke);
    objectUrlApi.revokeObjectURL(url);
  };

  if (signal.aborted) {
    revoke();
    return null;
  }

  signal.addEventListener("abort", revoke, { once: true });
  return { url, revoke };
}
