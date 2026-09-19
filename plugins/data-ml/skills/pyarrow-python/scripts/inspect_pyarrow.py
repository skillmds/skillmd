#!/usr/bin/env python3
"""Report installed PyArrow versions and selected dotted API signatures."""

from __future__ import annotations

import importlib
import importlib.metadata
import inspect
import json
import sys


def resolve(path: str) -> object:
    parts = path.split(".")
    for index in range(len(parts), 0, -1):
        try:
            value: object = importlib.import_module(".".join(parts[:index]))
        except ModuleNotFoundError:
            continue
        for part in parts[index:]:
            value = getattr(value, part)
        return value
    raise ModuleNotFoundError(path)


def main() -> int:
    import pyarrow

    paths = sys.argv[1:] or ["pyarrow.Table", "pyarrow.dataset.Dataset.scanner"]
    apis: dict[str, object] = {}
    for path in paths:
        try:
            value = resolve(path)
            try:
                signature = str(inspect.signature(value))
            except (TypeError, ValueError):
                signature = None
            apis[path] = {"signature": signature, "type": type(value).__name__}
        except (AttributeError, ImportError, ModuleNotFoundError) as exc:
            apis[path] = {"error": f"{type(exc).__name__}: {exc}"}
    payload = {
        "distribution": importlib.metadata.version("pyarrow"),
        "module": pyarrow.__version__,
        "apis": apis,
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
