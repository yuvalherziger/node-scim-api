# AGENTS.md

## API

- The backend is a TypeScript project under the src/ folder
- Always cover code with unit tests as much as possible. Tests are in the tests/ folder
- Write small, single-purpose functions.
- Don't be too verbose with your comments.
- Prefer double quotes over single quotes for strings.
- Use proper types.
- When repeating string constants (e.g., SCIM schemas) always use constants from the src/api/types.ts file, and add them if they're missing.
- When introducing new MongoDB queries, always leave a TODO comment to add an index.
- Pay close attention to security.
- The centralized logger is src/common/logger.ts. Use the logger liberally, and add logger.debug() calls when needed.
- When touching core SCIM functionality, refer to the SCIM protocol specifications at https://www.rfc-editor.org/rfc/rfc7644.html.
