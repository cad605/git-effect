import { Schema } from "effect";

import { ObjectHash, ObjectType } from "./object.ts";

const NonNegativeInt = Schema.Number.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)));

export const PackObjectType = Schema.Literals(["commit", "tree", "blob", "tag", "ofs-delta", "ref-delta"]).pipe(
  Schema.brand("PackObjectType"),
);

export type PackObjectType = typeof PackObjectType.Type;

export class PackHeader extends Schema.Class<PackHeader>("PackHeader")({
  version: NonNegativeInt,
  objectCount: NonNegativeInt,
}) {}

export class PackEntry extends Schema.Class<PackEntry>("PackEntry")({
  offset: NonNegativeInt,
  type: PackObjectType,
  size: NonNegativeInt,
  payload: Schema.instanceOf(Uint8Array<ArrayBuffer>),
  baseOffset: Schema.optional(NonNegativeInt),
  baseHash: Schema.optional(ObjectHash),
}) {}

export class Packfile extends Schema.Class<Packfile>("Packfile")({
  header: PackHeader,
  entries: Schema.Array(PackEntry),
}) {}

export class ResolvedPackEntry extends Schema.Class<ResolvedPackEntry>("ResolvedPackEntry")({
  offset: NonNegativeInt,
  sourceType: PackObjectType,
  type: ObjectType,
  body: Schema.instanceOf(Uint8Array<ArrayBuffer>),
  baseOffset: Schema.optional(NonNegativeInt),
  baseHash: Schema.optional(ObjectHash),
}) {}

export class ResolvedPackfile extends Schema.Class<ResolvedPackfile>("ResolvedPackfile")({
  header: PackHeader,
  entries: Schema.Array(ResolvedPackEntry),
}) {}

export class WrittenPackObjectMetadata extends Schema.Class<WrittenPackObjectMetadata>("WrittenPackObjectMetadata")({
  sourceOffset: NonNegativeInt,
  sourceType: PackObjectType,
  type: ObjectType,
  size: NonNegativeInt,
}) {}

export type WrittenPackObjectMap = ReadonlyMap<ObjectHash, WrittenPackObjectMetadata>;
