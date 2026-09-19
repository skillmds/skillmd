# Pandera Polars schema and validation model

## Schema styles

`DataFrameSchema` is a runtime value composed from `Column` and `Check` objects.
It is best for dynamic schema generation, programmatic composition, or passing a
schema as data. `DataFrameModel` is a class declaration using annotated fields,
`Field`, checks, and configuration; it is best for a stable named contract.
Choose one authoritative form. Derive/export the other only through a tested
mechanism.

## Rule layers

1. Structure: names, presence, extra-column policy, and order if the boundary
   requires it.
2. Representation: Polars dtypes and optional coercion.
3. Local validity: nullable, unique, comparisons, membership, string rules.
4. Relational validity: cross-column or dataframe-level checks.
5. Pipeline boundary: when validation executes and which returned frame moves
   forward.

## Eager, deferred, and aggregated failure

An eager Polars `DataFrame` supports schema- and data-level validation. A Polars
`LazyFrame` is a deferred plan; the native integration normally limits default
validation to schema-level information. Separately, Pandera's `lazy=True`
collects multiple validation failures before raising `SchemaErrors`. Always say
which meaning is intended.

## Custom-check shape

For native Polars custom checks, `PolarsData.lazyframe` supplies the input and
`PolarsData.key` identifies the column for a column check. Return a Boolean
`LazyFrame` in a backend-supported scalar, one-column, or dataframe shape.
Prefer native expressions; `element_wise=True` invokes Python per element and is
not the default escape hatch.
