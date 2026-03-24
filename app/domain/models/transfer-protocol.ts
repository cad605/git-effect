import { Schema } from "effect";

import { ObjectHash } from "./object.ts";

export const RefName = Schema.NonEmptyString.pipe(Schema.brand("RefName"));

export type RefName = typeof RefName.Type;

export class AdvertisedRef extends Schema.Class<AdvertisedRef>("AdvertisedRef")({
  hash: ObjectHash,
  name: RefName,
}) {}

export class UploadPackAdvertisement extends Schema.Class<UploadPackAdvertisement>(
  "UploadPackAdvertisement",
)({
  refs: Schema.Array(AdvertisedRef),
  capabilities: Schema.Array(Schema.NonEmptyString),
  headSymrefTarget: Schema.optional(RefName),
}) {}
