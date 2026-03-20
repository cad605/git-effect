import { Array, Effect, Encoding, Match, Option, Schema, String, pipe } from "effect";

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

type CommitTextParts = {
  readonly headerText: string;
  readonly message: string;
};

const normalizeCommitMessage = (message: string): string =>
  String.endsWith("\n")(message) ? String.slice(0, -1)(message) : message;

const splitCommitText = (text: string): Effect.Effect<CommitTextParts, Error> => {
  const sep = text.indexOf("\n\n");
  if (sep === -1) {
    return Effect.fail(new Error("Invalid commit: expected blank line before message"));
  }
  return Effect.succeed({
    headerText: text.slice(0, sep),
    message: normalizeCommitMessage(text.slice(sep + 2)),
  });
};

const commitHeaderLineArray = (headerText: string): ReadonlyArray<string> => [
  ...String.linesIterator(headerText),
];

const decodeTreeLine = (line: string | undefined): Effect.Effect<ObjectHash, Error> =>
  line !== undefined && String.startsWith("tree ")(line)
    ? Schema.decodeUnknownEffect(ObjectHash)(line.slice(5).trim())
    : Effect.fail(new Error("Invalid commit: expected tree line"));

const decodeParentLines = (
  lines: ReadonlyArray<string>,
): Effect.Effect<
  { readonly parents: Array<ObjectHash>; readonly rest: ReadonlyArray<string> },
  Error
> =>
  Effect.gen(function* () {
    const parents: Array<ObjectHash> = [];
    let i = 0;
    while (i < lines.length && String.startsWith("parent ")(lines[i]!)) {
      parents.push(yield* Schema.decodeUnknownEffect(ObjectHash)(lines[i]!.slice(7).trim()));
      i++;
    }
    return { parents, rest: lines.slice(i) };
  });

const expectAuthorLine = (line: string | undefined): Effect.Effect<string, Error> =>
  line !== undefined && String.startsWith("author ")(line)
    ? Effect.succeed(line.slice("author ".length))
    : Effect.fail(new Error("Invalid commit: expected author line"));

const expectCommitterLine = (line: string | undefined): Effect.Effect<string, Error> =>
  line !== undefined && String.startsWith("committer ")(line)
    ? Effect.succeed(line.slice("committer ".length))
    : Effect.fail(new Error("Invalid commit: expected committer line"));

const parseCommitHeader = (
  headerText: string,
): Effect.Effect<
  {
    readonly tree: ObjectHash;
    readonly parents: Array<ObjectHash>;
    readonly author: string;
    readonly committer: string;
  },
  Error
> => {
  const lines = commitHeaderLineArray(headerText);
  return pipe(
    decodeTreeLine(lines[0]),
    Effect.flatMap((tree) =>
      pipe(
        decodeParentLines(lines.slice(1)),
        Effect.flatMap(({ parents, rest }) =>
          pipe(
            expectAuthorLine(rest[0]),
            Effect.flatMap((author) =>
              pipe(
                expectCommitterLine(rest[1]),
                Effect.flatMap((committer) =>
                  rest.length !== 2
                    ? Effect.fail(new Error("Invalid commit: unexpected lines in header"))
                    : Effect.succeed({ tree, parents, author, committer }),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
};

const parseCommitBody = Effect.fn("parseCommitBody")((body: Buffer) =>
  pipe(
    splitCommitText(body.toString("utf8")),
    Effect.flatMap(({ headerText, message }) =>
      pipe(
        parseCommitHeader(headerText),
        Effect.map((fields) => new CommitObject({ ...fields, message })),
      ),
    ),
  ),
);

export const parseGitObject = Effect.fn("parseGitObject")(function* (raw: Buffer) {
  const nullIndex = raw.indexOf(0x00);

  const header = raw.subarray(0, nullIndex).toString();
  const [type] = header.split(" ", 1);

  const objectType = yield* Schema.decodeUnknownEffect(ObjectType)(type);

  const body = raw.subarray(nullIndex + 1);

  return yield* Match.value(objectType).pipe(
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
