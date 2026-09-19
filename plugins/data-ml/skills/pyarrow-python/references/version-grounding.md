# PyArrow version and API grounding

PyArrow evolves quickly and combines Python wrappers with the bundled Arrow C++
implementation. Inspect before using a signature, option, experimental API, or
interchange capability.

Run from the installed skill directory in the project environment:

```text
python scripts/inspect_pyarrow.py pyarrow.dataset.dataset pyarrow.dataset.Dataset.scanner
```

The helper reports the installed distribution/module versions and signatures
where Python exposes them. If an extension method has no inspectable signature,
use `help(...)`, the installed docstring, and a minimal executable probe.

Do not infer support from current online docs when the project pins another
major version. Gate dataset, filesystem, IPC, compute-UDF, C-interface, Parquet,
and conversion options by the installed API. Record the probed version in tests
or maintenance evidence, not as an unqualified runtime promise.
