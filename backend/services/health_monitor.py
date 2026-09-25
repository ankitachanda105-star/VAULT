import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict

from database import SessionLocal
from models import Node, Replica
from services.storage_manager import storage_manager
from services.connection_manager import manager
from services.repair import repair_all_degraded, detect_and_repair_replica

logger = logging.getLogger(__name__)

# In-memory status tracker to detect transitions
_last_node_status: Dict[int, str] = {}


async def check_node_health():
    """
    Inspects each node in SQLite:
    - Verifies its storage folder is accessible on disk.
    - If accessible, updates last_heartbeat to now.
    - If missing or inaccessible, marks status as FAILED.
    - Detects status transitions and broadcasts 'node_status_changed' via WebSocket.
    - If any node transitioned to FAILED, automatically triggers repair_all_degraded().
    """
    global _last_node_status

    node_failed_detected = False

    with SessionLocal() as db:
        nodes = db.query(Node).all()
        for node in nodes:
            clean_name = node.path.split("/")[-1]
            folder_path = storage_manager.get_node_dir(clean_name)

            previous_status = _last_node_status.get(node.id, node.status)

            if not folder_path.is_dir():
                # Storage directory is missing or inaccessible
                if node.status != "FAILED":
                    logger.warning(f"Node '{node.node_name}' folder '{node.path}' is missing! Marking FAILED.")
                    node.status = "FAILED"
            else:
                # Folder is accessible -> heartbeat is valid
                node.last_heartbeat = datetime.now(timezone.utc)

            # Check for status transition (manual DB change or automatic detection)
            if node.id in _last_node_status and previous_status != node.status:
                logger.info(f"Node '{node.node_name}' status changed: {previous_status} -> {node.status}")
                await manager.broadcast(
                    "node_status_changed",
                    {
                        "node_id": node.id,
                        "node_name": node.node_name,
                        "old_status": previous_status,
                        "new_status": node.status,
                    },
                )
                if node.status == "FAILED":
                    node_failed_detected = True

            _last_node_status[node.id] = node.status

        db.commit()

    # Automatically trigger self-healing repair if a node failure occurred
    if node_failed_detected:
        logger.info("Node failure detected in health monitor. Launching automatic repair.")
        asyncio.create_task(repair_all_degraded())


async def scan_replicas_integrity():
    """
    Periodic background integrity scan:
    Inspects all healthy replicas on ONLINE nodes, computes SHA-256,
    detects corruption, and triggers repair automatically.
    """
    with SessionLocal() as db:
        healthy_replicas = (
            db.query(Replica)
            .join(Node, Replica.node_id == Node.id)
            .filter(
                Replica.status == "healthy",
                Node.status == "ONLINE",
            )
            .all()
        )
        for rep in healthy_replicas:
            await detect_and_repair_replica(db=db, replica=rep)


async def run_health_monitor(interval_seconds: int = 5):
    """Periodic background loop running node health and heartbeat checks."""
    logger.info(f"Starting VAULT background health monitor (interval: {interval_seconds}s)")
    tick = 0
    while True:
        try:
            await check_node_health()
            tick += 1
            # Run integrity scan every ~10s (every 2 ticks at 5s interval)
            if tick % 2 == 0:
                await scan_replicas_integrity()
        except asyncio.CancelledError:
            logger.info("Health monitor background task cancelled.")
            break
        except Exception as exc:
            logger.error(f"Error in health monitor check: {exc}")

        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            logger.info("Health monitor background task cancelled.")
            break
