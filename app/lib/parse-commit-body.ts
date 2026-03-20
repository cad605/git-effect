import { Array, Effect, Option, Schema, String, pipe } from "effect";

import { CommitObject } from "../models/commit-object.ts";
import { ObjectHash } from "../models/object-hash.ts";

export const parseCommitBody = Effect.fn("parseCommitBody")(function* (body: Buffer) {
  const [headerText, ...messageParts] = pipe(body.toString("utf8"), String.split("\n\n"));
  const message = pipe(messageParts, Array.join("\n\n"), String.trimEnd);

  const [treeLine, ...rest] = String.split("\n")(headerText);

  const tree = yield* Schema.decodeUnknownEffect(ObjectHash)(treeLine.slice("tree ".length));

  const [parentLines, remaining] = Array.span(rest, (line) => line.startsWith("parent "));
  const parents = yield* Effect.forEach(parentLines, (line) =>
    Schema.decodeUnknownEffect(ObjectHash)(line.slice("parent ".length)),
  );

  const author = pipe(remaining, Array.get(0), Option.getOrThrow, (line) =>
    line.slice("author ".length),
  );
  const committer = pipe(remaining, Array.get(1), Option.getOrThrow, (line) =>
    line.slice("committer ".length),
  );

  return new CommitObject({ tree, parents, author, committer, message });
});
