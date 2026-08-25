import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveToken, resolveApi, DEFAULT_API } from "./config.js";

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
