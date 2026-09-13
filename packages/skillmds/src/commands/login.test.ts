import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLogin, runLogout } from "./login.js";
import { readConfig } from "../config.js";

const tmps: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "skillmd-login-")); tmps.push(d); return d; };
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("runLogin", () => {
  it("stores the token bound to the API host", async () => {
    const home = tmp();
    const r = await runLogin({ token: "sk_x", api: "https://staging.skillmd.com", home, env: {} }, {});
    expect(r.exitCode).toBe(0);
    expect(readConfig(home)).toMatchObject({ token: "sk_x", api: "https://staging.skillmd.com", tokenHost: "staging.skillmd.com" });
  });
  it("binds to SKILLMD_API when set and no --api is given", async () => {
    const home = tmp();
    await runLogin({ token: "sk_x", home, env: { SKILLMD_API: "https://alt.example" } }, {});
    expect(readConfig(home).tokenHost).toBe("alt.example");
  });
  it("prompts when interactive, exits 1 with a hint when it cannot", async () => {
    const home = tmp();
    const ok = await runLogin({ home, env: {} }, { prompt: async () => "sk_p" });
    expect(ok.exitCode).toBe(0);
    expect(readConfig(home).token).toBe("sk_p");
    const no = await runLogin({ home: tmp(), env: {} }, {});
    expect(no.exitCode).toBe(1);
    expect(no.output).toMatch(/--token|SKILLMD_TOKEN/);
  });
  it("refuses an http base at login time", async () => {
    const r = await runLogin({ token: "sk_x", api: "http://localhost:8787", home: tmp(), env: {} }, {});
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/https/);
  });
  it("--json returns a document", async () => {
    const home = tmp();
    const r = await runLogin({ token: "sk_x", home, env: {}, json: true }, {});
    expect(JSON.parse(r.output)).toMatchObject({ ok: true, host: "api.skillmd.com" });
  });
  it("logout removes token and host; exit 0 even when nothing was stored", () => {
    const home = tmp();
    expect(runLogout({ home }).exitCode).toBe(0);
    expect(runLogout({ home, json: true }).output).toContain('"removed": false');
  });
});
