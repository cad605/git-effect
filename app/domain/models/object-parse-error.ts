import { Schema } from "effect";

export const ObjectParseErrorReason = Schema.Literals([
  "MissingObjectHeaderNul",
  "InvalidObjectHeader",
  "TreeMissingDelimiter",
  "TreeTruncatedHash",
  "TreeTrailingBytes",
  "CommitMalformedHeaders",
]);

export class ObjectParseError extends Schema.TaggedErrorClass("ObjectParseError")(
  "ObjectParseError",
  {
    reason: ObjectParseErrorReason,
    detail: Schema.String,
  },
) {}
