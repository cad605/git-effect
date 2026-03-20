import { Effect, Match, Schema, String } from "effect";

import { ObjectType } from "../models/object-type.ts";
import { parseBlobBody } from "./parse-blob-body.ts";
import { parseCommitBody } from "./parse-commit-body.ts";
import { parseTreeBody } from "./parse-tree-body.ts";

export const parseRawObject = Effect.fn("parseRawObject")(function* (raw: Buffer) {
  const nullIndex = raw.indexOf(0x00);

  const header = raw.subarray(0, nullIndex).toString();

  const [type] = String.split(" ")(header);

  const objectType = yield* Schema.decodeUnknownEffect(ObjectType)(type);

  const body = raw.subarray(nullIndex + 1);

  return yield* Match.value(objectType).pipe(
    Match.when("blob", () => parseBlobBody(body)),
    Match.when("tree", () => parseTreeBody(body)),
    Match.when("commit", () => parseCommitBody(body)),
    Match.exhaustive,
  );
});
