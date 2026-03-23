import { Schema } from "effect";

export class InvalidPackSignature extends Schema.TaggedErrorClass<InvalidPackSignature>()("InvalidPackSignature", {
  detail: Schema.String,
}) {}

export class UnsupportedPackVersion
  extends Schema.TaggedErrorClass<UnsupportedPackVersion>()("UnsupportedPackVersion", {
    version: Schema.Number,
  })
{}

export class TruncatedPackData extends Schema.TaggedErrorClass<TruncatedPackData>()("TruncatedPackData", {
  detail: Schema.String,
}) {}

export class InvalidPackEntryHeader
  extends Schema.TaggedErrorClass<InvalidPackEntryHeader>()("InvalidPackEntryHeader", {
    detail: Schema.String,
  })
{}

export class InvalidPackObjectType extends Schema.TaggedErrorClass<InvalidPackObjectType>()("InvalidPackObjectType", {
  typeCode: Schema.Number,
  detail: Schema.String,
}) {}

export class InflatedSizeMismatch extends Schema.TaggedErrorClass<InflatedSizeMismatch>()("InflatedSizeMismatch", {
  expectedSize: Schema.Number,
  actualSize: Schema.Number,
  detail: Schema.String,
}) {}

export class PackObjectCountMismatch
  extends Schema.TaggedErrorClass<PackObjectCountMismatch>()("PackObjectCountMismatch", {
    expectedCount: Schema.Number,
    actualCount: Schema.Number,
  })
{}

export class MalformedDeltaBaseReference extends Schema.TaggedErrorClass<MalformedDeltaBaseReference>()(
  "MalformedDeltaBaseReference",
  {
    detail: Schema.String,
  },
) {}

export class PackfileParseError extends Schema.TaggedErrorClass<PackfileParseError>()("PackfileParseError", {
  reason: Schema.Union([
    InvalidPackSignature,
    UnsupportedPackVersion,
    TruncatedPackData,
    InvalidPackEntryHeader,
    InvalidPackObjectType,
    InflatedSizeMismatch,
    PackObjectCountMismatch,
    MalformedDeltaBaseReference,
  ]),
}) {}
