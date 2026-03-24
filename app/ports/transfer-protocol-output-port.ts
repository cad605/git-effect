import { type Effect, Schema, ServiceMap, type Stream } from "effect";
import type { UploadPackAdvertisement } from "../domain/models/transfer-protocol.ts";

export class DiscoveryHttpStatus extends Schema.TaggedErrorClass<DiscoveryHttpStatus>()("DiscoveryHttpStatus", {
  url: Schema.String,
  status: Schema.Number,
}) {}

export class UploadPackHttpStatus extends Schema.TaggedErrorClass<UploadPackHttpStatus>()("UploadPackHttpStatus", {
  url: Schema.String,
  status: Schema.Number,
}) {}

export class InvalidContentType extends Schema.TaggedErrorClass<InvalidContentType>()("InvalidContentType", {
  url: Schema.String,
  contentType: Schema.String,
}) {}

export class InvalidUploadPackContentType extends Schema.TaggedErrorClass<InvalidUploadPackContentType>()(
  "InvalidUploadPackContentType",
  {
    url: Schema.String,
    contentType: Schema.String,
  },
) {}

export class EmptyResponseBody extends Schema.TaggedErrorClass<EmptyResponseBody>()("EmptyResponseBody", {
  url: Schema.String,
}) {}

export class AdvertisementParseFailed extends Schema.TaggedErrorClass<AdvertisementParseFailed>()(
  "AdvertisementParseFailed",
  {
    url: Schema.String,
    cause: Schema.Defect,
  },
) {}

export class HttpRequestFailed extends Schema.TaggedErrorClass<HttpRequestFailed>()("HttpRequestFailed", {
  cause: Schema.Defect,
}) {}

export class TransferProtocolOutputPortError extends Schema.TaggedErrorClass<TransferProtocolOutputPortError>()(
  "TransferProtocolOutputPortError",
  {
    reason: Schema.Union([
      DiscoveryHttpStatus,
      UploadPackHttpStatus,
      InvalidContentType,
      InvalidUploadPackContentType,
      EmptyResponseBody,
      AdvertisementParseFailed,
      HttpRequestFailed,
    ]),
  },
) {}

export interface TransferProtocolOutputPortShape {
  discoverUploadPackRefs: ({
    url,
  }: {
    url: string;
  }) => Effect.Effect<UploadPackAdvertisement, TransferProtocolOutputPortError, never>;

  requestUploadPack: ({
    url,
    body,
  }: {
    url: string;
    body: Uint8Array<ArrayBuffer>;
  }) => Effect.Effect<
    Stream.Stream<Uint8Array<ArrayBuffer>, TransferProtocolOutputPortError>,
    TransferProtocolOutputPortError,
    never
  >;
}

export class TransferProtocolOutputPort extends ServiceMap.Service<
  TransferProtocolOutputPort,
  TransferProtocolOutputPortShape
>()("app/ports/TransferProtocolOutputPort") {}
