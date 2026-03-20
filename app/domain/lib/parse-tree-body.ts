import { Array, Effect, Encoding, Option, Schema } from "effect";

import { TreeEntry, TreeObject } from "../models/tree-object.ts";

export const readUntil = (buffer: Buffer, offset: number, delimiter: number) => {
  const idx = buffer.indexOf(delimiter, offset);
  return [buffer.subarray(offset, idx).toString(), idx + 1] as const;
};

export const readBytes = (buffer: Buffer, offset: number, length: number) => {
  return [buffer.subarray(offset, offset + length), offset + length] as const;
};

export const parseTreeBody = Effect.fn("parseTreeBody")(function* (body: Buffer) {
  const content = Array.unfold(0, (offset) => {
    if (offset >= body.length) {
      return Option.none();
    }

    const [mode, afterMode] = readUntil(body, offset, 0x20);
    const [name, afterName] = readUntil(body, afterMode, 0x00);
    const [hash, nextOffset] = readBytes(body, afterName, 20);

    return Option.some([{ mode, name, hash: Encoding.encodeHex(hash) }, nextOffset]);
  });

  const entries = yield* Schema.decodeUnknownEffect(Schema.Array(TreeEntry))(content);

  return new TreeObject({ entries: entries });
});
