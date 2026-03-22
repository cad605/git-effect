export const concatBytes = (
  parts: ReadonlyArray<Uint8Array<ArrayBuffer>>,
): Uint8Array<ArrayBuffer> => {
  const size = parts.reduce((sum, part) => sum + part.length, 0);

  const buffer = new Uint8Array(size);

  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.length;
  }

  return buffer;
};
