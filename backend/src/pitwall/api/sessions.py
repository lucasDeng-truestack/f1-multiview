"""Session catalog endpoint — powers the year → GP → session picker.

Keeps the rule that clients never call OpenF1 directly; the browser hits this
and the backend fetches/caches the schedule.
"""

from fastapi import APIRouter, HTTPException, Request

from pitwall.services.session_catalog import SessionCatalog

router = APIRouter()


@router.get("/api/sessions")
async def list_sessions(request: Request, year: int) -> SessionCatalog:
    catalog = getattr(request.app.state, "catalog", None)
    if catalog is None:
        raise HTTPException(status_code=503, detail="Catalog not ready")
    return await catalog.by_year(year)
