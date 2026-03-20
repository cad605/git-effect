import { Array, Effect, Schema, String, pipe } from "effect";

import { CommitObject } from "../models/commit-object.ts";
import { ObjectHash } from "../models/object-hash.ts";

export const parseCommitBody = Effect.fn("parseCommitBody")(function* (body: Buffer) {
  const [metadata, ...messages] = pipe(body.toString("utf8"), String.split("\n\n"));

  const message = pipe(messages, Array.join("\n\n"), String.trimEnd);

  const [treeLine, ...rest] = String.split("\n")(metadata);

  const tree = yield* Schema.decodeUnknownEffect(ObjectHash)(treeLine.slice("tree ".length));

  const [parentLines, [authorLine, committerLine]] = Array.span(rest, String.startsWith("parent "));

  const parents = yield* Effect.forEach(parentLines, (line) =>
    Schema.decodeUnknownEffect(ObjectHash)(String.slice("parent ".length)(line)),
  );

  const author = String.slice("author ".length)(authorLine);

  const committer = String.slice("committer ".length)(committerLine);

  return new CommitObject({ tree, parents, author, committer, message });
});
