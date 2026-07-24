import sys
import os
import types

# ── Vercel Compatibility Shim ──────────────────────────────────────────────
# pkg_resources (part of setuptools) is not guaranteed on the Vercel Python
# runtime. razorpay==1.4.x uses pkg_resources.get_distribution() at import
# time. We inject a minimal stub before any other imports so the module
# resolves without error.
if "pkg_resources" not in sys.modules:
    _pkg = types.ModuleType("pkg_resources")

    class _Dist:
        def __init__(self, version="0.0.0"):
            self.version = version

    def _get_distribution(name):
        return _Dist()

    _pkg.get_distribution = _get_distribution
    _pkg.DistributionNotFound = Exception
    _pkg.VersionConflict = Exception
    sys.modules["pkg_resources"] = _pkg

# ── Path setup ────────────────────────────────────────────────────────────
# Add backend directory to sys.path so Vercel can import Flask modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app import create_app

app = create_app()
