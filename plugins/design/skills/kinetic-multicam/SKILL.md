---
name: kinetic-multicam
description: Use when the user drops or points at a local talking-head video and wants the kinetic supers + rapid camera reposition prompt for video-to-video AI (one real take turned into split-second camera snaps that lock off, with bold motion-graphics text synced to the speech). Triggers on /kinetic-multicam, "kinetic supers", "kinetic typography video", a dropped .mp4 plus a motion-graphics-text + camera request. PT examples for reliability, "faz o prompt de kinetic supers desse vídeo", "gera supers cinéticos com cortes de câmera", "bota motion graphics e câmera nesse take".
---


# /kinetic-multicam: One Take → Kinetic Supers + Camera Snaps

## Overview

Turns ONE real talking-head take into the proven video-to-video prompt — best on **Seedance 2.0 Fast** (Google Omni runs it but with clearly weaker results; don't recommend it) — that adds two things to the untouched footage: split-second visible camera whips — motion-blurred moves that lock into stable frames on arrival — and bold kinetic supers (motion-graphics text, NOT captions) synced to the speech beats. The prompt **preserves the uploaded source video** — face, room, audio, lip sync all frozen. It does NOT describe or regenerate the scene.

Core principle: **the template is frozen; only three zones ever change** — the `[Xs]` timestamps (always), the `"[TEXT]"` supers (cut from the words actually spoken; not every block gets one — supers follow their own density rule), and the camera position descriptions (only if the user asks).

Sibling skill, not the same skill: `/multicam` does hard cuts with no text. NEVER mix the two templates — this one never says "hard cut", uses `From [Xs] to [Xs]` ranges (not `* At [Xs]:`), and carries its own typography direction. The transition itself is the differential: `/multicam` CUTS between angles; this skill TRAVELS between them with a visible motion-blurred whip.

## Input

Local video file only (the user's own footage). If the user only has a URL (an Instagram link, a Drive link), ask them to save the video as a local file first. If more than one video could be "the video", ask — never guess via `ls -t`.

## Step 0 — Preflight (first run, or on any missing-tool error)

```bash
python "<this skill's base directory>/scripts/check_env.py"
```

It verifies Python 3.8+, ffmpeg, ffprobe and Whisper, and for anything missing it prints what the tool is FOR plus the exact install command for the user's OS. It never installs anything itself — relay what is missing, ask the user for permission, install, then re-run the check. If everything passed recently in this session, skip straight to Step 1.

## Step 1 — Beats

```bash
python "<this skill's base directory>/scripts/beats.py" "<video path>"
```

(The skill's base directory is announced when this skill loads.)

Report the detected `LANGUAGE` and `DURATION` to the user. Flags: `--language <code>` if detection looks wrong, `--force` to retranscribe, `--model medium` for accuracy over speed, `--cuts N` for a different boundary count (rerunning is instant once the transcription JSON exists).

## Step 2 — Pick the block count, then refine the boundaries (judgment; the script only reports facts)

Block count scales with length — but whips cost screen time (~0.2–0.3s of visible travel each), so kinetic density stays at or BELOW `/multicam`'s cut density, never above: ≤10s → 4 blocks; >10–15s → 5 blocks; >15s → 6 blocks (a camera move every ~1.6–2.2s). The user can override at the checkpoint. If the count is not 4, rerun beats.py with `--cuts N` (instant — the transcription is cached).

The timeline is N blocks tiling the video after an opening hold on the original camera: `[0 → t1]` original framing (no super), then `[t1 → t2]` … `[tN → end]`. The boundaries t1–tN are the `NAIVE_CUTS` — a deterministic first guess, **never deliver it unrefined**. Group `WORDS` into spoken phrases and re-derive:

- Opening hold (original camera) lasts ≥0.8s before block 1 starts — and not much more: if a clean phrase boundary sits at 0.8–1.0s, snap there instead of letting the opening drag past ~1.2s. A long static open kills the format. The hold may carry the optional hook super (see checkpoint), but never a camera move.
- Boundaries land at phrase starts, never mid-word. Whisper may split hyphenated words into two entries ("multi" + "-angle") — treat them as ONE word; never cut between them.
- When a `GAPS` entry (breath/silence) sits next to a phrase boundary, place the boundary at the START of the silence: round the previous word's end up to one decimal (word ends 3.98 → boundary at 4.0; ends 5.68 → 5.7). Never at the end of the gap.
- The key-message phrase gets the longest block.
- Pacing: blocks run ~1–2.5s. If a block would exceed ~2.5s while a clean phrase boundary sits inside it, split there — and spread the 4 boundaries across the whole video, never bunched into one stretch.
- The LAST block always snaps back to the original camera before the final phrase — the video closes on the opening framing. Its end timestamp is `DURATION` rounded to one decimal.
- Min spacing ~0.7s; tN ≤ duration − 1s; timestamps ascending, one decimal.
- Video >15s: warn that the technique shines on short hooks, then pick the blocks that cover the whole arc. Video <4s: warn that 4 blocks don't fit the spacing rules, present honest options (fewer blocks / forced-frenetic 4) at the checkpoint — the user's choice there overrides the default count. `NO_SPEECH`: warn and offer the evenly spaced fallback or abort.

## Step 2b — Write the supers (from the speech — not every block gets one)

Supers have their own density rule, independent of the camera's: **one super every ~1.5–2s** (5s take → 3 supers; 8s → 4–5), and a super must EARN its stamp — the CTA, the offer's nouns, a kept negation, the payoff. Connective or filler phrases ("you can", "so", "and then") get NO super: their block becomes camera-only (see the template section). The hook super, when opted in, counts toward the total.

For each block that earns one, cut the super from the words ACTUALLY SPOKEN inside that block's window in `WORDS`:

- A contiguous run of 2–6 spoken words — and prefer the TIGHTEST crop that keeps the meaning (2–4 words): drop leading/trailing articles, prepositions and filler aggressively ("the easiest way" → EASIEST WAY, "from a single video" → SINGLE VIDEO). Keep negations — dropping "don't" inverts the message. Never reorder, substitute, translate, or add words that are not in that window.
- Language = the video's spoken language (PT video → PT supers). Only the supers follow the video language; everything else in the prompt is English.
- Deliver in ALL CAPS. Strip commas and final periods; keep "?" or "!" if spoken that way.
- A super is a punchy callout, not a caption: never a full subtitle-style sentence, and at most one super per block — no per-word entrance timings, no animation scripting. The template's typography paragraph already carries the art direction.

## Step 3 — Present, then MANDATORY checkpoint

Show the user, in this order:
1. Two lines on how it works: the prompt freezes identity/room/audio/lip-sync; the only additions are split-second motion-blurred camera whips that lock off and kinetic supers cut from their own spoken words — that's why it looks like a premium motion-graphics edit of the same real take.
2. Phrase table with time windows.
3. The suggested blocks, each justified (which phrase it covers; which boundaries land in breaths) — plus the proposed super for each block, or "camera-only" where the density rule leaves the screen clean.
4. The template below, still with `[Xs]` and `[TEXT]`.

Then ask (AskUserQuestion; plain chat questions if unavailable) **before filling anything**:
- Accept the block count and the suggested timestamps, or adjust?
- Accept the super plan — the texts AND which blocks stay camera-only — or edit any (different crop, different casing, super added/removed)?
- Keep the default camera positions, or swap any (offer the presets table)?
- Add the optional hook super over the opening hold (frame-1 text, camera stays still)? Default OFF.
- Only when the density rule merged away a valuable super: offer the static-super block as an alternative to losing it.

Never skip this checkpoint, even if the user seems in a hurry or the beats look obvious.

## Step 4 — Fill and deliver

Mutate ONLY:
- the `[Xs]` timestamps — replace just the `X`: `[Xs]` becomes `[0.8s]`. The square brackets STAY: `From [0.8s] to [2.1s]` is correct, `From 0.8s to 2.1s` is wrong. Adjacent blocks share the boundary (block 1 ends at 2.1 → block 2 starts at 2.1); the last block ends at the video duration.
- the `[TEXT]` tokens — replace the whole token (brackets included) with the super, KEEPING the surrounding quotes: `"[TEXT]"` becomes `"UPLOAD YOUR VIDEO"`. `"[UPLOAD YOUR VIDEO]"` (brackets kept) is wrong.
- any camera position description the user asked to swap (presets below).

Save it as `<video basename>_kinetic_multicam_prompt.txt` next to the video, then self-check the saved file:

```bash
python "<this skill's base directory>/scripts/verify_prompt.py" "<saved .txt>"
```

It must print `PASS` (head/tail byte-identical to the template, every block well-formed, positions from the canonical menu, boundaries chained, last block back to the original camera). On `FAIL`, fix and re-run before delivering.

Deliver the finished prompt in a fenced code block. Close with usage: upload the source video into **Seedance 2.0 Fast** — the platform this template is validated on (2026-07; Omni tested worse, don't suggest it) — select it as the source footage, paste the prompt. The delivered prompt body is ALWAYS in English, whatever language the conversation or the video is in — only the supers follow the video's language.

## The canonical template (FROZEN)

Reproduce byte-for-byte — line breaks included. Quirks are intentional ("The Supers" capitalization, "same as original video"). If it reads odd, it stays.

```
Use the uploaded video as the source. The Supers must follow the pace of the audio.
Video timing must be exactly the same as original video.

Preserve the person's face, identity, expression, clothing, body proportions, and lip sync exactly as in the original footage. Preserve the room, lighting, furniture, background, and overall environment. Do not replace, redesign, or hallucinate any part of the scene.

The only changes should be rapid cinematic camera repositioning and the addition of kinetic motion graphics.

Do not add traditional subtitles. Instead, create bold, high-energy kinetic supers that visually reinforce the spoken message. The supers should behave like motion graphics, not captions. Use dynamic typography, scaling, rotation, perspective, masking, tracking, and creative layouts. Vary the style throughout the video so each callout feels intentional and visually engaging. The text must never cover the speaker's face. Place each super in open areas of the frame, or layer it behind the speaker's body so the person partially occludes the text — as if the words physically exist in the room behind them. The text should integrate naturally with the composition.

Camera movement should be extremely fast. Each transition should take only a split second, rapidly snapping to the new viewpoint before immediately locking into a perfectly stable frame. The camera must visibly travel to each new position — a fast, motion-blurred whip move with a speed-ramp feel — never an editing cut and never an invisible instant jump between angles. Do not create long continuous camera moves, floating movement, or handheld motion. Every move should feel like a fast cinematic reposition followed by a freeze.

Follow this timeline:

From [Xs] to [Xs]
Display the kinetic super:
"[TEXT]"
Whip the camera in a fast motion-blurred orbital sweep to the left, landing in a left orbit position, then hold completely still.

From [Xs] to [Xs]
Display the kinetic super:
"[TEXT]"
Whip the camera upward in a fast motion-blurred crane rise to a higher crane angle, then hold completely still.

From [Xs] to [Xs]
Display the kinetic super:
"[TEXT]"
Whip the camera backward in a fast motion-blurred pull-out to a wide position revealing the full room with the speaker centered, then hold completely still.

From [Xs] to [Xs]
Display the kinetic super:
"[TEXT]"
Whip the camera in a fast motion-blurred sweep back to the original camera position and hold until the end.

Important requirements:

* Maintain the exact room and person throughout.
* Do not change facial features, clothing, lighting, or background.
* Preserve perfect lip sync.
* No hard cuts to different scenes.
* Every transition is a visible, motion-blurred camera move — never an editing cut.
* No title cards.
* No subtitle-style captions.
* Supers never cover the speaker's face — open frame areas or layered behind the body, never over it.
* Only rapid split-second camera repositioning followed by locked-off shots.
* Motion graphics should feel premium, modern, energetic, and social-media optimized.
```

The fence shows the 4-block default. For 5 or 6 blocks, insert extra blocks with the same frozen 4-line unit — `From [Xs] to [Xs]` / `Display the kinetic super:` / `"[TEXT]"` / one position line taken VERBATIM from the presets table — separated by blank lines, keeping the back-to-original block last. Default position sequences:

- 4 blocks: left orbit → higher crane → wide (room reveal) → back to original
- 5 blocks: tight close-up → left orbit → higher crane → wide → back to original
- 6 blocks: tight close-up → left orbit → higher crane → right orbit → wide → back to original

**Semantic matching beats the default order.** Before settling, scan each block's phrase for meaning that maps to a position — revelation/space/"no setup" → wide; intimacy/secret → tight close-up; power/challenge → low hero; overview/list → top-down; key detail → punch-in close-up. When a phrase matches, give that block the matching position (still respecting the contrast rule) and justify the pick at the checkpoint — "DON'T HAVE A FULL SETUP" on the wide room reveal is the canonical example.

### Optional hook super (opt-in at the checkpoint)

By default the opening hold carries no text. If the user opts in, insert ONE extra block at the very top of the timeline — from `[0s]` to t1, camera NOT moving; it exists only to put a hook super on frame 1:

```
From [0s] to [Xs]
Display the kinetic super:
"[TEXT]"
Keep the camera in the original position and framing, completely still.
```

Its super follows the same Step 2b rules, cropped from the words spoken inside the opening hold. Never add it without the user opting in.

### Optional static-super block (opt-in)

When the density rule forces a merge that would drop a valuable super, ONE mid-timeline block may hold the camera and change only the text:

```
From [Xs] to [Xs]
Display the kinetic super:
"[TEXT]"
Keep the camera locked in the same position, completely still.
```

Rules: maximum ONE per timeline; never the first block (nothing to hold from — the `[0s]` hook has its own line) and never adjacent to the hook — a whip must land before it and another must follow it. It does not count as a camera move for the density rule, and the contrast rule does not apply (it is the absence of a move). Offer it at the checkpoint only when a merge would sacrifice a super worth keeping. Status: production-validated (2026-07) — the camera holds correctly while the super changes, confirmed on a real generation alongside the face-protection + behind-the-body typography rules.

### Camera-only block (no super)

When the super density rule leaves a block without text, drop the two super lines entirely — the block is just the range plus the whip:

```
From [Xs] to [Xs]
Whip the camera ... (position line, VERBATIM from the template or the presets table)
```

The whip still marks the rhythm; the screen rests. Any block can be camera-only — including the final back-to-original one — EXCEPT the `[0s]` hook and the static-super block (both exist only to show text; without a super they are dead air and must be dropped instead).

## Camera position presets (offered at the checkpoint)

Each position is reached by a fast, visible, motion-blurred whip move that locks frozen on arrival. The template forbids long floating moves and handheld — and equally forbids invisible cut-like transitions. Every position line must describe BOTH the travel (whip / sweep / rise / drop / punch-in / pull-out / roll) AND the locked end position.

**Contrast rule:** every position must differ from the source framing AND from its two neighbors in axis (left/right/high/low) or scale (close/wide). A near-centered, eye-level position anywhere except the original camera reads as "no cut at all" in the generation.

| Preset | Template-ready wording |
|---|---|
| Right orbit | `Whip the camera in a fast motion-blurred orbital sweep to the right, landing in a right orbit position, then hold completely still.` |
| Low hero angle | `Whip the camera in a fast motion-blurred drop to a low angle position looking slightly up at the speaker, then hold completely still.` |
| Top-down overhead | `Whip the camera in a fast motion-blurred rise to a top-down overhead position looking down at the speaker, then hold completely still.` |
| Tight close-up | `Whip the camera forward in a fast motion-blurred punch-in to a tight close-up framing on the speaker's face, then hold completely still.` |
| Wide (room reveal) | `Whip the camera backward in a fast motion-blurred pull-out to a wide position revealing the full room with the speaker centered, then hold completely still.` |
| Dutch tilt | `Whip the camera in a fast motion-blurred roll into a subtly tilted dutch angle position, then hold completely still.` |
| Lower orbit centered — RETIRED default | `Whip the camera in a fast motion-blurred sweep down into a lower orbit ending in a centered composition, then hold completely still.` — avoid: low + centered ≈ the source framing, generations show almost no visible change. Only usable sandwiched between two extreme positions. |

## Do NOT (observed failure modes this skill exists to prevent)

- Do NOT write a generative scene-description prompt — character sheet, setting paragraph, dialogue transcript, "CAM A/B/C" shot lists. That recreates the scene from text and guarantees identity drift. The template preserves the uploaded take; the source video carries the scene.
- Do NOT paste the spoken line into the prompt ("The person speaks: ..."). The audio is in the source video; a transcript in the prompt invites regeneration.
- Do NOT borrow `/multicam`'s template or language. Baseline agents with both skills on disk frankenstein them: "Hard cut to...", "* At [Xs]:", "extreme high angle" are multicam lines and have no place here. This template snaps and locks — it literally requires "No hard cuts to different scenes".
- Do NOT write transitions as instant or invisible viewpoint changes. "Instantly snap" was retired in v3: generators read it as a hard cut and the kinetic differential disappears. Every position line describes visible travel (whip / sweep / rise / drop / punch-in / pull-out / roll) with motion blur, then the lock.
- Do NOT add sections the template doesn't have: no SFX blocks, no typography style sheets (font, color, shadow), no enter/exit animation choreography, no per-word pop timings. One super per block, one time range.
- Do NOT write supers as full caption sentences, and never use words that aren't in that block's transcript window.
- Do NOT stamp every block with text by default. Supers follow their own density rule (~1.5–2s each) and only land on words that earn it — "YOU CAN" on a filler phrase was the observed failure. Filler blocks stay camera-only.
- Do NOT restructure, reorder, paraphrase, translate, or grammar-fix the template.
- Do NOT cut mid-word, and do NOT hand over `NAIVE_CUTS` without the Step 2 refinement.
- Do NOT change the block structure — 4–6 blocks per the duration rule (user override at the checkpoint only), and the LAST block always snaps back to the original camera and holds until the end. The optional hook block (camera still, over the opening hold) is the ONLY structural addition allowed, and only when the user opts in at the checkpoint.
- Do NOT use a position that reads like the source framing. "Lower orbit ending in a centered composition" was retired from the defaults for exactly this: low + centered ≈ the original talking-head frame, and the generation showed no visible cut. Apply the contrast rule.
- Do NOT let the opening hold drag: past ~1.2s without a snap the format dies. If a clean phrase boundary exists at 0.8–1.0s, use it.
- Do NOT strip the timestamp brackets (`From [0.8s] to [2.1s]`, never `From 0.8s to 2.1s`) or the quotes around the supers — check every block before saving.
- Do NOT deliver without a `PASS` from `scripts/verify_prompt.py` on the saved file.
- Do NOT skip the checkpoint or deliver before the user answers it.
