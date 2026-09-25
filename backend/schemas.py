from datetime import datetime
from typing import List
from pydantic import BaseModel, ConfigDict


class ObjectUploadResponse(BaseModel):
    object_id: int
    name: str
    size: int
    checksum: str
    replicas: List[str]
    status: str
    version: int = 1


class ObjectVersionSummary(BaseModel):
    version: int
    checksum: str
    created_at: datetime | None = None
    status: str  # "live" or "stale"
    live_replicas: int
    total_replicas: int


class ObjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    object_name: str
    size: int
    checksum: str
    version: int
    replication_factor: int
    live_replicas: int
    status: str
    created_at: datetime


class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_name: str
    path: str
    status: str
    total_storage: int
    used_storage: int
    last_heartbeat: datetime


class ChooseNodeResponse(BaseModel):
    requested_count: int
    selected_nodes: List[NodeResponse]


class HealthNodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_name: str
    status: str
    last_heartbeat: datetime
    used_storage: int
    total_storage: int


class HealthSummaryResponse(BaseModel):
    total_nodes: int
    online: int
    failed: int
    total_objects: int
    healthy_objects: int
    degraded_objects: int
