import { Array, Effect, Encoding, Option, Schema } from "effect";

import { TreeEntry, TreeObject } from "../models/tree-object.ts";
import { readBytes, readUntil } from "./buffer-read.ts";

export const parseTreeBody = Effect.fn("parseTreeBody")(function* (body: Buffer) {
  const content = Array.unfold(0, (offset) => {
    if (offset >= body.length) return Option.none();

    const [mode, afterMode] = readUntil(body, offset, 0x20);
    const [name, afterName] = readUntil(body, afterMode, 0x00);
    const [hash, nextOffset] = readBytes(body, afterName, 20);

    return Option.some([{ mode, name, hash: Encoding.encodeHex(hash) }, nextOffset]);
  });

  const entries = yield* Schema.decodeUnknownEffect(Schema.Array(TreeEntry))(content);

  return new TreeObject({ entries: entries });
});
