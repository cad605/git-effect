import { Effect } from "effect";

import { BlobObject } from "../models/blob-object.ts";

export const parseBlobBody = Effect.fn("parseBlobBody")(function*(content: Buffer) {
  return new BlobObject({ content });
});
