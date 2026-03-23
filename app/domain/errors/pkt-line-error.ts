import { Schema } from "effect";

export const PktLineDecodeErrorReason = Schema.Literals([
  "InvalidLengthPrefix",
  "InvalidLengthValue",
  "UnexpectedEOF",
]);

export class PktLineDecodeError extends Schema.TaggedErrorClass("PktLineDecodeError")(
  "PktLineDecodeError",
  {
    reason: PktLineDecodeErrorReason,
    detail: Schema.String,
  },
) {}

export const PktLineEncodeErrorReason = Schema.Literals([
  "LengthOverflow",
]);

export class PktLineEncodeError extends Schema.TaggedErrorClass("PktLineEncodeError")(
  "PktLineEncodeError",
  {
    reason: PktLineEncodeErrorReason,
    detail: Schema.String,
  },
) {}
