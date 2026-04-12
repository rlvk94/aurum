/**
 * Type-only re-export of the AppRouter type.
 *
 * This file exists so that client code (src/trpc/react.tsx) can import the
 * AppRouter type without Turbopack tracing into the server-only modules
 * that root.ts depends on (db, auth, postgres).
 */
export type { AppRouter } from "./root";
