import { Schema } from "effect";

export class MissingServicePrelude extends Schema.TaggedErrorClass<MissingServicePrelude>()(
  "MissingServicePrelude",
  {
    detail: Schema.String,
  },
) {}

export class MissingServiceFlush extends Schema.TaggedErrorClass<MissingServiceFlush>()(
  "MissingServiceFlush",
  {
    detail: Schema.String,
  },
) {}

export class MalformedRefLine extends Schema.TaggedErrorClass<MalformedRefLine>()(
  "MalformedRefLine",
  {
    detail: Schema.String,
  },
) {}

export class MalformedPacketSequence extends Schema.TaggedErrorClass<MalformedPacketSequence>()(
  "MalformedPacketSequence",
  {
    detail: Schema.String,
  },
) {}

export class RefAdvertisementParseError extends Schema.TaggedErrorClass<RefAdvertisementParseError>()(
  "RefAdvertisementParseError",
  {
    reason: Schema.Union([
      MissingServicePrelude,
      MissingServiceFlush,
      MalformedRefLine,
      MalformedPacketSequence,
    ]),
  },
) {}
