const syntheticSourcePngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const alternateSyntheticSourcePngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==";

function decodeBase64Bytes(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function createSyntheticSourcePng(): Uint8Array<ArrayBuffer> {
  return decodeBase64Bytes(syntheticSourcePngBase64);
}

export function createAlternateSyntheticSourcePng(): Uint8Array<ArrayBuffer> {
  return decodeBase64Bytes(alternateSyntheticSourcePngBase64);
}
