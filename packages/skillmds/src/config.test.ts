import { describe, it, expect } from "vitest";
import { resolveToken, resolveApi, telemetryDisabled, DEFAULT_API } from "./config.js";

// Every resolution below passes an explicit ResolveSources. Nothing here may
// read the developer's real process.env or ~/.skillmd/config.json — a machine
// with a stored token or a local api base must not change a single result.

describe("resolveToken", () => {
  it("reads from env when no flag", () => {
    expect(resolveToken({}, { env: { SKILLMD_TOKEN: "abc" }, config: {} })).toBe("abc");
  });
  it("flag overrides env", () => {
    expect(resolveToken({ token: "flag" }, { env: { SKILLMD_TOKEN: "abc" }, config: {} })).toBe("flag");
  });
  it("is undefined when nothing supplies one", () => {
    expect(resolveToken({}, { env: {}, config: {} })).toBeUndefined();
  });
});

describe("resolveApi", () => {
  it("defaults to the production base", () => {
    expect(resolveApi({}, { env: {}, config: {} })).toBe(DEFAULT_API);
  });
  it("env overrides default, flag overrides env", () => {
    expect(resolveApi({}, { env: { SKILLMD_API: "https://env.example" }, config: {} })).toBe("https://env.example");
    expect(resolveApi({ api: "https://flag.example" }, { env: { SKILLMD_API: "https://env.example" }, config: {} })).toBe("https://flag.example");
  });
  it("config.api sits below env and above the default", () => {
    const config = { api: "https://cfg.example" };
    expect(resolveApi({}, { env: {}, config })).toBe("https://cfg.example");
    expect(resolveApi({}, { env: { SKILLMD_API: "https://env.example" }, config })).toBe("https://env.example");
  });
});

describe("token host binding", () => {
  it("returns the stored token only for the host it was saved for", () => {
    const cfg = { token: "sk_1", api: "https://api.skillmd.com", tokenHost: "api.skillmd.com" };
    expect(resolveToken({}, { env: {}, config: cfg })).toBe("sk_1");
    expect(resolveToken({ api: "https://evil.example" }, { env: {}, config: cfg })).toBeUndefined();
  });
  it("a token without a recorded host (pre-1.2 config) is bound to the default host", () => {
    const cfg = { token: "sk_old" };
    expect(resolveToken({}, { env: {}, config: cfg })).toBe("sk_old");
    expect(resolveToken({ api: "https://staging.example" }, { env: {}, config: cfg })).toBeUndefined();
  });
  it("--token and SKILLMD_TOKEN are explicit and always sent", () => {
    expect(resolveToken({ token: "flag", api: "https://x.example" }, { env: {}, config: {} })).toBe("flag");
    expect(resolveToken({ api: "https://x.example" }, { env: { SKILLMD_TOKEN: "env" }, config: {} })).toBe("env");
  });
});

describe("resolveApi https-only", () => {
  it("rejects http bases unless --insecure-http", () => {
    expect(() => resolveApi({ api: "http://localhost:8787" }, { env: {}, config: {} })).toThrow(/https/);
    expect(resolveApi({ api: "http://localhost:8787", insecureHttp: true }, { env: {}, config: {} })).toBe("http://localhost:8787");
    expect(resolveApi({}, { env: {}, config: {} })).toBe(DEFAULT_API);
  });
  it("rejects an http base whatever its case", () => {
    expect(() => resolveApi({ api: "HTTP://localhost:8787" }, { env: {}, config: {} })).toThrow(/https/);
    expect(() => resolveApi({}, { env: { SKILLMD_API: "Http://localhost:8787" }, config: {} })).toThrow(/https/);
    expect(() => resolveApi({}, { env: {}, config: { api: "hTTp://localhost:8787" } })).toThrow(/https/);
  });
});

describe("telemetryDisabled", () => {
  it("honours SKILLMD_NO_TELEMETRY and DO_NOT_TRACK", () => {
    expect(telemetryDisabled({})).toBe(false);
    expect(telemetryDisabled({ SKILLMD_NO_TELEMETRY: "1" })).toBe(true);
    expect(telemetryDisabled({ DO_NOT_TRACK: "1" })).toBe(true);
    expect(telemetryDisabled({ DO_NOT_TRACK: "0" })).toBe(false);
  });
});
