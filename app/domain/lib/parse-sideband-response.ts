import { Effect } from "effect";

import {
  FatalSidebandMessage,
  MalformedSidebandPacket,
  MissingPackData,
  SidebandParseError,
  UnknownSidebandChannel,
  UploadPackErrorLine,
} from "../errors/sideband-parse-error.ts";
import { UploadPackResult } from "../models/transfer-protocol.ts";
import { concatBytes } from "../utils/concat-bytes.ts";
import { decodePktLines } from "./decode-pkt-line.ts";

const decoder = new TextDecoder();

const CONTROL_PAYLOAD_PATTERN = /^(NAK\n|ACK .*\n|ready\n)$/;
const ERROR_LINE_PATTERN = /^ERR\s+.*\n?$/;

export const parseSidebandResponse = Effect.fn("parseSidebandResponse")(function*({
  content,
}: {
  content: Uint8Array<ArrayBuffer>;
}) {
  const lines = yield* decodePktLines({ content });

  const packChunks: Array<Uint8Array<ArrayBuffer>> = [];
  const progressMessages: Array<string> = [];

  let sawSideband = false;

  for (const line of lines) {
    if (line._tag === "Flush") {
      continue;
    }

    if (line.payload.byteLength === 0) {
      return yield* Effect.fail(
        new SidebandParseError({
          reason: new MalformedSidebandPacket({
            detail: "Upload-pack response contained an empty data pkt-line.",
          }),
        }),
      );
    }

    const payloadText = decoder.decode(line.payload);
    if (!sawSideband && CONTROL_PAYLOAD_PATTERN.test(payloadText)) {
      continue;
    }

    if (!sawSideband && ERROR_LINE_PATTERN.test(payloadText)) {
      return yield* Effect.fail(
        new SidebandParseError({
          reason: new UploadPackErrorLine({
            message: payloadText.replace(/^ERR\s+/, "").trimEnd(),
          }),
        }),
      );
    }

    const wasInSideband = sawSideband;
    sawSideband = true;

    const channel = line.payload[0];
    const payload = line.payload.subarray(1);

    if (channel === 1) {
      packChunks.push(payload);
      continue;
    }

    if (channel === 2) {
      progressMessages.push(decoder.decode(payload));
      continue;
    }

    if (channel === 3) {
      return yield* Effect.fail(
        new SidebandParseError({
          reason: new FatalSidebandMessage({
            message: decoder.decode(payload).trimEnd(),
          }),
        }),
      );
    }

    return yield* Effect.fail(
      new SidebandParseError({
        reason: wasInSideband
          ? new UnknownSidebandChannel({
              channel,
              detail: `Received unsupported sideband channel '${channel}'.`,
            })
          : new MalformedSidebandPacket({
              detail:
                `Expected sideband channel packet after control lines, but received payload starting with byte '${channel}' (${JSON.stringify(payloadText.slice(0, 32))}).`,
            }),
      }),
    );
  }

  if (packChunks.length === 0) {
    return yield* Effect.fail(
      new SidebandParseError({
        reason: new MissingPackData({
          detail: "No sideband channel 1 packets were found in upload-pack response.",
        }),
      }),
    );
  }

  return new UploadPackResult({
    packBytes: concatBytes(packChunks),
    progressMessages,
  });
});
