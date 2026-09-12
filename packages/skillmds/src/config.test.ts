import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveToken, resolveApi, telemetryDisabled, DEFAULT_API } from "./config.js";

describe("resolveToken", () => {
  const orig = process.env.SKILLMD_TOKEN;
  beforeEach(() => { delete process.env.SKILLMD_TOKEN; });
  afterEach(() => { if (orig === undefined) delete process.env.SKILLMD_TOKEN; else process.env.SKILLMD_TOKEN = orig; });

  it("reads from env when no flag", () => {
    process.env.SKILLMD_TOKEN = "abc";
    expect(resolveToken({})).toBe("abc");
  });
  it("flag overrides env", () => {
    process.env.SKILLMD_TOKEN = "abc";
    expect(resolveToken({ token: "flag" })).toBe("flag");
  });
});

describe("resolveApi", () => {
  const orig = process.env.SKILLMD_API;
  beforeEach(() => { delete process.env.SKILLMD_API; });
  afterEach(() => { if (orig === undefined) delete process.env.SKILLMD_API; else process.env.SKILLMD_API = orig; });

  it("defaults to the production base", () => {
    expect(resolveApi({})).toBe(DEFAULT_API);
  });
  it("env overrides default, flag overrides env", () => {
    process.env.SKILLMD_API = "https://env.example";
    expect(resolveApi({})).toBe("https://env.example");
    expect(resolveApi({ api: "https://flag.example" })).toBe("https://flag.example");
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
});

describe("telemetryDisabled", () => {
  it("honours SKILLMD_NO_TELEMETRY and DO_NOT_TRACK", () => {
    expect(telemetryDisabled({})).toBe(false);
    expect(telemetryDisabled({ SKILLMD_NO_TELEMETRY: "1" })).toBe(true);
    expect(telemetryDisabled({ DO_NOT_TRACK: "1" })).toBe(true);
    expect(telemetryDisabled({ DO_NOT_TRACK: "0" })).toBe(false);
  });
});
