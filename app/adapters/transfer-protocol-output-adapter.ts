import { Effect, Layer, Schedule } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { parseRefAdvertisement } from "../domain/lib/parse-ref-advertisement.ts";
import {
  AdvertisementParseFailed,
  DiscoveryHttpStatus,
  EmptyResponseBody,
  HttpRequestFailed,
  InvalidContentType,
  TransferProtocolOutputPort,
  TransferProtocolOutputPortError,
  type TransferProtocolOutputPortShape,
} from "../ports/transfer-protocol-output-port.ts";

const GIT_UPLOAD_PACK_SERVICE = "git-upload-pack";
const DISCOVERY_CONTENT_TYPE = "application/x-git-upload-pack-advertisement";

const makeImpl = Effect.gen(function*() {
  const http = (yield* HttpClient.HttpClient).pipe(
    HttpClient.retryTransient({
      schedule: Schedule.exponential(100),
      times: 3,
    }),
  );

  const discoverUploadPackRefs: TransferProtocolOutputPortShape["discoverUploadPackRefs"] = Effect.fn(
    "TransferProtocolOutputAdapter.discoverUploadPackRefs",
  )(
    function*({ url }) {
      const { headers, arrayBuffer, status } = yield* HttpClientRequest.get(url).pipe(
        HttpClientRequest.appendUrl("/info/refs"),
        HttpClientRequest.setUrlParam("service", GIT_UPLOAD_PACK_SERVICE),
        HttpClientRequest.setHeader("Accept", DISCOVERY_CONTENT_TYPE),
        http.execute,
      );

      if (status < 200 || status >= 300) {
        return yield* new TransferProtocolOutputPortError({
          reason: new DiscoveryHttpStatus({ status, url }),
        });
      }

      const contentType = headers["content-type"] ?? "";

      if (!contentType.includes(DISCOVERY_CONTENT_TYPE)) {
        return yield* new TransferProtocolOutputPortError({
          reason: new InvalidContentType({ contentType, url }),
        });
      }

      const body = new Uint8Array(yield* arrayBuffer);

      if (body.byteLength === 0) {
        return yield* new TransferProtocolOutputPortError({
          reason: new EmptyResponseBody({ url }),
        });
      }

      return yield* parseRefAdvertisement({ content: body }).pipe(
        Effect.mapError(
          (cause) =>
            new TransferProtocolOutputPortError({
              reason: new AdvertisementParseFailed({
                url,
                cause,
              }),
            }),
        ),
      );
    },
    Effect.catchTags({
      "HttpClientError": Effect.fnUntraced(function*(cause) {
        return yield* new TransferProtocolOutputPortError({
          reason: new HttpRequestFailed({ cause }),
        });
      }),
    }),
  );

  return {
    discoverUploadPackRefs,
  } satisfies TransferProtocolOutputPortShape;
});

export const TransferProtocolOutputAdapter = Layer.effect(TransferProtocolOutputPort, makeImpl);
