from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class StoredObject(Base):
    __tablename__ = "objects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    object_name = Column(String, nullable=False)
    size = Column(Integer, nullable=False)
    checksum = Column(String(64), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    replication_factor = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    status = Column(String, default="healthy", nullable=False)

    replicas = relationship("Replica", back_populates="object", cascade="all, delete-orphan")


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    node_name = Column(String, nullable=False, unique=True)
    path = Column(String, nullable=False)
    status = Column(String, default="ONLINE", nullable=False)
    total_storage = Column(Integer, default=10 * 1024 * 1024 * 1024, nullable=False)
    used_storage = Column(Integer, default=0, nullable=False)
    last_heartbeat = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    replicas = relationship("Replica", back_populates="node")


class Replica(Base):
    __tablename__ = "replicas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(Integer, ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    checksum = Column(String(64), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    status = Column(String, default="healthy", nullable=False)  # "healthy", "corrupted", "missing", or "stale"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    object = relationship("StoredObject", back_populates="replicas")
    node = relationship("Node", back_populates="replicas")
