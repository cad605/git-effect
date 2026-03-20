import { Array, Effect, Schema, String } from "effect";

import { CommitObject } from "../models/commit-object.ts";
import { ObjectHash } from "../models/object-hash.ts";
import { ObjectParseError } from "../models/object-parse-error.ts";

export const parseCommitBody = Effect.fn("parseCommitBody")(function*(body: Buffer) {
  const content = body.toString("utf8");

  if (!content.includes("\n\n")) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "CommitMalformedHeaders",
        detail: "Commit body is missing a blank line between headers and message.",
      }),
    );
  }

  const [metadata, ...messages] = String.split("\n\n")(content);

  if (!metadata) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "CommitMalformedHeaders",
        detail: "Commit metadata section is missing.",
      }),
    );
  }

  const message = Array.join("\n\n")(messages).trimEnd();

  const [treeLine, ...rest] = String.split("\n")(metadata);

  if (!treeLine?.startsWith("tree ")) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "CommitMalformedHeaders",
        detail: `Expected first commit header to start with 'tree ', received '${treeLine}'.`,
      }),
    );
  }

  const tree = yield* Schema.decodeUnknownEffect(ObjectHash)(String.slice("tree ".length)(treeLine));

  const [parentLines, [authorLine, committerLine]] = Array.span(rest, String.startsWith("parent "));

  if (!authorLine?.startsWith("author ")) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "CommitMalformedHeaders",
        detail: `Expected commit author header after parent headers, received '${authorLine}'.`,
      }),
    );
  }

  if (!committerLine?.startsWith("committer ")) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "CommitMalformedHeaders",
        detail: `Expected commit committer header after author header, received '${committerLine}'.`,
      }),
    );
  }

  const parents = yield* Effect.forEach(
    parentLines,
    (line) => Schema.decodeUnknownEffect(ObjectHash)(String.slice("parent ".length)(line)),
  );

  const author = String.slice("author ".length)(authorLine);

  const committer = String.slice("committer ".length)(committerLine);

  return new CommitObject({ tree, parents, author, committer, message });
});
