import { Effect, Encoding, Schema } from "effect";

import { ObjectParseError } from "../models/object-parse-error.ts";
import { TreeEntry, TreeObject } from "../models/tree-object.ts";

const readUntil = (buffer: Buffer, offset: number, delimiter: number) => {
  const idx = buffer.indexOf(delimiter, offset);

  if (idx === -1) {
    return Effect.fail(
      new ObjectParseError({
        reason: "TreeMissingDelimiter",
        detail: `Missing delimiter 0x${delimiter.toString(16)} at offset ${offset}.`,
      }),
    );
  }

  return Effect.succeed([buffer.subarray(offset, idx).toString(), idx + 1] as const);
};

const readBytes = (buffer: Buffer, offset: number, length: number) => {
  if (offset + length > buffer.length) {
    return Effect.fail(
      new ObjectParseError({
        reason: "TreeTruncatedHash",
        detail: `Expected ${length} bytes at offset ${offset}, body length is ${buffer.length}.`,
      }),
    );
  }

  return Effect.succeed([buffer.subarray(offset, offset + length), offset + length] as const);
};

export const parseTreeBody = Effect.fn("parseTreeBody")(function*(body: Buffer) {
  const content: Array<{ mode: string; name: string; hash: string }> = [];

  let offset = 0;
  while (offset < body.length) {
    const [mode, afterMode] = yield* readUntil(body, offset, 0x20);
    const [name, afterName] = yield* readUntil(body, afterMode, 0x00);
    const [hash, nextOffset] = yield* readBytes(body, afterName, 20);

    content.push({ mode, name, hash: Encoding.encodeHex(hash) });

    offset = nextOffset;
  }

  if (offset !== body.length) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "TreeTrailingBytes",
        detail: `Stopped at offset ${offset}, but body length is ${body.length}.`,
      }),
    );
  }

  return new TreeObject({ entries: yield* Schema.decodeUnknownEffect(Schema.Array(TreeEntry))(content) });
});
