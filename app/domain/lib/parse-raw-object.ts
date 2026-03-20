import { Effect, Match, Schema, String } from "effect";

import { ObjectParseError } from "../models/object-parse-error.ts";
import { ObjectType } from "../models/object-type.ts";
import { parseBlobBody } from "./parse-blob-body.ts";
import { parseCommitBody } from "./parse-commit-body.ts";
import { parseTreeBody } from "./parse-tree-body.ts";

export const parseRawObject = Effect.fn("parseRawObject")(function*(raw: Buffer) {
  const nullIndex = raw.indexOf(0x00);

  if (nullIndex === -1) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "MissingObjectHeaderNull",
        detail: "Object header does not contain a NULL delimiter.",
      }),
    );
  }

  const header = raw.subarray(0, nullIndex).toString();

  const [typeRaw, sizeRaw, ...rest] = String.split(" ")(header);

  if (!typeRaw || !sizeRaw || rest.length > 0) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "InvalidObjectHeader",
        detail: `Expected '<type> <size>' header, received '${header}'.`,
      }),
    );
  }

  const size = Number(sizeRaw);

  if (!Number.isInteger(size) || size < 0) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "InvalidObjectHeader",
        detail: `Invalid object size '${sizeRaw}' in header '${header}'.`,
      }),
    );
  }

  const type = yield* Schema.decodeUnknownEffect(ObjectType)(typeRaw);

  const body = raw.subarray(nullIndex + 1);

  if (body.length !== size) {
    return yield* Effect.fail(
      new ObjectParseError({
        reason: "InvalidObjectHeader",
        detail: `Header size ${size} does not match body length ${body.length}.`,
      }),
    );
  }

  return yield* Match.value(type).pipe(
    Match.when("blob", () => parseBlobBody(body)),
    Match.when("tree", () => parseTreeBody(body)),
    Match.when("commit", () => parseCommitBody(body)),
    Match.exhaustive,
  );
});
