import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from database import engine, SessionLocal, Base
from models import Node
from routers import objects, nodes, health, websocket, repair, corruption, rebalance
from services.storage_manager import storage_manager
from services.health_monitor import run_health_monitor


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables on startup
    Base.metadata.create_all(bind=engine)

    # Ensure storage folders node1..node5 exist under backend/storage
    for i in range(1, 6):
        storage_manager.get_node_dir(f"node{i}")

    # Seed nodes table with 5 rows (Node-1..Node-5) ONLY if empty
    with SessionLocal() as db:
        node_count = db.query(Node).count()
        if node_count == 0:
            default_nodes = [
                Node(
                    node_name=f"Node-{i}",
                    path=f"storage/node{i}",
                    status="ONLINE",
                    total_storage=10 * 1024 * 1024 * 1024,
                    used_storage=storage_manager.get_node_used_storage(f"node{i}"),
                    last_heartbeat=datetime.now(timezone.utc),
                )
                for i in range(1, 6)
            ]
            db.add_all(default_nodes)
            db.commit()

    # Start non-blocking background health & integrity monitor task
    monitor_task = asyncio.create_task(run_health_monitor(interval_seconds=5))

    yield

    # Cleanly cancel background monitor on shutdown
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="VAULT - Fault-Tolerant Distributed Object Storage",
    description="Phase 7: Living Vault Dashboard and Multi-Node Storage Cluster",
    version="7.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "internal server error", "detail": str(exc)},
    )


# Register routers
app.include_router(objects.router)
app.include_router(nodes.router)
app.include_router(health.router)
app.include_router(websocket.router)
app.include_router(repair.router)
app.include_router(corruption.router)
app.include_router(rebalance.router)


@app.get("/")
def root():
    return {
        "system": "VAULT",
        "phase": 6,
        "description": "Fault-tolerant distributed object storage - Phase 6 corruption detection & repair",
        "nodes": 5,
        "status": "online",
    }
