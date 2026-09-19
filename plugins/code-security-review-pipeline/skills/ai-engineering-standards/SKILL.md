---
name: production-python-ai
description: "Production-grade Python and AI engineering standards. Use for ANY Python work — FastAPI services, LangChain/LangGraph agents, RAG pipelines, LLM API integrations, document processing, or data scripts — whether writing new code, reviewing, refactoring, or debugging. Enforces typed Pydantic boundaries, structured errors and logging, LLM call timeouts/retries/output validation, secret management, async correctness, and tested code."
---

 
# Production Python & AI Engineering Standards
 
## Code quality baseline
- Type hints on every function signature. Pydantic v2 models at all I/O boundaries (API requests/responses, LLM outputs, file parsing results).
- Code must pass ruff and mypy. No print() — use the logging module with structured context.
- Config via pydantic-settings and environment variables. Never hardcode API keys, model names, or URLs. Magic numbers (chunk sizes, top_k, thresholds) live in a config object, not inline.
## FastAPI
- async def for I/O-bound routes; never call blocking/sync I/O inside them.
- Shared clients (DB, HTTP, LLM SDKs) created once at startup and injected via Depends — never instantiated per request.
- response_model on every route. Correct status codes. Routes stay thin: validation in, service call, response out — business logic lives in service functions.
- Raise HTTPException with clear detail; map internal exceptions to safe client messages (never leak stack traces or keys).
## LLM calls (any provider)
- Every call gets: explicit timeout, retry with exponential backoff on transient errors, and a max-retry cap.
- NEVER trust raw model output. Parse into a Pydantic schema; on validation failure, retry with the error fed back or fall through to an explicit failure path — never .get() blindly on un-validated JSON.
- Pin model versions in config. Prompts are versioned constants/templates in the repo, not inline f-strings scattered through code.
- Log per call: model, latency, input/output tokens, and a request/trace ID. Propagate the trace ID through every pipeline stage.
## LangChain / LangGraph / RAG
- Prefer explicit LangGraph state (TypedDict/Pydantic) over implicit chains; every node validates what it reads from state.
- Handle tool errors inside the graph — a failed tool returns a structured error message to the model, it does not crash the run.
- RAG: chunking params, embedding model, and top_k come from config; embedding model version is pinned (changing it invalidates the index — say so in code comments).
- Use asyncio.gather for independent parallel LLM/tool calls; cap concurrency with a semaphore.
## Errors & logging
- Catch specific exceptions only — no bare except. Either handle meaningfully or let it propagate; never swallow silently.
- Fail loud and early in pipelines: validate inputs at the start, not three stages deep.
- Logs are structured (key=value or JSON): event, trace_id, duration_ms, and outcome.
## Testing
- pytest. Unit tests NEVER hit live LLM APIs — mock the client and test the parsing/validation/retry logic hard, including malformed model output.
- Bug fix = first a failing test that reproduces it, then the fix.
- For prompts: keep golden input/output examples and assert the parser handles them.
## Before declaring done
- Run the code or tests — never claim it works without verification.
- Check: secrets out of code, types clean, errors handled, LLM outputs validated, logs in place.s