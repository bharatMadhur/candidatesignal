from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import current_user
from ..operations import acknowledge_alert, list_alert_deliveries, list_operational_alerts
from ..parse_jobs import list_dead_letters, resolve_dead_letter
from ..tenancy import require_tenant_admin, require_tenant_write


router = APIRouter(tags=["operations"])


@router.get("/parse-dead-letters")
def parse_dead_letters(
    status: str = Query("open"),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    return {"dead_letters": list_dead_letters(_tenant_id(user), status=status, limit=limit), "user": user}


@router.get("/parse-file-reviews")
def parse_file_reviews(
    status: str = Query("open"),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    return {"file_reviews": list_dead_letters(_tenant_id(user), status=status, limit=limit), "user": user}


@router.get("/operational-alerts")
def operational_alerts(
    status: str = Query("open"),
    limit: int = Query(100, ge=1, le=200),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    return {"alerts": list_operational_alerts(_tenant_id(user), status=status, limit=limit), "user": user}


@router.post("/operational-alerts/{alert_id}/acknowledge")
def operational_alert_acknowledge(alert_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return {"alert": acknowledge_alert(alert_id, _tenant_id(user), user["id"]), "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="alert not found or already closed") from exc


@router.get("/operational-alert-deliveries")
def operational_alert_delivery_history(
    limit: int = Query(100, ge=1, le=200),
    user: dict = Depends(current_user),
) -> dict:
    require_tenant_admin(user)
    return {"deliveries": list_alert_deliveries(_tenant_id(user), limit=limit), "user": user}


@router.post("/parse-dead-letters/{dead_letter_id}/resolve")
def parse_dead_letter_resolve(dead_letter_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return {"dead_letter": resolve_dead_letter(dead_letter_id, _tenant_id(user), user["id"]), "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="dead-letter item not found or already resolved") from exc


@router.post("/parse-file-reviews/{review_id}/resolve")
def parse_file_review_resolve(review_id: str, user: dict = Depends(current_user)) -> dict:
    require_tenant_write(user)
    try:
        return {"file_review": resolve_dead_letter(review_id, _tenant_id(user), user["id"]), "user": user}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="file review item not found or already resolved") from exc


def _tenant_id(user: dict) -> str:
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="tenant membership required")
    return tenant_id
