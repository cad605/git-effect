export const readUntil = (buffer: Buffer, offset: number, delimiter: number) => {
  const idx = buffer.indexOf(delimiter, offset);
  return [buffer.subarray(offset, idx).toString(), idx + 1] as const;
};

export const readBytes = (buffer: Buffer, offset: number, length: number) => {
  return [buffer.subarray(offset, offset + length), offset + length] as const;
};
