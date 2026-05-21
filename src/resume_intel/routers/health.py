from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..db import applied_migrations, db


router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {"ok": True}


@router.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "service": "candidateSignal.ai-api"}


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
        "database": "ready",
        "migrations": {
            "status": "ready" if migrations else "missing",
            "applied_count": len(migrations),
            "latest": migrations[-1]["version"] if migrations else None,
        },
    }
