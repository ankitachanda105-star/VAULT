from typing import List
from sqlalchemy.orm import Session

from models import Replica, Node
from services.checksum import calculate_sha256
from services.storage_manager import storage_manager, choose_node


def replicate_object(
    db: Session,
    file_bytes: bytes,
    object_id: int,
    version: int = 1,
    replication_factor: int = 3,
) -> List[Replica]:
    """
    Picks distinct ONLINE nodes via choose_node, writes the file to each node's
    folder, recomputes SHA-256 independently from each written file, and inserts
    one replicas row per node. Rolls back writes on failure.
    """
    # Pick distinct ONLINE nodes
    chosen_nodes = choose_node(count=replication_factor, db=db)

    written_locations = []  # List of (clean_node_name, filename) for cleanup on error
    created_replicas = []

    try:
        filename = str(object_id)
        for node in chosen_nodes:
            clean_node_name = node.path.split("/")[-1]

            # Save the file to this node's folder
            storage_manager.save_file(clean_node_name, filename, file_bytes)
            written_locations.append((clean_node_name, filename))

            # Independently read from disk and recompute SHA-256 for that specific node's folder
            written_bytes = storage_manager.read_file(clean_node_name, filename)
            replica_checksum = calculate_sha256(written_bytes)

            replica = Replica(
                object_id=object_id,
                node_id=node.id,
                checksum=replica_checksum,
                version=version,
                status="healthy",
            )
            db.add(replica)
            created_replicas.append(replica)

        db.flush()
        return created_replicas

    except Exception:
        # Roll back partial physical writes on disk
        for node_name, fname in written_locations:
            try:
                storage_manager.delete_file(node_name, fname)
            except Exception:
                pass
        raise
