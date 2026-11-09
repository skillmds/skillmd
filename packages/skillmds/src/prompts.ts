// The CLI's prompts in SkillMD's colours. A port of @clack/prompts 0.8.2
// (MIT, (c) Nate Moore; https://github.com/bombshell-dev/clack) on top of its
// own engine, @clack/core: same layout and keys, but the brand orange where
// clack hard-codes cyan, hints without brackets, a one-line key reminder under
// pickers, and spinners made from the logo's two squares. Success stays green,
// warnings yellow and errors red, so they still read at a glance.
//
// Only what the CLI uses is ported; the call signatures match clack's, so a
// command file switches by changing its import.
import { ConfirmPrompt, MultiSelectPrompt, PasswordPrompt, SelectPrompt, TextPrompt, block } from "@clack/core";
import type { State } from "@clack/core";
import pc from "picocolors";
import { ASCII_SPINNER, SPINNERS, orange, unicodeSupported } from "./brand.js";
import type { SpinnerKind } from "./brand.js";

export { isCancel } from "@clack/core";

const unicode = unicodeSupported();
const s = (c: string, fallback: string) => (unicode ? c : fallback);
const S_STEP_ACTIVE = s("◆", "*");
const S_STEP_CANCEL = s("■", "x");
const S_STEP_ERROR = s("▲", "x");
const S_STEP_SUBMIT = s("◇", "o");
const S_BAR_START = s("┌", "T");
const S_BAR = s("│", "|");
const S_BAR_END = s("└", "—");
const S_RADIO_ACTIVE = s("●", ">");
const S_RADIO_INACTIVE = s("○", " ");
const S_CHECKBOX_ACTIVE = s("◻", "[•]");
const S_CHECKBOX_SELECTED = s("◼", "[+]");
const S_CHECKBOX_INACTIVE = s("◻", "[ ]");
const S_PASSWORD_MASK = s("▪", "•");
const S_BAR_H = s("─", "-");
const S_CORNER_TOP_RIGHT = s("╮", "+");
const S_CONNECT_LEFT = s("├", "+");
const S_CORNER_BOTTOM_RIGHT = s("╯", "+");
const S_INFO = s("●", "•");
const S_SUCCESS = s("◆", "*");
const S_WARN = s("▲", "!");
const S_ERROR = s("■", "x");

const accent = (text: string) => orange(text);
const bar = pc.gray(S_BAR);

const symbol = (state: State) => {
  switch (state) {
    case "initial":
    case "active":
      return accent(S_STEP_ACTIVE);
    case "cancel":
      return pc.red(S_STEP_CANCEL);
    case "error":
      return pc.yellow(S_STEP_ERROR);
    case "submit":
      return accent(S_STEP_SUBMIT);
  }
};

// The launch logo stands in for clack's opening "┌" line, so the first prompt
// after it starts on its own ◆ instead of under a stray "│".
let skipLead = false;
/** The next prompt begins without its leading bar (it follows the logo). */
export function startFrameAfterLogo(): void { skipLead = true; }
const lead = (): string => {
  if (skipLead) { skipLead = false; return ""; }
  return `${bar}\n`;
};

const hint = (text?: string) => (text ? `  ${pc.dim(text)}` : "");
const keys = (text: string) => pc.dim(text);

/** clack's sliding window for long option lists. */
function limitOptions<T>(params: { options: T[]; maxItems: number | undefined; cursor: number; style: (option: T, active: boolean) => string }): string[] {
  const { cursor, options, style } = params;
  const outputMaxItems = Math.max((process.stdout.rows ?? 24) - 4, 0);
  const maxItems = Math.min(outputMaxItems, Math.max(params.maxItems ?? Infinity, 5));
  let window = 0;
  if (cursor >= window + maxItems - 3) window = Math.max(Math.min(cursor - maxItems + 3, options.length - maxItems), 0);
  else if (cursor < window + 2) window = Math.max(cursor - 2, 0);
  const topEllipsis = maxItems < options.length && window > 0;
  const bottomEllipsis = maxItems < options.length && window + maxItems < options.length;
  return options.slice(window, window + maxItems).map((option, i, arr) =>
    (i === 0 && topEllipsis) || (i === arr.length - 1 && bottomEllipsis)
      ? pc.dim("...")
      : style(option, i + window === cursor));
}

export interface TextOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  initialValue?: string;
  validate?: (value: string) => string | void;
}
export const text = (opts: TextOptions) => {
  const top = lead();
  return new TextPrompt({
    validate: opts.validate,
    placeholder: opts.placeholder,
    defaultValue: opts.defaultValue,
    initialValue: opts.initialValue,
    render() {
      const title = `${top}${symbol(this.state)}  ${opts.message}\n`;
      const placeholder = opts.placeholder
        ? pc.inverse(opts.placeholder[0]!) + pc.dim(opts.placeholder.slice(1))
        : pc.inverse(pc.hidden("_"));
      const value = !this.value ? placeholder : this.valueWithCursor;
      switch (this.state) {
        case "error":
          return `${title.trim()}\n${pc.yellow(S_BAR)}  ${value}\n${pc.yellow(S_BAR_END)}  ${pc.yellow(this.error)}\n`;
        case "submit":
          return `${title}${bar}  ${pc.dim(this.value || opts.placeholder || "")}`;
        case "cancel":
          return `${title}${bar}  ${pc.strikethrough(pc.dim(this.value ?? ""))}${this.value?.trim() ? `\n${bar}` : ""}`;
        default:
          return `${title}${bar}  ${value}\n${pc.gray(S_BAR_END)}\n`;
      }
    },
  }).prompt() as Promise<string | symbol>;
};

export interface PasswordOptions {
  message: string;
  mask?: string;
  validate?: (value: string) => string | void;
}
export const password = (opts: PasswordOptions) => {
  const top = lead();
  return new PasswordPrompt({
    validate: opts.validate,
    mask: opts.mask ?? S_PASSWORD_MASK,
    render() {
      const title = `${top}${symbol(this.state)}  ${opts.message}\n`;
      const masked = this.masked;
      switch (this.state) {
        case "error":
          return `${title.trim()}\n${pc.yellow(S_BAR)}  ${masked}\n${pc.yellow(S_BAR_END)}  ${pc.yellow(this.error)}\n`;
        case "submit":
          return `${title}${bar}  ${pc.dim(masked)}`;
        case "cancel":
          return `${title}${bar}  ${pc.strikethrough(pc.dim(masked ?? ""))}${masked ? `\n${bar}` : ""}`;
        default:
          return `${title}${bar}  ${this.valueWithCursor}\n${pc.gray(S_BAR_END)}\n`;
      }
    },
  }).prompt() as Promise<string | symbol>;
};

export interface ConfirmOptions {
  message: string;
  active?: string;
  inactive?: string;
  initialValue?: boolean;
}
export const confirm = (opts: ConfirmOptions) => {
  const active = opts.active ?? "Yes";
  const inactive = opts.inactive ?? "No";
  const top = lead();
  return new ConfirmPrompt({
    active,
    inactive,
    initialValue: opts.initialValue ?? true,
    render() {
      const title = `${top}${symbol(this.state)}  ${opts.message}\n`;
      const value = this.value ? active : inactive;
      switch (this.state) {
        case "submit":
          return `${title}${bar}  ${pc.dim(value)}`;
        case "cancel":
          return `${title}${bar}  ${pc.strikethrough(pc.dim(value))}\n${bar}`;
        default: {
          const on = (label: string) => `${accent(S_RADIO_ACTIVE)} ${label}`;
          const off = (label: string) => `${pc.dim(S_RADIO_INACTIVE)} ${pc.dim(label)}`;
          return `${title}${bar}  ${this.value ? on(active) : off(active)} ${pc.dim("/")} ${!this.value ? on(inactive) : off(inactive)}\n${pc.gray(S_BAR_END)}\n`;
        }
      }
    },
  }).prompt() as Promise<boolean | symbol>;
};

type Primitive = Readonly<string | boolean | number>;
type Option<Value> = Value extends Primitive
  ? { value: Value; label?: string; hint?: string }
  : { value: Value; label: string; hint?: string };

export interface SelectOptions<Value> {
  message: string;
  options: Option<Value>[];
  initialValue?: Value;
  maxItems?: number;
}
export const select = <Value>(opts: SelectOptions<Value>) => {
  const opt = (option: Option<Value>, state: "inactive" | "active" | "selected" | "cancelled") => {
    const label = option.label ?? String(option.value);
    switch (state) {
      case "selected": return pc.dim(label);
      case "active": return `${accent(S_RADIO_ACTIVE)} ${label}${hint(option.hint)}`;
      case "cancelled": return pc.strikethrough(pc.dim(label));
      default: return `${pc.dim(S_RADIO_INACTIVE)} ${pc.dim(label)}`;
    }
  };
  const top = lead();
  return new SelectPrompt({
    options: opts.options,
    initialValue: opts.initialValue,
    render() {
      const title = `${top}${symbol(this.state)}  ${opts.message}\n`;
      switch (this.state) {
        case "submit":
          return `${title}${bar}  ${opt(this.options[this.cursor]!, "selected")}`;
        case "cancel":
          return `${title}${bar}  ${opt(this.options[this.cursor]!, "cancelled")}\n${bar}`;
        default:
          return `${title}${bar}  ${limitOptions({
            cursor: this.cursor,
            options: this.options,
            maxItems: opts.maxItems,
            style: (item, isActive) => opt(item, isActive ? "active" : "inactive"),
          }).join(`\n${bar}  `)}\n${pc.gray(S_BAR_END)}  ${keys("↑/↓ to move · enter to choose")}\n`;
      }
    },
  }).prompt() as Promise<Value | symbol>;
};

export interface MultiSelectOptions<Value> {
  message: string;
  options: Option<Value>[];
  initialValues?: Value[];
  maxItems?: number;
  required?: boolean;
  cursorAt?: Value;
}
export const multiselect = <Value>(opts: MultiSelectOptions<Value>) => {
  const opt = (option: Option<Value>, state: "inactive" | "active" | "selected" | "active-selected" | "submitted" | "cancelled") => {
    const label = option.label ?? String(option.value);
    switch (state) {
      case "active": return `${accent(S_CHECKBOX_ACTIVE)} ${label}${hint(option.hint)}`;
      case "selected": return `${accent(S_CHECKBOX_SELECTED)} ${pc.dim(label)}`;
      case "cancelled": return pc.strikethrough(pc.dim(label));
      case "active-selected": return `${accent(S_CHECKBOX_SELECTED)} ${label}${hint(option.hint)}`;
      case "submitted": return pc.dim(label);
      default: return `${pc.dim(S_CHECKBOX_INACTIVE)} ${pc.dim(label)}`;
    }
  };
  const top = lead();
  return new MultiSelectPrompt({
    options: opts.options,
    initialValues: opts.initialValues,
    required: opts.required ?? true,
    cursorAt: opts.cursorAt,
    validate(selected: Value[]) {
      if (this.required && selected.length === 0) {
        return `Please select at least one option.\n${pc.reset(pc.dim("Press space to select, enter to confirm"))}`;
      }
    },
    render() {
      const title = `${top}${symbol(this.state)}  ${opts.message}\n`;
      const styleOption = (option: Option<Value>, isActive: boolean) => {
        const selected = this.value.includes(option.value);
        if (isActive && selected) return opt(option, "active-selected");
        if (selected) return opt(option, "selected");
        return opt(option, isActive ? "active" : "inactive");
      };
      const list = (edge: string) => limitOptions({
        options: this.options,
        cursor: this.cursor,
        maxItems: opts.maxItems,
        style: styleOption,
      }).join(`\n${edge}  `);
      switch (this.state) {
        case "submit":
          return `${title}${bar}  ${this.options.filter(({ value }) => this.value.includes(value)).map((o) => opt(o, "submitted")).join(pc.dim(", ")) || pc.dim("none")}`;
        case "cancel": {
          const label = this.options.filter(({ value }) => this.value.includes(value)).map((o) => opt(o, "cancelled")).join(pc.dim(", "));
          return `${title}${bar}  ${label.trim() ? `${label}\n${bar}` : ""}`;
        }
        case "error": {
          const footer = this.error.split("\n").map((ln, i) => (i === 0 ? `${pc.yellow(S_BAR_END)}  ${pc.yellow(ln)}` : `   ${ln}`)).join("\n");
          return `${title}${pc.yellow(S_BAR)}  ${list(pc.yellow(S_BAR))}\n${footer}\n`;
        }
        default:
          return `${title}${bar}  ${list(bar)}\n${pc.gray(S_BAR_END)}  ${keys("space to select · enter to confirm")}\n`;
      }
    },
  }).prompt() as Promise<Value[] | symbol>;
};

const strip = (str: string) => str.replace(ansiRegex(), "");
export const note = (message = "", title = "") => {
  const lines = `\n${message}\n`.split("\n");
  const titleLen = strip(title).length;
  const len = Math.max(lines.reduce((max, ln) => Math.max(max, strip(ln).length), 0), titleLen) + 2;
  const msg = lines.map((ln) => `${bar}  ${pc.dim(ln)}${" ".repeat(len - strip(ln).length)}${bar}`).join("\n");
  process.stdout.write(
    `${lead()}${accent(S_STEP_SUBMIT)}  ${pc.reset(title)} ${pc.gray(S_BAR_H.repeat(Math.max(len - titleLen - 1, 1)) + S_CORNER_TOP_RIGHT)}\n${msg}\n${pc.gray(S_CONNECT_LEFT + S_BAR_H.repeat(len + 2) + S_CORNER_BOTTOM_RIGHT)}\n`,
  );
};

export const cancel = (message = "") => {
  process.stdout.write(`${pc.gray(S_BAR_END)}  ${pc.red(message)}\n\n`);
};

export const intro = (title = "") => {
  skipLead = false;
  process.stdout.write(`${pc.gray(S_BAR_START)}  ${title}\n`);
};

export const outro = (message = "") => {
  process.stdout.write(`${bar}\n${pc.gray(S_BAR_END)}  ${message}\n\n`);
};

export const log = {
  message: (message = "", { symbol: mark = bar }: { symbol?: string } = {}) => {
    const top = lead().replace(/\n$/, "");
    const parts = top ? [top] : [];
    if (message) {
      const [first, ...rest] = message.split("\n");
      parts.push(`${mark}  ${first}`, ...rest.map((ln) => `${bar}  ${ln}`));
    }
    process.stdout.write(`${parts.join("\n")}\n`);
  },
  info: (message: string) => log.message(message, { symbol: accent(S_INFO) }),
  success: (message: string) => log.message(message, { symbol: pc.green(S_SUCCESS) }),
  step: (message: string) => log.message(message, { symbol: accent(S_STEP_SUBMIT) }),
  warn: (message: string) => log.message(message, { symbol: pc.yellow(S_WARN) }),
  warning: (message: string) => log.warn(message),
  error: (message: string) => log.message(message, { symbol: pc.red(S_ERROR) }),
};

/** A loading line inside the frame, animated with the logo's two squares
 *  (see SPINNERS in brand.ts for which kind fits which wait). */
export const spinner = (kind: SpinnerKind = "drop") => {
  const { frames, interval } = unicode ? SPINNERS[kind] : ASCII_SPINNER;
  let unblock: () => void = () => {};
  let loop: ReturnType<typeof setInterval> | undefined;
  let active = false;
  let message = "";

  const handleExit = (code: number) => {
    if (active) stop(code > 1 ? "Something went wrong" : "Canceled", code);
  };
  const onError = () => handleExit(2);
  const onSignal = () => handleExit(1);
  const registerHooks = () => {
    process.on("uncaughtExceptionMonitor", onError);
    process.on("unhandledRejection", onError);
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    process.on("exit", handleExit);
  };
  const clearHooks = () => {
    process.removeListener("uncaughtExceptionMonitor", onError);
    process.removeListener("unhandledRejection", onError);
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    process.removeListener("exit", handleExit);
  };

  const start = (msg = ""): void => {
    active = true;
    unblock = block();
    message = msg.replace(/[.…]+$/, "");
    process.stdout.write(lead());
    let i = 0;
    const draw = () => {
      process.stdout.write(`\r\x1b[J${accent(frames[i]!)} ${message}…`);
      i = (i + 1) % frames.length;
    };
    process.stdout.write("\x1b[?25l");
    registerHooks();
    draw();
    loop = setInterval(draw, interval);
  };

  const stop = (msg = "", code = 0): void => {
    message = msg || message;
    active = false;
    if (loop) clearInterval(loop);
    const mark = code === 0 ? pc.green(S_STEP_SUBMIT) : code === 1 ? pc.red(S_STEP_CANCEL) : pc.red(S_STEP_ERROR);
    process.stdout.write(`\r\x1b[J${mark}  ${message}\n\x1b[?25h`);
    clearHooks();
    unblock();
  };

  return { start, stop, message: (msg = "") => { message = msg || message; } };
};

// Adapted from https://github.com/chalk/ansi-regex (MIT)
function ansiRegex() {
  const pattern = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join("|");
  return new RegExp(pattern, "g");
}
