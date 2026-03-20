import { Effect } from "effect";

import { BlobObject } from "../models/blob-object.ts";

export const parseBlobBody = Effect.fn("parseBlobBody")((body: Buffer) =>
  Effect.succeed(new BlobObject({ content: Buffer.from(body) })),
);
