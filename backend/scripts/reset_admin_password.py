"""Reset admin password in Firestore (super_admin or museum_admin).

Usage:
  cd backend
  export GOOGLE_CLOUD_PROJECT=museai-2026
  python3 scripts/reset_admin_password.py --username admin --password 'NewPass123'
"""

from __future__ import annotations

import argparse
import asyncio
import os
import hashlib

from google.cloud import firestore

try:
    import bcrypt  # type: ignore
except Exception:
    bcrypt = None


def hash_password(password: str) -> str:
    # Prefer bcrypt when available (same as backend auth).
    if bcrypt is not None:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    # Fallback for environments without bcrypt.
    # backend/auth/admin.py still supports legacy SHA256 verification.
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


async def main() -> int:
    parser = argparse.ArgumentParser(description="Reset admin password in Firestore")
    parser.add_argument("--username", required=True, help="Admin username (e.g. admin)")
    parser.add_argument("--password", required=True, help="New plain password")
    parser.add_argument("--project", default=os.getenv("GOOGLE_CLOUD_PROJECT", ""), help="GCP project id")
    parser.add_argument("--activate", action="store_true", help="Force account status to active")
    args = parser.parse_args()

    if not args.project:
        print("ERROR: Missing --project or GOOGLE_CLOUD_PROJECT")
        return 2

    if len(args.password) < 8:
        print("ERROR: Password must be at least 8 characters")
        return 2

    db = firestore.AsyncClient(project=args.project)
    query = db.collection("admin_users").where("username", "==", args.username).limit(1)

    doc_ref = None
    async for doc in query.stream():
        doc_ref = doc.reference
        break

    if not doc_ref:
        print(f"ERROR: username '{args.username}' not found in project '{args.project}'")
        return 1

    updates = {"password_hash": hash_password(args.password)}
    if args.activate:
        updates["status"] = "active"

    await doc_ref.set(updates, merge=True)
    mode = "bcrypt" if bcrypt is not None else "sha256 fallback"
    print(f"OK: password updated for '{args.username}' in project '{args.project}' ({mode})")

    close_fn = getattr(db, "close", None)
    if callable(close_fn):
        maybe = close_fn()
        if asyncio.iscoroutine(maybe):
            await maybe

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
