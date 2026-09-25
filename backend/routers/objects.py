import logging
import mimetypes
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from database import get_db
from models import StoredObject, Node, Replica
from schemas import ObjectUploadResponse, ObjectSummary, ObjectVersionSummary
from services.checksum import calculate_sha256
from services.storage_manager import storage_manager
from services.replication import replicate_object
from services.connection_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/objects", tags=["objects"])


@router.post("/upload", response_model=ObjectUploadResponse)
async def upload_object(
    file: UploadFile = File(...),
    replication_factor: int = Form(default=3),
    db: Session = Depends(get_db),
):
    try:
        if not file or not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided",
            )

        contents = await file.read()
        if not contents or len(contents) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty",
            )

        if replication_factor < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="replication_factor must be at least 1",
            )

        computed_checksum = calculate_sha256(contents)
        file_size = len(contents)

        # Check if an object with this name already exists
        existing_obj = (
            db.query(StoredObject)
            .filter(StoredObject.object_name == file.filename)
            .first()
        )

        if existing_obj:
            old_version = existing_obj.version
            new_version = old_version + 1

            # Mark all old replicas for this object as stale
            db.query(Replica).filter(
                Replica.object_id == existing_obj.id,
                Replica.status != "stale",
            ).update({"status": "stale"}, synchronize_session=False)

            # Update existing object row
            existing_obj.version = new_version
            existing_obj.size = file_size
            existing_obj.checksum = computed_checksum
            existing_obj.status = "healthy"

            # Replicate new version bytes across chosen online nodes
            replicas = replicate_object(
                db=db,
                file_bytes=contents,
                object_id=existing_obj.id,
                version=new_version,
                replication_factor=existing_obj.replication_factor,
            )

            db.commit()
            db.refresh(existing_obj)

            # Gather node names for response
            node_ids = [r.node_id for r in replicas]
            nodes = db.query(Node).filter(Node.id.in_(node_ids)).all()
            node_name_map = {n.id: n.node_name for n in nodes}
            replica_names = [node_name_map.get(r.node_id, f"Node-{r.node_id}") for r in replicas]

            # Broadcast WebSocket event "object_updated"
            await manager.broadcast(
                "object_updated",
                {
                    "object_id": existing_obj.id,
                    "name": existing_obj.object_name,
                    "old_version": old_version,
                    "new_version": new_version,
                },
            )

            return {
                "object_id": existing_obj.id,
                "name": existing_obj.object_name,
                "size": existing_obj.size,
                "checksum": existing_obj.checksum,
                "replicas": replica_names,
                "status": existing_obj.status,
                "version": existing_obj.version,
            }

        # Insert metadata row in database for new object
        obj_record = StoredObject(
            object_name=file.filename,
            size=file_size,
            checksum=computed_checksum,
            version=1,
            replication_factor=replication_factor,
            status="healthy",
        )
        db.add(obj_record)
        db.flush()  # Populate obj_record.id

        # Replicate object across chosen online nodes
        replicas = replicate_object(
            db=db,
            file_bytes=contents,
            object_id=obj_record.id,
            version=obj_record.version,
            replication_factor=replication_factor,
        )

        db.commit()
        db.refresh(obj_record)

        # Gather node names for response
        node_ids = [r.node_id for r in replicas]
        nodes = db.query(Node).filter(Node.id.in_(node_ids)).all()
        node_name_map = {n.id: n.node_name for n in nodes}
        replica_names = [node_name_map.get(r.node_id, f"Node-{r.node_id}") for r in replicas]

        return {
            "object_id": obj_record.id,
            "name": obj_record.object_name,
            "size": obj_record.size,
            "checksum": obj_record.checksum,
            "replicas": replica_names,
            "status": obj_record.status,
            "version": obj_record.version,
        }
    except HTTPException:
        db.rollback()
        raise
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload object: {str(exc)}",
        )


@router.get("", response_model=List[ObjectSummary])
def list_objects(db: Session = Depends(get_db)):
    try:
        objects = db.query(StoredObject).order_by(StoredObject.id.asc()).all()
        results = []
        for obj in objects:
            # Count healthy replicas on ONLINE nodes for current version
            live_count = (
                db.query(Replica)
                .join(Node, Replica.node_id == Node.id)
                .filter(
                    Replica.object_id == obj.id,
                    Replica.version == obj.version,
                    Replica.status == "healthy",
                    Node.status == "ONLINE",
                )
                .count()
            )
            results.append({
                "id": obj.id,
                "object_name": obj.object_name,
                "size": obj.size,
                "checksum": obj.checksum,
                "version": obj.version,
                "replication_factor": obj.replication_factor,
                "live_replicas": live_count,
                "status": obj.status,
                "created_at": obj.created_at,
            })
        return results
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list objects: {str(exc)}",
        )


@router.get("/{object_id}/meta", response_model=ObjectSummary)
def get_object_metadata(object_id: int, db: Session = Depends(get_db)):
    """Exposes object metadata including live_replicas and replication_factor."""
    obj = db.query(StoredObject).filter(StoredObject.id == object_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Object {object_id} not found",
        )
    live_count = (
        db.query(Replica)
        .join(Node, Replica.node_id == Node.id)
        .filter(
            Replica.object_id == obj.id,
            Replica.version == obj.version,
            Replica.status == "healthy",
            Node.status == "ONLINE",
        )
        .count()
    )
    return {
        "id": obj.id,
        "object_name": obj.object_name,
        "size": obj.size,
        "checksum": obj.checksum,
        "version": obj.version,
        "replication_factor": obj.replication_factor,
        "live_replicas": live_count,
        "status": obj.status,
        "created_at": obj.created_at,
    }


@router.get("/{object_id}/versions", response_model=List[ObjectVersionSummary])
def get_object_versions(object_id: int, db: Session = Depends(get_db)):
    """Returns all versions of this object: version number, checksum, created_at, and whether its replicas are still live or stale."""
    obj = db.query(StoredObject).filter(StoredObject.id == object_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Object {object_id} not found",
        )

    # Query all replicas for this object ordered by version desc
    replicas = (
        db.query(Replica, Node)
        .join(Node, Replica.node_id == Node.id)
        .filter(Replica.object_id == object_id)
        .order_by(Replica.version.desc(), Replica.id.asc())
        .all()
    )

    versions_map = {}
    for replica, node in replicas:
        v = replica.version
        if v not in versions_map:
            versions_map[v] = {
                "version": v,
                "checksum": replica.checksum,
                "created_at": replica.created_at or obj.created_at,
                "total_replicas": 0,
                "live_replicas": 0,
                "has_healthy": False,
            }
        versions_map[v]["total_replicas"] += 1
        if replica.status == "healthy" and node.status == "ONLINE":
            versions_map[v]["live_replicas"] += 1
            versions_map[v]["has_healthy"] = True

    results = []
    for v in sorted(versions_map.keys(), reverse=True):
        info = versions_map[v]
        is_live = (v == obj.version) and info["has_healthy"]
        results.append(
            ObjectVersionSummary(
                version=v,
                checksum=info["checksum"],
                created_at=info["created_at"],
                status="live" if is_live else "stale",
                live_replicas=info["live_replicas"],
                total_replicas=info["total_replicas"],
            )
        )

    return results


@router.get("/{object_id}")
def download_object(object_id: int, db: Session = Depends(get_db)):
    try:
        obj_record = db.query(StoredObject).filter(StoredObject.id == object_id).first()
        if not obj_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Object {object_id} not found",
            )

        # Look up all replicas for this object where replica is healthy, current version, and parent node is ONLINE
        replica_entries = (
            db.query(Replica, Node)
            .join(Node, Replica.node_id == Node.id)
            .filter(
                Replica.object_id == object_id,
                Replica.version == obj_record.version,
                Replica.status == "healthy",
                Node.status == "ONLINE",
            )
            .order_by(Replica.id.asc())
            .all()
        )

        live_count = len(replica_entries)
        filename = str(obj_record.id)
        served_content = None

        # Try them in order: read file, verify checksum, stream if good
        for replica, node in replica_entries:
            clean_node_name = node.path.split("/")[-1]
            try:
                file_bytes = storage_manager.read_file(clean_node_name, filename)
            except Exception as exc:
                logger.warning(f"Failed to read object {object_id} from {clean_node_name}: {exc}")
                continue

            # Verify checksum on disk matches replica stored checksum
            actual_checksum = calculate_sha256(file_bytes)
            if actual_checksum != replica.checksum:
                logger.warning(
                    f"Checksum mismatch for object {object_id} on {clean_node_name}: "
                    f"expected {replica.checksum}, got {actual_checksum}"
                )
                continue

            # Healthy replica verified!
            served_content = file_bytes
            break

        # If every replica fails or none are found, return 503
        if served_content is None:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"error": "no healthy replica available for this object"},
            )

        media_type, _ = mimetypes.guess_type(obj_record.object_name)
        if not media_type:
            media_type = "application/octet-stream"

        return Response(
            content=served_content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{obj_record.object_name}"',
                "Content-Length": str(len(served_content)),
                "X-Live-Replicas": str(live_count),
                "X-Replication-Factor": str(obj_record.replication_factor),
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download object: {str(exc)}",
        )


@router.delete("/{object_id}")
def delete_object(object_id: int, db: Session = Depends(get_db)):
    try:
        obj_record = db.query(StoredObject).filter(StoredObject.id == object_id).first()
        if not obj_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Object {object_id} not found",
            )

        filename = str(obj_record.id)

        # Delete physical files from EVERY node that holds a replica
        replica_entries = (
            db.query(Replica, Node)
            .join(Node, Replica.node_id == Node.id)
            .filter(Replica.object_id == object_id)
            .all()
        )
        for replica, node in replica_entries:
            clean_node_name = node.path.split("/")[-1]
            try:
                storage_manager.delete_file(clean_node_name, filename)
            except Exception as exc:
                logger.warning(f"Error deleting file for object {object_id} on {clean_node_name}: {exc}")

        # Also clean up node1 if a legacy Phase 1 file exists
        try:
            storage_manager.delete_file("node1", filename)
        except Exception:
            pass

        # Delete replicas rows and objects row
        db.query(Replica).filter(Replica.object_id == object_id).delete()
        db.delete(obj_record)
        db.commit()

        return {"message": f"Object {object_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete object: {str(exc)}",
        )
