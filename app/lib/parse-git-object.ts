import { Effect, Match, Schema } from "effect";

import { ObjectType } from "../models/object-type.ts";
import { parseBlobBody } from "./parse-blob-body.ts";
import { parseCommitBody } from "./parse-commit-body.ts";
import { parseTreeBody } from "./parse-tree-body.ts";

export const parseGitObject = Effect.fn("parseGitObject")(function* (raw: Buffer) {
  const nullIndex = raw.indexOf(0x00);

  const header = raw.subarray(0, nullIndex).toString();
  const [type] = header.split(" ", 1);

  const objectType = yield* Schema.decodeUnknownEffect(ObjectType)(type);

  const body = raw.subarray(nullIndex + 1);

  return yield* Match.value(objectType).pipe(
    Match.when("blob", () => parseBlobBody(body)),
    Match.when("tree", () => parseTreeBody(body)),
    Match.when("commit", () => parseCommitBody(body)),
    Match.exhaustive,
  );
});
