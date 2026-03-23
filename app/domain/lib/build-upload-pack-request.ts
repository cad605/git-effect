import { Effect } from "effect";

import { MissingUploadPackCapability, UploadPackRequestError } from "../errors/upload-pack-request-error.ts";
import type { ObjectHash } from "../models/object.ts";
import { concatBytes } from "../utils/concat-bytes.ts";
import { encodeFlushPktLine, encodePktLine } from "./encode-pkt-line.ts";

const encoder = new TextEncoder();

const REQUIRED_UPLOAD_PACK_CAPABILITIES = ["side-band-64k"] as const;
const PREFERRED_UPLOAD_PACK_CAPABILITIES = ["ofs-delta"] as const;
const OPTIONAL_UPLOAD_PACK_CAPABILITIES = ["no-progress"] as const;

export const buildUploadPackRequest = Effect.fn("buildUploadPackRequest")(function*({
  targetHash,
  serverCapabilities,
}: {
  targetHash: ObjectHash;
  serverCapabilities: ReadonlyArray<string>;
}) {
  const missingRequired = REQUIRED_UPLOAD_PACK_CAPABILITIES.find((capability) =>
    !serverCapabilities.includes(capability)
  );
  if (missingRequired) {
    return yield* Effect.fail(
      new UploadPackRequestError({
        reason: new MissingUploadPackCapability({
          capability: missingRequired,
          detail:
            `Upload-pack advertisement does not include required capability '${missingRequired}' for side-band parsing.`,
        }),
      }),
    );
  }

  const selectedCapabilities = [
    ...REQUIRED_UPLOAD_PACK_CAPABILITIES,
    ...PREFERRED_UPLOAD_PACK_CAPABILITIES.filter((capability) => serverCapabilities.includes(capability)),
    ...OPTIONAL_UPLOAD_PACK_CAPABILITIES.filter((capability) => serverCapabilities.includes(capability)),
  ];

  const wantLine = [
    `want ${targetHash}`,
    selectedCapabilities.length > 0 ? selectedCapabilities.join(" ") : "",
  ]
    .filter((part) => part.length > 0)
    .join(" ");

  const [want, done, flush] = yield* Effect.all([
    encodePktLine({
      payload: encoder.encode(`${wantLine}\n`),
    }),
    encodePktLine({
      payload: encoder.encode("done\n"),
    }),
    encodeFlushPktLine(),
  ]);

  return concatBytes([want, flush, done]);
});
