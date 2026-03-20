import { Effect, Match, Schema, String } from "effect";

import { CommitObject } from "../models/commit-object.ts";
import { ObjectHash } from "../models/object-hash.ts";
import { ObjectParseError } from "../models/object-parse-error.ts";

export const parseCommitBody = Effect.fn("parseCommitBody")(function*(body: Buffer) {
  const content = body.toString("utf8");

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
                new ObjectParseError({
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
                new ObjectParseError({
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
                new ObjectParseError({
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
            new ObjectParseError({
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
      new ObjectParseError({
        reason: "CommitMalformedHeaders",
        detail: "Commit is missing required 'tree' header.",
      }),
    );
  }

  if (!author) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "CommitMalformedHeaders",
        detail: "Commit is missing required 'author' header.",
      }),
    );
  }

  if (!committer) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "CommitMalformedHeaders",
        detail: "Commit is missing required 'committer' header.",
      }),
    );
  }

  return new CommitObject({ tree, parents, author, committer, message: messages.join("\n") });
});
