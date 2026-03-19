import { Array, Effect, Encoding, Option, Schema } from "effect";

import { BlobObject } from "./models/blob-object.ts";
import { TreeEntry } from "./models/tree-entry.ts";
import { TreeObject } from "./models/tree-object.ts";

const readUntil = (buffer: Buffer, offset: number, delimiter: number) => {
  const idx = buffer.indexOf(delimiter, offset);
  return [buffer.subarray(offset, idx).toString(), idx + 1] as const;
};

const readBytes = (buffer: Buffer, offset: number, length: number) => {
  return [buffer.subarray(offset, offset + length), offset + length] as const;
};

const parseTreeEntries = Effect.fn("parseTreeEntries")(function* (buffer: Buffer) {
  const start = buffer.indexOf(0x00) + 1;

  const entries = Array.unfold(start, (offset) => {
    if (offset >= buffer.length) return Option.none();

    const [mode, afterMode] = readUntil(buffer, offset, 0x20);
    const [name, afterName] = readUntil(buffer, afterMode, 0x00);
    const [shaBytes, nextOffset] = readBytes(buffer, afterName, 20);
    const type = mode === "40000" ? "tree" : "blob";

    return Option.some([{ mode, name, sha: Encoding.encodeHex(shaBytes), type }, nextOffset]);
  });

  return yield* Schema.decodeUnknownEffect(Schema.Array(TreeEntry))(entries);
});

export const parseObject = Effect.fn("parseObject")(function* (raw: Buffer) {
  const nullIndex = raw.indexOf(0x00);
  const header = raw.subarray(0, nullIndex).toString();
  const [type] = header.split(" ");

  switch (type) {
    case "blob":
      return new BlobObject({ content: Buffer.from(raw.subarray(nullIndex + 1)) });
    case "tree": {
      const entries = yield* parseTreeEntries(raw);
      return new TreeObject({ entries });
    }
    default:
      return yield* Effect.die(new Error(`Unknown git object type: ${type}`));
  }
});

export const serializeBlob = (blob: BlobObject): Buffer => {
  const header = Buffer.from(`blob ${blob.content.length}\0`);
  
  return Buffer.concat([header, blob.content]);
};

export const serializeTree = Effect.fn("serializeTree")(function* (tree: TreeObject) {
  const entryBuffers = yield* Effect.forEach(
    tree.entries,
    Effect.fnUntraced(function* ({ mode, name, sha }) {
      const shaBytes = yield* Encoding.decodeHex(sha);

      return Buffer.concat([Buffer.from(`${mode} ${name}\0`), shaBytes]);
    }),
  );

  const body = Buffer.concat(entryBuffers);
  const header = Buffer.from(`tree ${body.length}\0`);

  return Buffer.concat([header, body]);
});
