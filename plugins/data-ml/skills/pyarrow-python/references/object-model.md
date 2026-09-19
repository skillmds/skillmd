# PyArrow object and memory model

Use this reference when choosing a public Arrow object or reasoning about
physical memory.

## Logical and physical layers

- `DataType` interprets buffers; `Field` adds a name, nullability, and metadata;
  `Schema` is an ordered set of fields plus schema metadata.
- `Array` is one typed physical segment. Its validity bitmap distinguishes null
  from a present value. Slices can share underlying buffers.
- `ChunkedArray` is one logical column over several arrays. Kernels often accept
  it, but a consumer that requires one contiguous segment may force allocation.
- `RecordBatch` is the bounded physical interchange unit: equal-length arrays
  under one schema.
- `Table` is a logical materialized table: each column is a `ChunkedArray`.
- `RecordBatchReader` is a consumable stream, not a collection. Preserve its
  schema and do not assume it is rewindable.
- `Dataset` describes fragments. `Scanner` binds columns, filter, batch sizing,
  and execution options. Neither is the same as a materialized table.

## Nested and encoded types

Use `list_` or `large_list` for variable-length child sequences, fixed-size
list when the width is an invariant, `struct` for named child fields, `map_` for
key/value pairs, dictionary types for encoded repeated values, decimal types for
fixed precision, and timestamp types with an explicit unit and time zone.
Construct an exact schema before ingest when Python inference cannot recover
those distinctions. Schema nullability is metadata, not a complete value
validator: explicitly check `null_count` before attaching a non-nullable field
when the boundary must reject null data.

## Ownership decision

Before promising no copy, establish the source buffer owner, layout and
alignment, target type, mutability expectations, and consumer lifetime. A slice
or C data interface can share memory, but conversions may allocate for bitmaps,
offset widths, casts, chunk combination, or incompatible nullable types. Keep
the owning object alive for every exported view.
