import { Schema } from "effect";

export class MissingObjectHeaderNull extends Schema.TaggedErrorClass<MissingObjectHeaderNull>()(
  "MissingObjectHeaderNull",
  {
    detail: Schema.String,
  },
) {}

export class InvalidObjectHeader extends Schema.TaggedErrorClass<InvalidObjectHeader>()(
  "InvalidObjectHeader",
  {
    detail: Schema.String,
  },
) {}

export class TreeMissingDelimiter extends Schema.TaggedErrorClass<TreeMissingDelimiter>()(
  "TreeMissingDelimiter",
  {
    detail: Schema.String,
  },
) {}

export class TreeTruncatedHash extends Schema.TaggedErrorClass<TreeTruncatedHash>()(
  "TreeTruncatedHash",
  {
    detail: Schema.String,
  },
) {}

export class TreeTrailingBytes extends Schema.TaggedErrorClass<TreeTrailingBytes>()(
  "TreeTrailingBytes",
  {
    detail: Schema.String,
  },
) {}

export class TreeDecodeError extends Schema.TaggedErrorClass<TreeDecodeError>()(
  "TreeDecodeError",
  {
    detail: Schema.String,
  },
) {}

export class CommitMalformedHeaders extends Schema.TaggedErrorClass<CommitMalformedHeaders>()(
  "CommitMalformedHeaders",
  {
    detail: Schema.String,
  },
) {}

export class ObjectDecodeError extends Schema.TaggedErrorClass<ObjectDecodeError>()("ObjectDecodeError", {
  reason: Schema.Union([
    MissingObjectHeaderNull,
    InvalidObjectHeader,
    TreeMissingDelimiter,
    TreeTruncatedHash,
    TreeTrailingBytes,
    TreeDecodeError,
    CommitMalformedHeaders,
  ]),
}) {}
