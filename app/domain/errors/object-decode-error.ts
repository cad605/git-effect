import { Schema } from "effect";

export const ObjectDecodeErrorReason = Schema.Literals([
  "MissingObjectHeaderNull",
  "InvalidObjectHeader",
  "TreeMissingDelimiter",
  "TreeTruncatedHash",
  "TreeTrailingBytes",
  "CommitMalformedHeaders",
]);

export class ObjectDecodeError extends Schema.TaggedErrorClass("ObjectDecodeError")(
  "ObjectDecodeError",
  {
    reason: ObjectDecodeErrorReason,
    detail: Schema.String,
  },
) {}
