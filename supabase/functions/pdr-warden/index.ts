import {createHandler} from './handler.mjs';

// Guest castle, matching the existing PDT/PDQ/PDO conventions. No browser secrets.
// Distributed database quota and an explicit origin allowlist protect paid calls.
Deno.serve(createHandler(Deno.env.toObject()));
