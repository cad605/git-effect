import { Effect, Schema, ServiceMap } from "effect";

export class CryptoError extends Schema.TaggedErrorClass("CryptoError")("CryptoError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export type CryptoShape = {
  hash: (buffer: Buffer) => Effect.Effect<string, CryptoError, never>;
};

export class Crypto extends ServiceMap.Service<Crypto, CryptoShape>()("app/ports/Crypto") {}
