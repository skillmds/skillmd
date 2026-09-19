# Pandera Polars version and backend grounding

Install and inspect the actual Polars extra. Backend imports and supported
features have changed across Pandera releases.

From the installed skill directory run:

```text
python scripts/inspect_pandera_polars.py pandera.polars.DataFrameSchema.validate pandera.polars.Check
```

The helper reports Pandera and Polars distribution versions and inspectable API
signatures. Verify that `pandera.polars` imports successfully; the base Pandera
package alone is not evidence that the Polars backend is usable.

Consult the current official Polars integration and supported-feature matrix
before using backend-specific decorators, custom checks, validation depth, data
types, or model configuration. Do not port a `pandera.pandas` example by changing
only the import.
