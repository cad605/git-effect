import { Schema } from "effect";

export class InvalidLengthPrefix extends Schema.TaggedErrorClass<InvalidLengthPrefix>()(
  "InvalidLengthPrefix",
  {
    detail: Schema.String,
  },
) {}

export class InvalidLengthValue extends Schema.TaggedErrorClass<InvalidLengthValue>()(
  "InvalidLengthValue",
  {
    detail: Schema.String,
  },
) {}

export class UnexpectedEOF extends Schema.TaggedErrorClass<UnexpectedEOF>()("UnexpectedEOF", {
  detail: Schema.String,
}) {}

export class PktLineDecodeError extends Schema.TaggedErrorClass<PktLineDecodeError>()("PktLineDecodeError", {
  reason: Schema.Union([InvalidLengthPrefix, InvalidLengthValue, UnexpectedEOF]),
}) {}

export class LengthOverflow extends Schema.TaggedErrorClass<LengthOverflow>()("LengthOverflow", {
  detail: Schema.String,
}) {}

export class PktLineEncodeError extends Schema.TaggedErrorClass<PktLineEncodeError>()("PktLineEncodeError", {
  reason: Schema.Union([LengthOverflow]),
}) {} 
