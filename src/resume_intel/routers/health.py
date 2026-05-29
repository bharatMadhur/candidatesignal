from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException

from ..db import applied_migrations, db


router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {"ok": True}


@router.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "service": "candidateSignal.ai-api", "build": build_metadata()}


@router.get("/readyz")
def readyz() -> dict:
    try:
        with db() as conn:
            conn.execute("select 1").fetchone()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database not ready: {exc}") from exc
    return {"ok": True, "database": "ready"}


@router.get("/healthz/deep")
def healthz_deep() -> dict:
    try:
        with db() as conn:
            conn.execute("select 1").fetchone()
        migrations = applied_migrations()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"deep health check failed: {exc}") from exc
    return {
        "ok": True,
        "service": "candidateSignal.ai-api",
        "build": build_metadata(),
        "database": "ready",
        "migrations": {
            "status": "ready" if migrations else "missing",
            "applied_count": len(migrations),
            "latest": migrations[-1]["version"] if migrations else None,
        },
    }


def build_metadata() -> dict:
    sha = (
        os.getenv("RESUME_INTEL_BUILD_SHA")
        or os.getenv("GIT_COMMIT")
        or os.getenv("SOURCE_COMMIT")
        or os.getenv("COMMIT_SHA")
        or ""
    ).strip()
    env = (os.getenv("RESUME_INTEL_ENV") or os.getenv("APP_ENV") or os.getenv("NEXT_PUBLIC_DEPLOY_ENV") or "").strip()
    return {
        "sha": sha[:40] or None,
        "environment": env or None,
    }
