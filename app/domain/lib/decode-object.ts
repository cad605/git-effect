import { Effect, Encoding, Match, Schema, String } from "effect";

import { ObjectDecodeError } from "../errors/object-decode-error.ts";
import { CommitObject, ObjectHash, ObjectType, TreeEntry, TreeObject } from "../models/object.ts";
import { BlobObject } from "../models/object.ts";

const decoder = new TextDecoder();

const readUntil = (buffer: Uint8Array<ArrayBuffer>, offset: number, delimiter: number) => {
  const idx = buffer.indexOf(delimiter, offset);

  if (idx === -1) {
    return Effect.fail(
      new ObjectDecodeError({
        reason: "TreeMissingDelimiter",
        detail: `Missing delimiter 0x${delimiter.toString(16)} at offset ${offset}.`,
      }),
    );
  }

  return Effect.succeed([decoder.decode(buffer.subarray(offset, idx)), idx + 1] as const);
};

const readBytes = (buffer: Uint8Array<ArrayBuffer>, offset: number, length: number) => {
  if (offset + length > buffer.length) {
    return Effect.fail(
      new ObjectDecodeError({
        reason: "TreeTruncatedHash",
        detail: `Expected ${length} bytes at offset ${offset}, body length is ${buffer.length}.`,
      }),
    );
  }

  return Effect.succeed([buffer.subarray(offset, offset + length), offset + length] as const);
};

const decodeBlobBody = Effect.fn("decodeBlobBody")(function*(content: Uint8Array<ArrayBuffer>) {
  return new BlobObject({ content });
});

const decodeTreeBody = Effect.fn("decodeTreeBody")(function*(body: Uint8Array<ArrayBuffer>) {
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
      new ObjectDecodeError({
        reason: "TreeTrailingBytes",
        detail: `Stopped at offset ${offset}, but body length is ${body.length}.`,
      }),
    );
  }

  return new TreeObject({ entries: yield* Schema.decodeUnknownEffect(Schema.Array(TreeEntry))(content) });
});

const decodeCommitBody = Effect.fn("decodeCommitBody")(function*(body: Uint8Array<ArrayBuffer>) {
  const content = decoder.decode(body);

  const [metadata, ...messages] = String.split("\n\n")(content);

  let tree: ObjectHash | undefined;
  const parents: Array<ObjectHash> = [];
  let author: string | undefined;
  let committer: string | undefined;

  yield* Effect.forEach(
    String.linesIterator(metadata),
    Effect.fnUntraced(function*(line) {
      yield* Match.value(line).pipe(
        Match.when(
          String.startsWith("tree "),
          Effect.fnUntraced(function*() {
            if (tree) {
              return yield* Effect.fail(
                new ObjectDecodeError({
                  reason: "CommitMalformedHeaders",
                  detail: "Commit contains duplicate 'tree' headers.",
                }),
              );
            }

            tree = yield* Schema.decodeUnknownEffect(ObjectHash)(String.slice("tree ".length)(line));
          }),
        ),
        Match.when(
          String.startsWith("parent "),
          Effect.fnUntraced(function*() {
            parents.push(yield* Schema.decodeUnknownEffect(ObjectHash)(String.slice("parent ".length)(line)));
          }),
        ),
        Match.when(
          String.startsWith("author "),
          Effect.fnUntraced(function*() {
            if (author) {
              return yield* Effect.fail(
                new ObjectDecodeError({
                  reason: "CommitMalformedHeaders",
                  detail: "Commit contains duplicate 'author' headers.",
                }),
              );
            }

            author = String.slice("author ".length)(line);
          }),
        ),
        Match.when(
          String.startsWith("committer "),
          Effect.fnUntraced(function*() {
            if (committer) {
              return yield* Effect.fail(
                new ObjectDecodeError({
                  reason: "CommitMalformedHeaders",
                  detail: "Commit contains duplicate 'committer' headers.",
                }),
              );
            }

            committer = String.slice("committer ".length)(line);
          }),
        ),
        Match.orElse(Effect.fnUntraced(function*() {
          return yield* Effect.fail(
            new ObjectDecodeError({
              reason: "CommitMalformedHeaders",
              detail: "Commit contains unknown header.",
            }),
          );
        })),
      );
    }),
    { discard: true },
  );

  if (!tree) {
    return yield* Effect.fail(
      new ObjectDecodeError({
        reason: "CommitMalformedHeaders",
        detail: "Commit is missing required 'tree' header.",
      }),
    );
  }

  if (!author) {
    return yield* Effect.fail(
      new ObjectDecodeError({
        reason: "CommitMalformedHeaders",
        detail: "Commit is missing required 'author' header.",
      }),
    );
  }

  if (!committer) {
    return yield* Effect.fail(
      new ObjectDecodeError({
        reason: "CommitMalformedHeaders",
        detail: "Commit is missing required 'committer' header.",
      }),
    );
  }

  return new CommitObject({ tree, parents, author, committer, message: messages.join("\n") });
});

export const decodeObject = Effect.fn("decodeObject")(function*({ content }: { content: Uint8Array<ArrayBuffer> }) {
  const nullIndex = content.indexOf(0x00);

  if (nullIndex === -1) {
    return yield* Effect.fail(
      new ObjectDecodeError({
        reason: "MissingObjectHeaderNull",
        detail: "Object header does not contain a NULL delimiter.",
      }),
    );
  }

  const header = decoder.decode(content.subarray(0, nullIndex));

  const [typeRaw, sizeRaw, ...rest] = String.split(" ")(header);

  if (!typeRaw || !sizeRaw || rest.length > 0) {
    return yield* Effect.fail(
      new ObjectDecodeError({
        reason: "InvalidObjectHeader",
        detail: `Expected '<type> <size>' header, received '${header}'.`,
      }),
    );
  }

  const size = Number(sizeRaw);

  if (!Number.isInteger(size) || size < 0) {
    return yield* Effect.fail(
      new ObjectDecodeError({
        reason: "InvalidObjectHeader",
        detail: `Invalid object size '${sizeRaw}' in header '${header}'.`,
      }),
    );
  }

  const type = yield* Schema.decodeUnknownEffect(ObjectType)(typeRaw);

  const rawBody = content.subarray(nullIndex + 1);

  if (rawBody.length !== size) {
    return yield* Effect.fail(
      new ObjectDecodeError({
        reason: "InvalidObjectHeader",
        detail: `Header size ${size} does not match body length ${rawBody.length}.`,
      }),
    );
  }

  const body = yield* Match.value(type).pipe(
    Match.when("blob", () => decodeBlobBody(rawBody)),
    Match.when("tree", () => decodeTreeBody(rawBody)),
    Match.when("commit", () => decodeCommitBody(rawBody)),
    Match.exhaustive,
  );

  return { header: { type, size }, body };
});
