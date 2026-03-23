import { Effect, Schema, String } from "effect";

import { RefAdvertisementParseError } from "../errors/ref-advertisement-parse-error.ts";
import { decodePktLines } from "./decode-pkt-line.ts";
import { AdvertisedRef, RefName, UploadPackAdvertisement } from "../models/transfer-protocol.ts";
import { ObjectHash } from "../models/object.ts";

const decoder = new TextDecoder();

const SERVICE_PRELUDE = "# service=git-upload-pack\n";
const SYMREF_CAPABILITY_PREFIX = "symref=HEAD:";

const parseRefIdentity = Effect.fn("parseRefIdentity")(function*(raw: string) {
  const separatorIndex = raw.indexOf(" ");

  if (separatorIndex === -1) {
    return yield* Effect.fail(
      new RefAdvertisementParseError({
        reason: "MalformedRefLine",
        detail: `Expected '<hash> <name>' ref identity, received '${raw}'.`,
      }),
    );
  }

  const hash = yield* Schema.decodeUnknownEffect(ObjectHash)(raw.slice(0, separatorIndex));
  const name = yield* Schema.decodeUnknownEffect(RefName)(raw.slice(separatorIndex + 1));

  return new AdvertisedRef({ hash, name });
});

const parseRefLine = Effect.fn("parseRefLine")(
  function*({ payload, allowCapabilities }: { payload: Uint8Array<ArrayBuffer>; allowCapabilities: boolean }) {
    const line = decoder.decode(payload);

    if (!String.endsWith("\n")(line)) {
      return yield* Effect.fail(
        new RefAdvertisementParseError({
          reason: "MalformedRefLine",
          detail: "Ref line is missing trailing newline.",
        }),
      );
    }

    const lineWithoutLF = line.slice(0, -1);
    const nullIndex = lineWithoutLF.indexOf("\0");

    if (nullIndex !== -1 && !allowCapabilities) {
      return yield* Effect.fail(
        new RefAdvertisementParseError({
          reason: "MalformedRefLine",
          detail: "Only first ref line may include capability data.",
        }),
      );
    }

    const identityPart = nullIndex === -1 ? lineWithoutLF : lineWithoutLF.slice(0, nullIndex);
    const capabilityPart = nullIndex === -1 ? "" : lineWithoutLF.slice(nullIndex + 1);
    const ref = yield* parseRefIdentity(identityPart);

    const capabilities =
      capabilityPart.length === 0
        ? []
        : capabilityPart
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
  const symrefCapability = capabilities.find((capability) =>
    capability.startsWith(SYMREF_CAPABILITY_PREFIX),
  );

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

  if (serviceLine._tag !== "Data") {
    return yield* Effect.fail(
      new RefAdvertisementParseError({
        reason: "MissingServicePrelude",
        detail: "Discovery response is missing '# service=git-upload-pack' prelude packet.",
      }),
    );
  }

  const prelude = decoder.decode(serviceLine.payload);

  if (prelude !== SERVICE_PRELUDE) {
    return yield* Effect.fail(
      new RefAdvertisementParseError({
        reason: "MissingServicePrelude",
        detail: `Expected '${SERVICE_PRELUDE.trim()}', received '${prelude.trim()}'.`,
      }),
    );
  }

  if (flushAfterService._tag !== "Flush") {
    return yield* Effect.fail(
      new RefAdvertisementParseError({
        reason: "MissingServiceFlush",
        detail: "Discovery response is missing flush packet after service prelude.",
      }),
    );
  }

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
          reason: "MalformedPacketSequence",
          detail: "Found data packet after terminal flush packet.",
        }),
      );
    }

    const parsed = yield* parseRefLine({ payload: line.payload, allowCapabilities: firstRef });
    
    refs.push(parsed.ref);

    if (firstRef) {
      capabilities = parsed.capabilities;
      firstRef = false;
    }
  }

  const headSymrefTarget = yield* resolveHeadSymrefTarget({ refs, capabilities });

  return new UploadPackAdvertisement({ refs, capabilities, headSymrefTarget });
});
