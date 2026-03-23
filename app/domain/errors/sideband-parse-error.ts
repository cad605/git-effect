import { Schema } from "effect";

export class MalformedSidebandPacket extends Schema.TaggedErrorClass<MalformedSidebandPacket>()(
  "MalformedSidebandPacket",
  {
    detail: Schema.String,
  },
) {}

export class UnknownSidebandChannel extends Schema.TaggedErrorClass<UnknownSidebandChannel>()(
  "UnknownSidebandChannel",
  {
    channel: Schema.Number,
    detail: Schema.String,
  },
) {}

export class FatalSidebandMessage extends Schema.TaggedErrorClass<FatalSidebandMessage>()("FatalSidebandMessage", {
  message: Schema.String,
}) {}

export class MissingPackData extends Schema.TaggedErrorClass<MissingPackData>()("MissingPackData", {
  detail: Schema.String,
}) {}

export class SidebandParseError extends Schema.TaggedErrorClass<SidebandParseError>()("SidebandParseError", {
  reason: Schema.Union([MalformedSidebandPacket, UnknownSidebandChannel, FatalSidebandMessage, MissingPackData]),
}) {}
