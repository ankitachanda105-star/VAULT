from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Node, StoredObject, Replica
from schemas import HealthNodeResponse, HealthSummaryResponse
from services.storage_manager import storage_manager

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/nodes", response_model=List[HealthNodeResponse])
def get_health_nodes(db: Session = Depends(get_db)):
    try:
        nodes = db.query(Node).order_by(Node.id.asc()).all()
        # Compute live used storage for each node
        for node in nodes:
            node.used_storage = storage_manager.get_node_used_storage(node.path)
        return nodes
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve health nodes: {str(exc)}",
        )


@router.get("/summary", response_model=HealthSummaryResponse)
def get_health_summary(db: Session = Depends(get_db)):
    try:
        nodes = db.query(Node).all()
        total_nodes = len(nodes)
        online_count = sum(1 for n in nodes if n.status == "ONLINE")
        failed_count = sum(1 for n in nodes if n.status == "FAILED")

        objects = db.query(StoredObject).all()
        total_objects = len(objects)

        healthy_objects = 0
        degraded_objects = 0

        for obj in objects:
            # Count healthy replicas located on ONLINE nodes
            live_replicas_count = (
                db.query(Replica)
                .join(Node, Replica.node_id == Node.id)
                .filter(
                    Replica.object_id == obj.id,
                    Replica.status == "healthy",
                    Node.status == "ONLINE",
                )
                .count()
            )

            if live_replicas_count == obj.replication_factor:
                healthy_objects += 1
            elif 0 < live_replicas_count < obj.replication_factor:
                degraded_objects += 1

        return {
            "total_nodes": total_nodes,
            "online": online_count,
            "failed": failed_count,
            "total_objects": total_objects,
            "healthy_objects": healthy_objects,
            "degraded_objects": degraded_objects,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate health summary: {str(exc)}",
        )
