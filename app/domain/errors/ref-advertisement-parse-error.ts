import { Schema } from "effect";

export const RefAdvertisementParseErrorReason = Schema.Literals([
  "MissingServicePrelude",
  "MissingServiceFlush",
  "MalformedRefLine",
  "MalformedPacketSequence",
]);

export class RefAdvertisementParseError extends Schema.TaggedErrorClass("RefAdvertisementParseError")(
  "RefAdvertisementParseError",
  {
    reason: RefAdvertisementParseErrorReason,
    detail: Schema.String,
  },
) {}
