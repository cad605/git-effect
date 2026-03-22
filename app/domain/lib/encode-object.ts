import { Effect } from "effect";
import type { ObjectType } from "../models/object.ts";
import { concatBytes } from "../utils/concat-bytes.ts";

const encoder = new TextEncoder();

export const encodeObject = Effect.fn("encodeObject")(
  function*({ type, body }: { type: ObjectType; body: Uint8Array<ArrayBuffer> }) {
    const header = encoder.encode(`${type} ${body.length}\0`);

    return concatBytes([header, body]);
  },
);
