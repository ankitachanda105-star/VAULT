import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Node, Replica, StoredObject
from services.storage_manager import storage_manager
from services.checksum import calculate_sha256
from services.connection_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["rebalance"])


@router.post("/rebalance")
async def trigger_cluster_rebalance(db: Session = Depends(get_db)):
    """
    Computes storage utilization across all ONLINE nodes.
    Identifies the single most-used node and single least-used node.
    Moves up to 2-3 object replicas from the most-used node to the least-used node.
    Returns before and after storage snapshots, plus objects_moved.
    Broadcasts 'rebalance_completed' WebSocket event.
    """
    online_nodes = db.query(Node).filter(Node.status == "ONLINE").all()
    if len(online_nodes) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Need at least 2 online nodes to perform rebalancing",
        )

    for n in online_nodes:
        n.used_storage = storage_manager.get_node_used_storage(n.path)
    db.commit()

    before_snapshot = [
        {"node_name": n.node_name, "node_id": n.id, "used_storage": n.used_storage}
        for n in sorted(online_nodes, key=lambda x: x.id)
    ]

    sorted_nodes = sorted(online_nodes, key=lambda n: n.used_storage, reverse=True)
    most_used = sorted_nodes[0]
    least_used = sorted_nodes[-1]

    objects_moved = []

    if most_used.id != least_used.id and most_used.used_storage > least_used.used_storage:
        source_replicas = (
            db.query(Replica)
            .join(StoredObject, Replica.object_id == StoredObject.id)
            .filter(
                Replica.node_id == most_used.id,
                Replica.status == "healthy",
                Replica.version == StoredObject.version,
            )
            .all()
        )

        for rep in source_replicas:
            if len(objects_moved) >= 3:
                break

            obj = rep.object
            has_replica_on_target = (
                db.query(Replica)
                .filter(
                    Replica.object_id == obj.id,
                    Replica.node_id == least_used.id,
                    Replica.version == obj.version,
                    Replica.status != "missing",
                )
                .first()
            )
            if has_replica_on_target:
                continue

            source_clean_name = most_used.path.split("/")[-1]
            target_clean_name = least_used.path.split("/")[-1]
            filename = str(obj.id)

            try:
                file_bytes = storage_manager.read_file(source_clean_name, filename)
            except Exception as e:
                logger.warning(f"Could not read from source {source_clean_name} during rebalance: {e}")
                continue

            try:
                storage_manager.save_file(target_clean_name, filename, file_bytes)
                computed_hash = calculate_sha256(file_bytes)

                new_rep = Replica(
                    object_id=obj.id,
                    node_id=least_used.id,
                    checksum=computed_hash,
                    version=obj.version,
                    status="healthy",
                )
                db.add(new_rep)

                storage_manager.delete_file(source_clean_name, filename)
                db.delete(rep)
                db.flush()

                objects_moved.append({
                    "object_id": obj.id,
                    "object_name": obj.object_name,
                    "from_node": most_used.node_name,
                    "from_node_id": most_used.id,
                    "to_node": least_used.node_name,
                    "to_node_id": least_used.id,
                    "size": len(file_bytes),
                })
            except Exception as err:
                logger.error(f"Failed to move object {obj.id} to {target_clean_name}: {err}")
                db.rollback()
                continue

        db.commit()

    for n in online_nodes:
        n.used_storage = storage_manager.get_node_used_storage(n.path)
    db.commit()

    after_snapshot = [
        {"node_name": n.node_name, "node_id": n.id, "used_storage": n.used_storage}
        for n in sorted(online_nodes, key=lambda x: x.id)
    ]

    summary = {
        "before": before_snapshot,
        "after": after_snapshot,
        "objects_moved": objects_moved,
    }

    await manager.broadcast("rebalance_completed", summary)

    return summary
