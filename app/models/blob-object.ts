import { Effect, Schema } from "effect";

export class BlobObject extends Schema.TaggedClass<BlobObject>()("BlobObject", {
  content: Schema.instanceOf(Buffer),
}) {
  static readonly serialize = Effect.fn("BlobObject.serialize")(function* (blob: BlobObject) {
    const header = Buffer.from(`blob ${blob.content.length}\0`);

    return Buffer.concat([header, blob.content]);
  });
}
