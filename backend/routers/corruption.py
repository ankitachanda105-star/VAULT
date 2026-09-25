import os
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from models import StoredObject, Node, Replica
from services.storage_manager import storage_manager
from services.checksum import verify_replica
from services.repair import detect_and_repair_replica

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/objects", tags=["corruption"])


@router.post("/{object_id}/simulate-corruption")
def simulate_corruption(
    object_id: int,
    node_id: int = Query(..., description="Target node ID where replica file should be corrupted"),
    db: Session = Depends(get_db),
):
    """
    Injects data corruption directly into the physical file on disk at storage/nodeX/{object_id}.
    Does NOT touch the DB checksum or status, so detection can genuinely discover it.
    """
    replica = (
        db.query(Replica)
        .filter(Replica.object_id == object_id, Replica.node_id == node_id)
        .first()
    )
    if not replica:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No replica found for object {object_id} on node {node_id}",
        )

    node = db.query(Node).filter(Node.id == node_id).first()
    clean_node_name = node.path.split("/")[-1]
    file_path = storage_manager.get_file_path(clean_node_name, str(object_id))

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Replica file on disk not found at {file_path}",
        )

    try:
        # Read file bytes and corrupt the first 10 bytes
        raw_bytes = bytearray(file_path.read_bytes())
        if len(raw_bytes) >= 10:
            corrupted_header = b"!CORRUPTED"
            raw_bytes[:10] = corrupted_header
        else:
            raw_bytes = bytearray(b"!CORRUPTED_SHORT_DATA!")

        file_path.write_bytes(bytes(raw_bytes))
        logger.info(f"Injected bit rot into object {object_id} on {node.node_name} at {file_path}")

        return {
            "object_id": object_id,
            "node_id": node_id,
            "node_name": node.node_name,
            "status": "corruption injected, awaiting detection",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to inject corruption: {str(exc)}",
        )


@router.get("/{object_id}/verify")
async def verify_object_replicas(object_id: int, db: Session = Depends(get_db)):
    """
    On-demand verification: Checks every replica of this object.
    If any replica is corrupted, marks it corrupted, broadcasts events,
    and repairs the object immediately.
    Returns per-replica health results.
    """
    obj = db.query(StoredObject).filter(StoredObject.id == object_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Object {object_id} not found",
        )

    replicas = db.query(Replica).filter(Replica.object_id == object_id).all()
    results = []

    for rep in replicas:
        node = db.query(Node).filter(Node.id == rep.node_id).first()
        node_name = node.node_name if node else f"Node-{rep.node_id}"

        # If already marked corrupted or missing
        if rep.status != "healthy":
            results.append({
                "node_id": rep.node_id,
                "node_name": node_name,
                "status": rep.status,
            })
            continue

        # Check replica integrity
        was_corrupted = await detect_and_repair_replica(db=db, replica=rep)
        results.append({
            "node_id": rep.node_id,
            "node_name": node_name,
            "status": "corrupted" if was_corrupted else "healthy",
        })

    return {
        "object_id": object_id,
        "results": results,
    }
