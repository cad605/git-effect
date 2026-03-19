import { Schema } from "effect";

export class BlobObject extends Schema.TaggedClass<BlobObject>()("BlobObject", {
  content: Schema.instanceOf(Buffer),
}) {}
