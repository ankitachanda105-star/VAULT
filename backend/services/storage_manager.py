from pathlib import Path
from typing import List, Optional
import os

STORAGE_ROOT = Path(__file__).resolve().parent.parent / "storage"


class StorageManager:
    def __init__(self, root_dir: Path = STORAGE_ROOT):
        self.root_dir = root_dir
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def get_node_dir(self, node_id_or_path: str) -> Path:
        # Handles both "node1" and "storage/node1"
        clean_name = Path(node_id_or_path).name
        node_dir = self.root_dir / clean_name
        node_dir.mkdir(parents=True, exist_ok=True)
        return node_dir

    def get_file_path(self, node_id: str, filename: str) -> Path:
        return self.get_node_dir(node_id) / filename

    def file_exists(self, node_id: str, filename: str) -> bool:
        return self.get_file_path(node_id, filename).is_file()

    def save_file(self, node_id: str, filename: str, data: bytes) -> Path:
        file_path = self.get_file_path(node_id, filename)
        temp_path = file_path.with_suffix(".tmp")
        try:
            with open(temp_path, "wb") as f:
                f.write(data)
            temp_path.replace(file_path)
            return file_path
        except Exception:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise

    def read_file(self, node_id: str, filename: str) -> bytes:
        file_path = self.get_file_path(node_id, filename)
        if not file_path.is_file():
            raise FileNotFoundError(f"File '{filename}' not found on node '{node_id}'")
        with open(file_path, "rb") as f:
            return f.read()

    def delete_file(self, node_id: str, filename: str) -> bool:
        file_path = self.get_file_path(node_id, filename)
        if file_path.is_file():
            file_path.unlink()
            return True
        return False

    def get_node_used_storage(self, node_id_or_path: str) -> int:
        """Compute total bytes of files stored on disk for this node (excluding .gitkeep)."""
        node_dir = self.get_node_dir(node_id_or_path)
        total_bytes = 0
        if node_dir.is_dir():
            for item in node_dir.iterdir():
                if item.is_file() and item.name != ".gitkeep":
                    try:
                        total_bytes += item.stat().st_size
                    except OSError:
                        pass
        return total_bytes

    def choose_node(self, count: int = 1, db = None):
        return choose_node(count=count, db=db)


storage_manager = StorageManager()


def choose_node(count: int = 1, db = None):
    """
    Selects `count` distinct nodes with status == 'ONLINE', preferring ones
    with the lowest live used_storage. Raises ValueError if fewer than
    `count` ONLINE nodes are available.
    """
    from database import SessionLocal
    from models import Node

    close_session = False
    if db is None:
        db = SessionLocal()
        close_session = True

    try:
        online_nodes = db.query(Node).filter(Node.status == "ONLINE").all()
        if len(online_nodes) < count:
            raise ValueError(
                f"Insufficient online nodes: requested {count}, but only {len(online_nodes)} online node(s) available."
            )

        # Compute live used storage and sort by (live_used_storage, node.id)
        def sort_key(n: Node):
            live_used = storage_manager.get_node_used_storage(n.path)
            return (live_used, n.id)

        sorted_nodes = sorted(online_nodes, key=sort_key)
        # Update used_storage attribute on returned nodes
        selected = sorted_nodes[:count]
        for node in selected:
            node.used_storage = storage_manager.get_node_used_storage(node.path)
        return selected
    finally:
        if close_session:
            db.close()
