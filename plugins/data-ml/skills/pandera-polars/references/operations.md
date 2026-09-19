# Pandera Polars operation map

## Define

- Use `pa.DataFrameSchema` plus `pa.Column` for a schema value.
- Use `pa.DataFrameModel` plus annotations and `pa.Field` for a named declarative
  model.
- Set strictness, coercion, nullability, requirement, and uniqueness explicitly
  where they are part of the boundary.

## Check

- Prefer built-in `Check` constructors for comparisons, membership, strings,
  and other directly supported predicates.
- Use a native `PolarsData` custom check for vectorized column or dataframe
  rules. Keep its output shape intentional.
- Avoid backend features listed only for pandas. Confirm the supported-feature
  matrix before using index, groupby, parser, synthesis, or hypothesis patterns.

## Place validation

- Validate untrusted ingress before business logic when types/shape must be
  trusted.
- Revalidate after joins, pivots, schema unions, or external callbacks that can
  change the contract.
- Validate before egress when the consumer contract is the primary invariant.
- Use decorators only when they clarify an existing function boundary and
  preserve inspectable/testable error behavior.

## Handle results

Use the object returned by `validate`, especially when coercion or filtering is
enabled. Catch `SchemaError`/`SchemaErrors` only to translate them into a stable
application error; preserve structured failure categories and redact sensitive
values as required.
