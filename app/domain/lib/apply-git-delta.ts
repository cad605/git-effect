import { Effect } from "effect";

import {
  DeltaBaseSizeMismatch,
  DeltaResultSizeMismatch,
  MalformedDeltaInstruction,
  PackfileParseError,
} from "../errors/packfile-parse-error.ts";
import { decodeDeltaVarint } from "./decode-delta-varint.ts";

const readDeltaInstructionByte = Effect.fn("readDeltaInstructionByte")(function*({
  delta,
  cursor,
  context,
}: {
  delta: Uint8Array<ArrayBuffer>;
  cursor: number;
  context: string;
}) {
  if (cursor >= delta.byteLength) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new MalformedDeltaInstruction({
          detail: `Missing byte while reading ${context} at offset ${cursor}.`,
        }),
      }),
    );
  }

  return { byte: delta[cursor], nextCursor: cursor + 1 } as const;
});

export const applyGitDelta = Effect.fn("applyGitDelta")(function*({
  base,
  delta,
}: {
  base: Uint8Array<ArrayBuffer>;
  delta: Uint8Array<ArrayBuffer>;
}) {
  const { value: expectedBaseSize, cursor: afterBaseSize } = yield* decodeDeltaVarint({
    content: delta,
    offset: 0,
    context: "delta base size",
  });
  const { value: expectedResultSize, cursor: afterResultSize } = yield* decodeDeltaVarint({
    content: delta,
    offset: afterBaseSize,
    context: "delta result size",
  });

  if (expectedBaseSize !== base.byteLength) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new DeltaBaseSizeMismatch({
          expectedSize: expectedBaseSize,
          actualSize: base.byteLength,
          detail: `Delta declared base size ${expectedBaseSize}, but base object size is ${base.byteLength}.`,
        }),
      }),
    );
  }

  const result = new Uint8Array(expectedResultSize);

  let cursor = afterResultSize;
  let writeOffset = 0;

  while (cursor < delta.byteLength) {
    const instruction = delta[cursor];
    cursor += 1;

    if (instruction === 0x00) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new MalformedDeltaInstruction({
            detail: `Encountered invalid zero delta opcode at offset ${cursor - 1}.`,
          }),
        }),
      );
    }

    if ((instruction & 0b10000000) === 0) {
      const insertSize = instruction & 0b01111111;
      if (cursor + insertSize > delta.byteLength) {
        return yield* Effect.fail(
          new PackfileParseError({
            reason: new MalformedDeltaInstruction({
              detail: `Insert opcode at offset ${cursor - 1} exceeds delta payload length.`,
            }),
          }),
        );
      }

      if (writeOffset + insertSize > result.byteLength) {
        return yield* Effect.fail(
          new PackfileParseError({
            reason: new DeltaResultSizeMismatch({
              expectedSize: expectedResultSize,
              actualSize: writeOffset + insertSize,
              detail: `Delta insert opcode at offset ${cursor - 1} overflows declared result size ${expectedResultSize}.`,
            }),
          }),
        );
      }

      result.set(delta.subarray(cursor, cursor + insertSize), writeOffset);
      cursor += insertSize;
      writeOffset += insertSize;
      continue;
    }

    let copyOffset = 0;
    let copySize = 0;

    if ((instruction & 0b00000001) !== 0) {
      const { byte, nextCursor } = yield* readDeltaInstructionByte({
        delta,
        cursor,
        context: "copy offset byte 0",
      });
      copyOffset += byte;
      cursor = nextCursor;
    }
    if ((instruction & 0b00000010) !== 0) {
      const { byte, nextCursor } = yield* readDeltaInstructionByte({
        delta,
        cursor,
        context: "copy offset byte 1",
      });
      copyOffset += byte * 2 ** 8;
      cursor = nextCursor;
    }
    if ((instruction & 0b00000100) !== 0) {
      const { byte, nextCursor } = yield* readDeltaInstructionByte({
        delta,
        cursor,
        context: "copy offset byte 2",
      });
      copyOffset += byte * 2 ** 16;
      cursor = nextCursor;
    }
    if ((instruction & 0b00001000) !== 0) {
      const { byte, nextCursor } = yield* readDeltaInstructionByte({
        delta,
        cursor,
        context: "copy offset byte 3",
      });
      copyOffset += byte * 2 ** 24;
      cursor = nextCursor;
    }
    if ((instruction & 0b00010000) !== 0) {
      const { byte, nextCursor } = yield* readDeltaInstructionByte({
        delta,
        cursor,
        context: "copy size byte 0",
      });
      copySize += byte;
      cursor = nextCursor;
    }
    if ((instruction & 0b00100000) !== 0) {
      const { byte, nextCursor } = yield* readDeltaInstructionByte({
        delta,
        cursor,
        context: "copy size byte 1",
      });
      copySize += byte * 2 ** 8;
      cursor = nextCursor;
    }
    if ((instruction & 0b01000000) !== 0) {
      const { byte, nextCursor } = yield* readDeltaInstructionByte({
        delta,
        cursor,
        context: "copy size byte 2",
      });
      copySize += byte * 2 ** 16;
      cursor = nextCursor;
    }

    if (copySize === 0) {
      copySize = 0x10000;
    }

    if (copyOffset + copySize > base.byteLength) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new MalformedDeltaInstruction({
            detail: `Copy opcode requests base range [${copyOffset}, ${copyOffset + copySize}) beyond base length ${base.byteLength}.`,
          }),
        }),
      );
    }

    if (writeOffset + copySize > result.byteLength) {
      return yield* Effect.fail(
        new PackfileParseError({
          reason: new DeltaResultSizeMismatch({
            expectedSize: expectedResultSize,
            actualSize: writeOffset + copySize,
            detail: `Copy opcode overflows declared result size ${expectedResultSize}.`,
          }),
        }),
      );
    }

    result.set(base.subarray(copyOffset, copyOffset + copySize), writeOffset);
    writeOffset += copySize;
  }

  if (writeOffset !== expectedResultSize) {
    return yield* Effect.fail(
      new PackfileParseError({
        reason: new DeltaResultSizeMismatch({
          expectedSize: expectedResultSize,
          actualSize: writeOffset,
          detail: `Delta produced ${writeOffset} bytes, expected ${expectedResultSize}.`,
        }),
      }),
    );
  }

  return result;
});
