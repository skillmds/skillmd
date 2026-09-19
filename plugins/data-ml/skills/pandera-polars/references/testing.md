# Testing Pandera Polars contracts

For every declared rule include one passing and one minimal failing frame.

1. Assert the returned Polars object, schema, and values; coercion/filtering can
   make validation transformational.
2. Cover typed empty input, missing required column, extra column, wrong dtype,
   null in non-nullable field, duplicate in unique field, and each domain check.
3. For coercion, test accepted compatible input and rejected dirty input. Assert
   the exact returned dtype.
4. For cross-column checks, include equality boundaries, null combinations, and
   row-level counterexamples.
5. Validate both `DataFrame` and `LazyFrame` only if both are public inputs;
   assert which value checks actually execute.
6. With `lazy=True`, assert multiple independent failures through structured
   `failure_cases` or error categories rather than brittle prose.
7. Use performance regression evidence before accepting `element_wise=True` on
   a large boundary.
