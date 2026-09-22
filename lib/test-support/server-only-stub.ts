// Vitest runs under plain Node, which resolves the real "server-only" package's default
// export (it only no-ops under Next's "react-server" bundler condition, which Vitest doesn't
// apply) and that default export unconditionally throws. vitest.config.ts aliases "server-only"
// to this empty file so files carrying that marker can still be unit-tested directly.
export {};
