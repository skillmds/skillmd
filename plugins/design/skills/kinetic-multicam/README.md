# Kinetic Multicam

Turn ONE talking-head take into a **kinetic supers + rapid camera reposition** prompt for video-to-video AI generators.

You film a single clip on a single camera. The skill finds the beats of your speech, fills a battle-tested prompt template with 4–6 timeline blocks (scaled to the clip's length) — each one a split-second, visibly motion-blurred camera whip that locks into a stable frame, plus a bold kinetic super (motion-graphics text, not a caption) cut from the exact words you speak in that window. Same face, same room, same voice, same lip sync. No editing timeline, no After Effects.

> Validated on **Seedance 2.0 Fast** (2026-07). Google Omni also runs the template, but with clearly weaker results — prefer Seedance 2.0 Fast.

## How it works
1. Drop your talking-head video in a folder and ask for the kinetic multicam prompt.
2. The skill runs a **preflight check** (`scripts/check_env.py`) and, if anything is missing, explains what it is for and asks permission to install it — so it's plug-and-play.
3. It transcribes your video **word-level** (Whisper, runs locally) to find exactly where each phrase starts and where you breathe.
4. It suggests **4–6 timeline blocks** on those beats (boundaries land on phrase starts, inside breaths, never mid-word) and drafts the supers — verbatim crops of the key words you actually say in each block, in your spoken language.
5. You confirm or adjust the timestamps, the super texts and the camera positions (tight close-up, left orbit, higher crane, wide room reveal, back to the original framing — with presets to swap any of them; every position must contrast with the source framing and its neighbors, and positions that match the phrase's meaning win). You can also opt into a frame-1 hook super over the opening hold.
6. It fills the frozen template, self-checks it (`scripts/verify_prompt.py`) and saves a ready-to-paste prompt. Upload your clip into Seedance 2.0 Fast, select it as the source footage, paste, generate.

## Prerequisites (free and local, no API keys)
**You don't need to figure this out yourself.** On first run the skill checks everything for you (`scripts/check_env.py`): it reports what's missing, explains what each piece is FOR, shows the exact install command for your OS — and asks your permission before installing anything.

What it needs and why:
- **Python 3.8+** — runs the skill's helper scripts (the transcription and the self-check). Get it at [python.org](https://python.org).
- **ffmpeg** (includes `ffprobe`) — the tool that reads your video: decodes the audio for transcription and reads the clip's duration so every timestamp stays inside your take.
  - macOS: `brew install ffmpeg`
  - Windows: `winget install Gyan.FFmpeg` (or `choco install ffmpeg`)
  - Linux: `sudo apt install ffmpeg`
- **openai-whisper** — transcribes your speech word-by-word, 100% on your machine (nothing is uploaded): `pip install -r requirements.txt`

The first transcription downloads a Whisper model (~460MB for the default `small`) once. Everything else is local: no API key, no account, no paid service. Whisper is multilingual, so it works for any creator's language (the prompt body is always English; the supers stay in your spoken language).

## Install the skill
This is a **Claude Code skill**. Put it in your skills folder as `kinetic-multicam`:

```bash
git clone https://github.com/aipauloshimas/kinetic-multicam ~/.claude/skills/kinetic-multicam
```

(Windows: clone into `C:\Users\<you>\.claude\skills\kinetic-multicam`.)

Then open Claude Code, drop in your clip and say: **"make the kinetic multicam prompt for this video"**.

## The template
The prompt template is frozen on purpose — its strict preservation rules ("preserve the person's face, identity... do not replace, redesign, or hallucinate any part of the scene") are what keep your identity, room and voice locked while the camera snaps and the supers animate. The skill only ever fills the `[Xs]` timestamps and the `"[TEXT]"` supers and, if you ask, swaps the camera position descriptions. Everything else ships exactly as written.

## Files
- `SKILL.md` — the skill (workflow, the frozen template, block-placement rules, supers rules, camera presets).
- `scripts/check_env.py` — preflight dependency check (reports what's missing and how to install it).
- `scripts/beats.py` — local word-level transcription (Whisper) + speech-beat report + first-guess block boundaries (`--cuts N`).
- `scripts/verify_prompt.py` — self-check: confirms a delivered prompt matches the frozen template outside the mutable zones.
- `requirements.txt` — the single Python dependency (openai-whisper).

## License
MIT. See `LICENSE`.
