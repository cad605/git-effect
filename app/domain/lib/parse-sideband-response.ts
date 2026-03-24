import { Deferred, Effect, Ref, Stream } from "effect";

import {
  FatalSidebandMessage,
  MalformedSidebandPacket,
  MissingPackData,
  SidebandParseError,
  UnknownSidebandChannel,
  UploadPackErrorLine,
} from "../errors/sideband-parse-error.ts";
import { concatBytes } from "../utils/concat-bytes.ts";
import { extractPktLinesFromBuffer } from "./decode-pkt-line.ts";

const decoder = new TextDecoder();

const CONTROL_PAYLOAD_PATTERN = /^(NAK\n|ACK .*\n|ready\n)$/;
const ERROR_LINE_PATTERN = /^ERR\s+.*\n?$/;

/**
 * Parses a sideband-demuxed upload-pack response from a byte stream.
 *
 * Returns a `progressStream` that yields sideband channel 2 (progress)
 * messages as they arrive, and a `packBytes` Effect backed by a Deferred
 * that resolves with the accumulated channel 1 (pack) data once the
 * progress stream has been fully consumed.
 */
export const parseSidebandResponse = Effect.fn("parseSidebandResponseAsStream")(
  function*<Error>({ content }: { content: Stream.Stream<Uint8Array<ArrayBuffer>, Error> }) {
    const bufferRef = yield* Ref.make(new Uint8Array(0));
    
    const packChunksRef = yield* Ref.make<Array<Uint8Array<ArrayBuffer>>>([]);
    
    const packBytesDeferred = yield* Deferred.make<Uint8Array<ArrayBuffer>,Error |SidebandParseError>();
    
    const sawSidebandRef = yield* Ref.make(false);

    const progressStream = content.pipe(
      Stream.flatMap((chunk) =>
        Stream.unwrap(
          Effect.gen(function*() {
            const current = yield* Ref.get(bufferRef);
            
            const combined = concatBytes([current, chunk]);
            
            const { lines, remaining } = yield* extractPktLinesFromBuffer(combined);
            
            yield* Ref.set(bufferRef, remaining);

            const progressMessages: Array<string> = [];

            for (const line of lines) {
              if (line._tag === "Flush") {
                continue;
              }

              if (line.payload.byteLength === 0) {
                return Stream.fail(
                  new SidebandParseError({
                    reason: new MalformedSidebandPacket({
                      detail: "Upload-pack response contained an empty data pkt-line.",
                    }),
                  }),
                );
              }

              const sawSideband = yield* Ref.get(sawSidebandRef);

              const payloadText = decoder.decode(line.payload);
              if (!sawSideband && CONTROL_PAYLOAD_PATTERN.test(payloadText)) {
                continue;
              }

              if (!sawSideband && ERROR_LINE_PATTERN.test(payloadText)) {
                return Stream.fail(
                  new SidebandParseError({
                    reason: new UploadPackErrorLine({
                      message: payloadText.replace(/^ERR\s+/, "").trimEnd(),
                    }),
                  }),
                );
              }

              const wasInSideband = sawSideband;
              yield* Ref.set(sawSidebandRef, true);

              const channel = line.payload[0];
              const payload = line.payload.subarray(1);

              if (channel === 1) {
                yield* Ref.update(packChunksRef, (chunks) => [...chunks, payload]);
                continue;
              }

              if (channel === 2) {
                progressMessages.push(decoder.decode(payload));
                continue;
              }

              if (channel === 3) {
                return Stream.fail(
                  new SidebandParseError({
                    reason: new FatalSidebandMessage({
                      message: decoder.decode(payload).trimEnd(),
                    }),
                  }),
                );
              }

              return Stream.fail(
                new SidebandParseError({
                  reason: wasInSideband
                    ? new UnknownSidebandChannel({
                      channel,
                      detail: `Received unsupported sideband channel '${channel}'.`,
                    })
                    : new MalformedSidebandPacket({
                      detail:
                        `Expected sideband channel packet after control lines, but received payload starting with byte '${channel}' (${
                          JSON.stringify(payloadText.slice(0, 32))
                        }).`,
                    }),
                }),
              );
            }

            return Stream.fromIterable(progressMessages);
          }),
        )
      ),
      Stream.ensuring(
        Effect.gen(function*() {
          const chunks = yield* Ref.get(packChunksRef);
          if (chunks.length === 0) {
            yield* Deferred.fail(
              packBytesDeferred,
              new SidebandParseError({
                reason: new MissingPackData({
                  detail: "No sideband channel 1 packets were found in upload-pack response.",
                }),
              }),
            );
          } else {
            yield* Deferred.succeed(packBytesDeferred, concatBytes(chunks));
          }
        }),
      ),
    );

    return {
      progressStream,
      packBytes: Deferred.await(packBytesDeferred),
    };
  },
);
