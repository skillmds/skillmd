# Testing PyArrow boundaries

Test the contract at the lowest observable layer.

1. Assert the returned class (`Array`, `Table`, `RecordBatchReader`, and so on).
2. Assert ordered schema fields, exact types, nullability, and required metadata.
   Separately assert zero `null_count` for each field whose data must be
   non-null; the schema flag alone does not prove this.
3. Exercise typed empty, all-null, null-plus-NaN, nested, decimal, and zoned
   timestamp inputs as relevant.
4. Construct a multi-chunk column and multiple record batches; ensure code does
   not accidentally depend on one physical segment.
5. For a scanner, assert the output schema and values from batch iteration;
   use plan/fragment inspection or measurement for pushdown claims.
6. Reopen Parquet or IPC output and assert the persisted contract.
7. For interchange, release or mutate the producer only in tests whose protocol
   permits it; validate lifetime rather than assuming it.

Use `Table.equals` or array equality for values, plus separate schema/metadata
assertions. Test row order only when the API contract or explicit sort defines
it.
