import asyncio
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from database import SessionLocal
from models import StoredObject, Node, Replica
from services.storage_manager import storage_manager
from services.checksum import calculate_sha256, verify_replica
from services.connection_manager import manager

logger = logging.getLogger(__name__)


async def repair_object(object_id: int, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Repairs an under-replicated object:
    - Counts live replicas (status == 'healthy' and parent node == 'ONLINE').
    - If live count >= replication_factor, returns 'already_healthy'.
    - Selects 1 new target node from ONLINE nodes excluding all nodes that already hold a replica.
    - Marks target node as REPAIRING and broadcasts 'repair_started'.
    - Reads file from any healthy replica, saves to target node, verifies SHA-256.
    - Inserts new healthy replica row, restores target node to ONLINE.
    - Updates object status and broadcasts 'repair_completed'.
    - If no healthy replica exists, marks object 'critical' and broadcasts 'repair_failed'.
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        obj = db.query(StoredObject).filter(StoredObject.id == object_id).first()
        if not obj:
            return {"status": "not_found", "object_id": object_id}

        # 1. Count live healthy replicas on ONLINE nodes for current version
        live_replicas = (
            db.query(Replica)
            .join(Node, Replica.node_id == Node.id)
            .filter(
                Replica.object_id == object_id,
                Replica.version == obj.version,
                Replica.status == "healthy",
                Node.status == "ONLINE",
            )
            .all()
        )

        live_count = len(live_replicas)
        if live_count >= obj.replication_factor:
            return {
                "status": "already_healthy",
                "object_id": object_id,
                "live_replicas": live_count,
                "replication_factor": obj.replication_factor,
            }

        # 2. Identify candidate nodes: ONLINE and NOT already holding an active replica of current version
        existing_node_ids = {r.node_id for r in obj.replicas if r.version == obj.version and r.status != "missing"}
        candidate_nodes = (
            db.query(Node)
            .filter(
                Node.status == "ONLINE",
                ~Node.id.in_(existing_node_ids),
            )
            .all()
        )

        if not candidate_nodes:
            logger.warning(f"No available online candidate nodes to repair object {object_id}")
            return {
                "status": "no_candidate_node",
                "object_id": object_id,
                "live_replicas": live_count,
                "replication_factor": obj.replication_factor,
            }

        # Sort candidate nodes by live used storage ascending (least used first)
        def sort_key(n: Node):
            return (storage_manager.get_node_used_storage(n.path), n.id)

        target_node = sorted(candidate_nodes, key=sort_key)[0]

        # 3. Mark target node status REPAIRING and broadcast repair_started
        target_node.status = "REPAIRING"
        db.commit()

        await manager.broadcast(
            "repair_started",
            {
                "object_id": object_id,
                "node_id": target_node.id,
                "node_name": target_node.node_name,
            },
        )

        # 4. Read file bytes from any currently healthy replica on an ONLINE node
        filename = str(object_id)
        file_bytes = None
        for rep in live_replicas:
            node = db.query(Node).filter(Node.id == rep.node_id).first()
            clean_node_name = node.path.split("/")[-1]
            try:
                data = storage_manager.read_file(clean_node_name, filename)
                if calculate_sha256(data) == rep.checksum:
                    file_bytes = data
                    break
            except Exception:
                continue

        if file_bytes is None:
            # Total data loss!
            obj.status = "critical"
            target_node.status = "ONLINE"
            db.commit()
            await manager.broadcast(
                "repair_failed",
                {
                    "object_id": object_id,
                    "reason": "no healthy replica available to copy from",
                },
            )
            return {"status": "repair_failed", "object_id": object_id, "reason": "no healthy replica available"}

        # 5. Write file bytes to target node folder
        clean_target_name = target_node.path.split("/")[-1]
        storage_manager.save_file(clean_target_name, filename, file_bytes)

        # 6. Compute fresh SHA-256 and insert new replica row
        fresh_checksum = calculate_sha256(file_bytes)
        new_replica = Replica(
            object_id=object_id,
            node_id=target_node.id,
            checksum=fresh_checksum,
            version=obj.version,
            status="healthy",
        )
        db.add(new_replica)

        # 7. Restore target node to ONLINE
        target_node.status = "ONLINE"

        # Update object status
        new_live_count = live_count + 1
        obj.status = "healthy" if new_live_count >= obj.replication_factor else "degraded"
        db.commit()

        # 8. Broadcast repair_completed
        await manager.broadcast(
            "repair_completed",
            {
                "object_id": object_id,
                "node_id": target_node.id,
                "node_name": target_node.node_name,
                "live_replicas": new_live_count,
                "replication_factor": obj.replication_factor,
            },
        )

        return {
            "status": "repaired",
            "object_id": object_id,
            "target_node": target_node.node_name,
            "target_node_id": target_node.id,
            "live_replicas": new_live_count,
            "replication_factor": obj.replication_factor,
        }

    except Exception as exc:
        logger.error(f"Error repairing object {object_id}: {exc}")
        if 'target_node' in locals() and target_node:
            target_node.status = "ONLINE"
            db.commit()
        raise
    finally:
        if close_db:
            db.close()


async def detect_and_repair_replica(db: Session, replica: Replica) -> bool:
    """
    Verifies a replica's integrity. If checksum fails:
    - Marks replica as corrupted
    - Broadcasts 'corruption_detected'
    - Calls repair_object() to restore replication factor
    - Broadcasts 'corruption_repaired'
    Returns True if corruption was detected and handled, False if healthy.
    """
    node = db.query(Node).filter(Node.id == replica.node_id).first()
    is_valid = verify_replica(replica)

    if not is_valid:
        node_name = node.node_name if node else f"Node-{replica.node_id}"
        logger.warning(
            f"DATA CORRUPTION DETECTED for object {replica.object_id} on {node_name}!"
        )

        # Mark replica status as corrupted in DB
        replica.status = "corrupted"
        db.commit()

        # Broadcast corruption_detected
        await manager.broadcast(
            "corruption_detected",
            {
                "object_id": replica.object_id,
                "node_id": replica.node_id,
                "node_name": node_name,
            },
        )

        # Trigger repair to bring healthy replicas back to replication_factor
        repair_res = await repair_object(replica.object_id, db=db)
        new_node_id = repair_res.get("target_node_id")

        # Broadcast corruption_repaired
        await manager.broadcast(
            "corruption_repaired",
            {
                "object_id": replica.object_id,
                "node_id": replica.node_id,
                "new_node_id": new_node_id,
                "verified": True,
            },
        )
        return True

    return False


async def repair_all_degraded(db: Optional[Session] = None) -> List[Dict[str, Any]]:
    """Scans all objects and repairs any object where live replicas < replication_factor."""
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        objects = db.query(StoredObject).all()
        results = []
        for obj in objects:
            live_count = (
                db.query(Replica)
                .join(Node, Replica.node_id == Node.id)
                .filter(
                    Replica.object_id == obj.id,
                    Replica.status == "healthy",
                    Node.status == "ONLINE",
                )
                .count()
            )
            if live_count < obj.replication_factor:
                logger.info(f"Object {obj.id} is degraded ({live_count}/{obj.replication_factor}). Repairing...")
                res = await repair_object(obj.id, db=db)
                results.append(res)
        return results
    finally:
        if close_db:
            db.close()
