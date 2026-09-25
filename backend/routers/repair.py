from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import StoredObject
from services.repair import repair_object, repair_all_degraded

router = APIRouter(prefix="/repair", tags=["repair"])


@router.post("/{object_id}")
async def trigger_repair_object(object_id: int, db: Session = Depends(get_db)):
    """Manually trigger repair for a specific object."""
    obj = db.query(StoredObject).filter(StoredObject.id == object_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Object {object_id} not found",
        )
    result = await repair_object(object_id, db=db)
    return result


@router.post("/all")
async def trigger_repair_all(db: Session = Depends(get_db)):
    """Manually trigger repair for all degraded objects in the cluster."""
    results = await repair_all_degraded(db=db)
    return {"repaired_objects_count": len(results), "details": results}
