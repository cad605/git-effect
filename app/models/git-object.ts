import { Array, Effect, Encoding, Match, Option, Schema } from "effect";

import { BlobObject } from "./blob-object.ts";
import { CommitObject } from "./commit-object.ts";
import { ObjectHash } from "./object-hash.ts";
import { ObjectType } from "./object-type.ts";
import { TreeEntry, TreeObject } from "./tree-object.ts";

const readUntil = (buffer: Buffer, offset: number, delimiter: number) => {
  const idx = buffer.indexOf(delimiter, offset);
  return [buffer.subarray(offset, idx).toString(), idx + 1] as const;
};

const readBytes = (buffer: Buffer, offset: number, length: number) => {
  return [buffer.subarray(offset, offset + length), offset + length] as const;
};

const parseCommitBody = Effect.fn("parseCommitBody")(function* (body: Buffer) {
  const text = body.toString("utf8");
  let pos = 0;

  const readLine = (): string | undefined => {
    const nl = text.indexOf("\n", pos);
    if (nl === -1) {
      return undefined;
    }

    const line = text.slice(pos, nl);
    pos = nl + 1;

    return line;
  };

  const treeLine = readLine();
  if (treeLine === undefined || !treeLine.startsWith("tree ")) {
    return yield* Effect.fail(new Error("Invalid commit: expected tree line"));
  }

  const tree = yield* Schema.decodeUnknownEffect(ObjectHash)(treeLine.slice(5).trim());

  const parents: Array<ObjectHash> = [];
  let line = readLine();
  if (line === undefined) {
    return yield* Effect.fail(new Error("Invalid commit: unexpected end after tree"));
  }

  while (line.startsWith("parent ")) {
    const parent = yield* Schema.decodeUnknownEffect(ObjectHash)(line.slice(7).trim());
    parents.push(parent);
    const next = readLine();
    if (next === undefined) {
      return yield* Effect.fail(new Error("Invalid commit: unexpected end after parent"));
    }
    line = next;
  }

  if (!line.startsWith("author ")) {
    return yield* Effect.fail(new Error("Invalid commit: expected author line"));
  }

  const author = line.slice("author ".length);

  const committerLine = readLine();
  if (committerLine === undefined || !committerLine.startsWith("committer ")) {
    return yield* Effect.fail(new Error("Invalid commit: expected committer line"));
  }

  const committer = committerLine.slice("committer ".length);

  const blank = readLine();
  if (blank !== "") {
    return yield* Effect.fail(new Error("Invalid commit: expected blank line before message"));
  }

  let message = text.slice(pos);
  if (message.endsWith("\n")) {
    message = message.slice(0, -1);
  }

  return new CommitObject({ tree, parents, author, committer, message });
});

export const parseGitObject = Effect.fn("parseGitObject")(function* (raw: Buffer) {
  const nullIndex = raw.indexOf(0x00);

  const header = raw.subarray(0, nullIndex).toString();
  const [typeString] = header.split(" ", 1);

  const type = yield* Schema.decodeUnknownEffect(ObjectType)(typeString);

  const body = raw.subarray(nullIndex + 1);

  return yield* Match.value(type).pipe(
    Match.when(
      "blob",
      Effect.fnUntraced(function* () {
        return new BlobObject({ content: Buffer.from(body) });
      }),
    ),
    Match.when(
      "tree",
      Effect.fnUntraced(function* () {
        const content = Array.unfold(0, (offset) => {
          if (offset >= body.length) return Option.none();

          const [mode, afterMode] = readUntil(body, offset, 0x20);
          const [name, afterName] = readUntil(body, afterMode, 0x00);
          const [hash, nextOffset] = readBytes(body, afterName, 20);

          return Option.some([{ mode, name, hash: Encoding.encodeHex(hash) }, nextOffset]);
        });

        const entries = yield* Schema.decodeUnknownEffect(Schema.Array(TreeEntry))(content);

        return new TreeObject({ entries: entries });
      }),
    ),
    Match.when(
      "commit",
      Effect.fnUntraced(function* () {
        return yield* parseCommitBody(body);
      }),
    ),
    Match.exhaustive,
  );
});

export const GitObject = Schema.Union([BlobObject, TreeObject, CommitObject]);

export type GitObject = typeof GitObject.Type;
