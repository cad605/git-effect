import { Effect } from "effect";

import { BlobObject } from "../models/blob-object.ts";

export const parseBlobBody = Effect.fn("parseBlobBody")(function* (body: Buffer) {
  return new BlobObject({ content: Buffer.from(body) });
});
