import hashlib
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Replica


def calculate_sha256(data: bytes) -> str:
    """Calculate SHA-256 hex digest of in-memory bytes."""
    return hashlib.sha256(data).hexdigest()


def calculate_file_sha256(file_path: Path, chunk_size: int = 65536) -> str:
    """Calculate SHA-256 hex digest of a file on disk by reading in chunks."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest()


def verify_replica(replica: "Replica") -> bool:
    """
    Pure function: Reads the file from that replica's node folder,
    recomputes SHA-256, and compares to the stored replica checksum.
    Returns True if matches, False otherwise. No side effects.
    """
    from services.storage_manager import storage_manager
    from database import SessionLocal
    from models import Node

    node = replica.node
    if not node:
        # Fallback query if relationship is not loaded
        with SessionLocal() as db:
            node = db.query(Node).filter(Node.id == replica.node_id).first()

    if not node:
        return False

    clean_node_name = node.path.split("/")[-1]
    filename = str(replica.object_id)
    try:
        file_bytes = storage_manager.read_file(clean_node_name, filename)
        return calculate_sha256(file_bytes) == replica.checksum
    except Exception:
        return False
