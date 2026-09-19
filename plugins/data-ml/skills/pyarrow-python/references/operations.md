# PyArrow operation map

## Construct and inspect

- Use `pa.array`, `pa.record_batch`, and `pa.table` with `type=` or `schema=` at
  unstable boundaries. Inspect `.type`, `.schema`, `.null_count`, `.num_rows`,
  `.num_columns`, and chunk counts rather than Python element samples.
- Use schema equality for structural contracts. Check metadata explicitly when
  it is contractual; do not assume every equality mode includes it.

## Compute

- Use `pyarrow.compute` for scalar/vector kernels, selection, sorting, and
  aggregation. Read the installed kernel doc or signature for options.
- Use checked arithmetic/casts when overflow or domain errors must fail.
- Use Kleene Boolean kernels when unknown values follow three-valued logic.
- Use `Table.group_by(...).aggregate(...)` for grouped aggregates; grouped
  kernels are not necessarily direct `pyarrow.compute` calls.

## Scan

- Create a `Dataset` for multiple files, partitions, discovery, or pushdown.
- Bind projection and filter in `dataset.scanner(...)`; iterate
  `scanner.to_batches()` for bounded processing.
- Use `ds.field(...)` / `ds.scalar(...)` expressions for scan planning. Test
  missing fields and partition schema explicitly.

## Serialize and convert

- Use IPC stream for sequential batches and IPC file for a seekable file with
  footer metadata. Use Parquet for analytical storage and Dataset APIs for a
  partitioned collection.
- Reopen output and verify its schema. For pandas/NumPy/Python conversion,
  assert nullable, time-zone, decimal, dictionary, and nested representations
  required by the consumer.
