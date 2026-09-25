import asyncio
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from models import Node
from schemas import NodeResponse, ChooseNodeResponse
from services.storage_manager import storage_manager, choose_node
from services.connection_manager import manager
from services.repair import repair_all_degraded

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.get("", response_model=List[NodeResponse])
def list_nodes(db: Session = Depends(get_db)):
    try:
        nodes = db.query(Node).order_by(Node.id.asc()).all()
        # Compute live used_storage from actual folder contents on disk
        for node in nodes:
            node.used_storage = storage_manager.get_node_used_storage(node.path)
        return nodes
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list nodes: {str(exc)}",
        )


@router.get("/choose-test", response_model=ChooseNodeResponse)
def test_choose_node(
    count: int = Query(default=3, ge=1, description="Number of distinct online nodes to choose"),
    db: Session = Depends(get_db),
):
    try:
        selected = choose_node(count=count, db=db)
        return {
            "requested_count": count,
            "selected_nodes": selected,
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error choosing nodes: {str(exc)}",
        )


@router.get("/{node_id}", response_model=NodeResponse)
def get_node(node_id: int, db: Session = Depends(get_db)):
    try:
        node = db.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Node {node_id} not found",
            )
        # Compute live used_storage from disk
        node.used_storage = storage_manager.get_node_used_storage(node.path)
        return node
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get node {node_id}: {str(exc)}",
        )


@router.post("/{node_id}/simulate-failure")
async def simulate_node_failure(node_id: int, db: Session = Depends(get_db)):
    """
    Simulates node failure by marking status FAILED in DB.
    Does NOT touch files on disk.
    Broadcasts 'node_failed' event and triggers automatic repair.
    """
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node {node_id} not found",
        )

    if node.status == "FAILED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Node {node.node_name} is already FAILED",
        )

    node.status = "FAILED"
    db.commit()

    now_iso = datetime.now(timezone.utc).isoformat()
    await manager.broadcast(
        "node_failed",
        {
            "node_id": node.id,
            "node_name": node.node_name,
            "timestamp": now_iso,
        },
    )

    # Immediately trigger automatic self-healing repair in background
    asyncio.create_task(repair_all_degraded())

    return {
        "message": f"Node {node.node_name} marked as FAILED. Automatic repair triggered.",
        "node_id": node.id,
        "status": node.status,
    }


@router.post("/{node_id}/recover")
async def recover_node(node_id: int, db: Session = Depends(get_db)):
    """
    Recovers a node back to ONLINE status.
    Broadcasts 'node_recovered' event.
    """
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node {node_id} not found",
        )

    if node.status == "ONLINE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Node {node.node_name} is already ONLINE",
        )

    node.status = "ONLINE"
    db.commit()

    now_iso = datetime.now(timezone.utc).isoformat()
    await manager.broadcast(
        "node_recovered",
        {
            "node_id": node.id,
            "node_name": node.node_name,
            "timestamp": now_iso,
        },
    )

    return {
        "message": f"Node {node.node_name} recovered to ONLINE.",
        "node_id": node.id,
        "status": node.status,
    }


@router.post("/{node_id}/simulate-partition")
async def simulate_node_partition(node_id: int, db: Session = Depends(get_db)):
    """
    Simulates a network partition for the specified node.
    The node status is set to 'PARTITIONED'.
    Health monitor continues to see disk folder and updates last_heartbeat,
    but data downloads and repairs bypass this node.
    Broadcasts 'node_partitioned' event.
    """
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node {node_id} not found",
        )

    if node.status == "PARTITIONED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Node {node.node_name} is already PARTITIONED",
        )

    node.status = "PARTITIONED"
    db.commit()

    now_iso = datetime.now(timezone.utc).isoformat()
    await manager.broadcast(
        "node_partitioned",
        {
            "node_id": node.id,
            "node_name": node.node_name,
            "timestamp": now_iso,
        },
    )

    return {
        "message": f"Node {node.node_name} is now PARTITIONED (unreachable for storage operations).",
        "node_id": node.id,
        "status": node.status,
    }
