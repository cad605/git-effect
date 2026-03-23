import { Effect, Schema, SchemaGetter } from "effect";

import {
  MalformedPacketSequence,
  MalformedRefLine,
  MissingServiceFlush,
  MissingServicePrelude,
  RefAdvertisementParseError,
} from "../errors/ref-advertisement-parse-error.ts";
import { ObjectHash } from "../models/object.ts";
import { AdvertisedRef, RefName, UploadPackAdvertisement } from "../models/transfer-protocol.ts";
import { decodePktLines, PktLineData, PktLineFlush } from "./decode-pkt-line.ts";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const SERVICE_PRELUDE = "# service=git-upload-pack\n";
const SYMREF_CAPABILITY_PREFIX = "symref=HEAD:";

const ServicePreludePktLine = PktLineData.pipe(
  Schema.decodeTo(
    Schema.String.pipe(
      Schema.refine((value): value is string => value === SERVICE_PRELUDE, {
        description: "must match '# service=git-upload-pack\\n' service prelude",
      }),
    ),
    {
      decode: SchemaGetter.transform(({ payload }) => decoder.decode(payload)),
      encode: SchemaGetter.transform((value) => new PktLineData({ payload: encoder.encode(value) })),
    },
  ),
);

const RefLinePayload = Schema.String.pipe(
  Schema.check(Schema.isPattern(/\n$/)),
  Schema.decodeTo(
    Schema.Struct({
      identityPart: Schema.String,
      capabilityPart: Schema.String,
      hasCapabilitySection: Schema.Boolean,
    }),
    {
      decode: SchemaGetter.transform((line) => {
        const lineWithoutLF = line.slice(0, -1);
        const nullIndex = lineWithoutLF.indexOf("\0");

        return {
          identityPart: nullIndex === -1 ? lineWithoutLF : lineWithoutLF.slice(0, nullIndex),
          capabilityPart: nullIndex === -1 ? "" : lineWithoutLF.slice(nullIndex + 1),
          hasCapabilitySection: nullIndex !== -1,
        };
      }),
      encode: SchemaGetter.transform(({ identityPart, capabilityPart, hasCapabilitySection }) =>
        `${identityPart}${hasCapabilitySection ? `\0${capabilityPart}` : ""}\n`
      ),
    },
  ),
);

const RefLinePayloadWithoutCapabilities = RefLinePayload.pipe(
  Schema.refine(
    (value): value is typeof value => !value.hasCapabilitySection,
    {
      description: "capabilities are only allowed on the first advertisement ref line",
    },
  ),
);

const parseRefIdentity = Effect.fn("parseRefIdentity")(function*(raw: string) {
  const separatorIndex = raw.indexOf(" ");

  if (separatorIndex === -1) {
    return yield* Effect.fail(
      new RefAdvertisementParseError({
        reason: new MalformedRefLine({
          detail: `Expected '<hash> <name>' ref identity, received '${raw}'.`,
        }),
      }),
    );
  }

  const hash = yield* Schema.decodeUnknownEffect(ObjectHash)(raw.slice(0, separatorIndex));
  const name = yield* Schema.decodeUnknownEffect(RefName)(raw.slice(separatorIndex + 1));

  return new AdvertisedRef({ hash, name });
});

const parseRefLine = Effect.fn("parseRefLine")(
  function*({ payload, allowCapabilities }: { payload: Uint8Array<ArrayBuffer>; allowCapabilities: boolean }) {
    const { identityPart, capabilityPart } = yield* Schema.decodeUnknownEffect(
      allowCapabilities ? RefLinePayload : RefLinePayloadWithoutCapabilities,
    )(decoder.decode(payload)).pipe(
      Effect.mapError(
        () =>
          new RefAdvertisementParseError({
            reason: new MalformedRefLine({
              detail: allowCapabilities
                ? "Ref line is malformed or missing trailing newline."
                : "Only first ref line may include capability data.",
            }),
          }),
      ),
    );

    const ref = yield* parseRefIdentity(identityPart);

    const capabilities = capabilityPart
      .split(" ")
      .map((capability) => capability.trim())
      .filter((capability) => capability.length > 0);

    return { ref, capabilities };
  },
);

const resolveHeadSymrefTarget = Effect.fn("resolveHeadSymrefTarget")(function*({
  refs,
  capabilities,
}: {
  refs: ReadonlyArray<AdvertisedRef>;
  capabilities: ReadonlyArray<string>;
}) {
  const symrefCapability = capabilities.find((capability) => capability.startsWith(SYMREF_CAPABILITY_PREFIX));

  if (symrefCapability) {
    return yield* Schema.decodeUnknownEffect(RefName)(
      symrefCapability.slice(SYMREF_CAPABILITY_PREFIX.length),
    );
  }

  const headRef = refs.find((ref) => ref.name === "HEAD");

  if (headRef) {
    const matchingHead = refs.find(
      (ref) => ref.name.startsWith("refs/heads/") && ref.hash === headRef.hash,
    );

    if (matchingHead) {
      return matchingHead.name;
    }
  }

  const preferredMain = refs.find((ref) => ref.name === "refs/heads/main");
  if (preferredMain) {
    return preferredMain.name;
  }

  const preferredMaster = refs.find((ref) => ref.name === "refs/heads/master");
  if (preferredMaster) {
    return preferredMaster.name;
  }

  return refs.find((ref) => ref.name.startsWith("refs/heads/"))?.name;
});

export const parseRefAdvertisement = Effect.fn("parseRefAdvertisement")(function*({
  content,
}: {
  content: Uint8Array<ArrayBuffer>;
}) {
  const [serviceLine, flushAfterService, ...advertisementLines] = yield* decodePktLines({ content });

  yield* Schema.decodeUnknownEffect(ServicePreludePktLine)(serviceLine).pipe(
    Effect.mapError(
      () =>
        new RefAdvertisementParseError({
          reason: new MissingServicePrelude({
            detail: "Discovery response is missing or has an invalid '# service=git-upload-pack' prelude packet.",
          }),
        }),
    ),
  );

  yield* Schema.decodeUnknownEffect(PktLineFlush)(flushAfterService).pipe(
    Effect.mapError(
      () =>
        new RefAdvertisementParseError({
          reason: new MissingServiceFlush({
            detail: "Discovery response is missing flush packet after service prelude.",
          }),
        }),
    ),
  );

  const refs: Array<AdvertisedRef> = [];
  let capabilities: Array<string> = [];
  let firstRef = true;
  let sawTerminalFlush = false;

  for (const line of advertisementLines) {
    if (line._tag === "Flush") {
      sawTerminalFlush = true;
      continue;
    }

    if (sawTerminalFlush) {
      return yield* Effect.fail(
        new RefAdvertisementParseError({
          reason: new MalformedPacketSequence({
            detail: "Found data packet after terminal flush packet.",
          }),
        }),
      );
    }

    const parsed = yield* parseRefLine({ payload: line.payload, allowCapabilities: firstRef });

    if (parsed.ref.name.endsWith("^{}")) {
      continue;
    }

    refs.push(parsed.ref);

    if (firstRef) {
      capabilities = parsed.capabilities;
      firstRef = false;
    }
  }

  if (!sawTerminalFlush) {
    return yield* Effect.fail(
      new RefAdvertisementParseError({
        reason: new MalformedPacketSequence({
          detail: "Ref advertisement is missing terminal flush packet.",
        }),
      }),
    );
  }

  const headSymrefTarget = yield* resolveHeadSymrefTarget({ refs, capabilities });

  return new UploadPackAdvertisement({ refs, capabilities, headSymrefTarget });
});
