## Learned User Preferences

- Use hexagonal architecture (ports and adapters) consistently throughout the project
- Ports define interfaces only and must not import implementation details; adapters implement the logic
- Define the service shape as its own exported type in the port file, not inline in `ServiceMap.Service`
- Use `Effect.fn("name")` for functions returning Effects; avoid wrapping `Effect.gen` in plain functions
- Use `Schema.TaggedErrorClass` for domain errors with `message: Schema.String` and `cause: Schema.Defect`
- Prefer `Schema.decodeTo` with `SchemaGetter.transform` for deriving fields from other fields, over class getters
- Prefer `Schema.decodeUnknownEffect` (yielded) over `Schema.decodeUnknownSync` to keep errors in the Effect channel
- Service methods return structured data; the command/CLI layer decides how to format output based on flags
- Implement plans as written; do not edit the plan file during execution
- Remove debug instrumentation after fixes are done

## Learned Workspace Facts

- Project layout: `app/ports/` for interfaces, `app/adapters/` for implementations, `app/domain/` for domain logic, `app/main.ts` as composition root
- Uses Effect v4 (beta) with Bun as the runtime
- In Effect v4, use `Schema.Literals([...])` for unions of literal values (not multi-arg `Schema.Literal`)
- Node.js `crypto` and `zlib` are used for hashing and compression, wrapped in Effect adapters
