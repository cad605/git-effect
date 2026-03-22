import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { CliInputAdapter } from "./adapters/cli-input-adapter.ts";
import { CompressionOutputAdapter } from "./adapters/compression-output-adapter.ts";
import { HashOutputAdapter } from "./adapters/crypto-output-adapter.ts";
import { RepositoryOutputAdapter } from "./adapters/repository-output-adapter.ts";
import { TransferProtocolOutputAdapter } from "./adapters/transfer-protocol-output-adapter.ts";
import { GitService } from "./application/services/git.ts";

CliInputAdapter.pipe(
  Effect.provide(GitService),
  Effect.provide(RepositoryOutputAdapter),
  Effect.provide(TransferProtocolOutputAdapter),
  Effect.provide(CompressionOutputAdapter),
  Effect.provide(HashOutputAdapter),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
