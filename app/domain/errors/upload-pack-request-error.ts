import { Schema } from "effect";

export class MissingUploadPackCapability extends Schema.TaggedErrorClass<MissingUploadPackCapability>()(
  "MissingUploadPackCapability",
  {
    capability: Schema.String,
    detail: Schema.String,
  },
) {}

export class UploadPackRequestError
  extends Schema.TaggedErrorClass<UploadPackRequestError>()("UploadPackRequestError", {
    reason: Schema.Union([MissingUploadPackCapability]),
  })
{}
