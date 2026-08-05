export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digestInput = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function pseudonymousGenerationRef(
  kind: "attempt" | "job" | "workspace",
  value: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    `rigstage-generation:${kind}:${value}`,
  );
  return `gref_${(await sha256Hex(bytes)).slice(0, 32)}`;
}
