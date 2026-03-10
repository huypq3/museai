from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def pytest_addoption(parser):
    parser.addoption(
        "--run-integration",
        action="store_true",
        default=False,
        help="Run integration tests that need cloud credentials/APIs",
    )


def pytest_configure(config):
    config.addinivalue_line("markers", "integration: tests requiring cloud services")


def pytest_collection_modifyitems(config, items):
    run_integration = config.getoption("--run-integration") or os.getenv("RUN_INTEGRATION_TESTS") == "1"
    if run_integration:
        return

    skip_integration = pytest.mark.skip(
        reason="integration tests are disabled (set RUN_INTEGRATION_TESTS=1 or use --run-integration)",
    )
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_integration)
