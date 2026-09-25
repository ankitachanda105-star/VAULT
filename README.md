# VAULT — Fault-Tolerant Distributed Object Storage System

VAULT is an enterprise-grade, fault-tolerant distributed object-storage system featuring a Python FastAPI backend and a real-time reactive React dashboard ("The Living Vault").

---

## Architecture Overview

### Phase 1: Single-Node Storage Baseline
- Object storage operations: Upload (`POST /objects/upload`), Download (`GET /objects/{id}`), Delete (`DELETE /objects/{id}`), and List (`GET /objects`).
- Integrity verification using SHA-256 with corruption detection.

### Phase 2: Multiple Simulated Storage Nodes
- 5 simulated independent node storage folders: `storage/node1` through `storage/node5`.
- `nodes` metadata table tracking node status (`ONLINE` / `FAILED`), storage capacity (10 GB default), live used storage, and heartbeat.
- Dynamic `choose_node(count=1)` selection preferring least-used online nodes.
- Node endpoints: `GET /nodes`, `GET /nodes/{node_id}`, and sanity-check endpoint `GET /nodes/choose-test?count=3`.

### Phase 3: Multi-Node Replication & Failover
- `replicas` metadata table tracking replica placement (`object_id`, `node_id`, `checksum`, `version`, `status`).
- Dynamic multi-node replication: `POST /objects/upload` replicates files across `replication_factor` (default 3) distinct ONLINE nodes.
- Independent SHA-256 verification per written file on disk.
- Automatic download failover: `GET /objects/{id}` inspects healthy replicas on ONLINE nodes in order and streams the first valid replica. Returns HTTP 503 if no replica is available.
- Distributed deletion: `DELETE /objects/{id}` purges the file from all replica node storage folders and removes database records from both `objects` and `replicas`.

### Phase 4: Real-Time Health Monitoring & WebSocket Dashboard
- Non-blocking background health monitor running in FastAPI lifespan every 5 seconds.
- Liveness tracking: Updates `last_heartbeat` for nodes whose folders are accessible; marks nodes `FAILED` if their folder is missing.
- Broadcasts `"node_status_changed"` events over `/ws/dashboard`.
- Health endpoints: `GET /health/nodes` (node health view) and `GET /health/summary` (cluster summary).

### Phase 5: Failure Simulation & Automatic Self-Healing Repair
- Failure Simulation: `POST /nodes/{node_id}/simulate-failure` marks a node `FAILED` without deleting disk files, emits `node_failed` event, and triggers auto-repair.
- Node Recovery: `POST /nodes/{node_id}/recover` restores a node back to `ONLINE` and emits `node_recovered` event.
- Self-Healing Repair Engine: `services/repair.py` detects degraded objects (`live_replicas < replication_factor`), picks a new online target node (excluding nodes already holding a replica), streams bytes from a healthy replica, computes fresh SHA-256, creates a new replica record, and emits `repair_started` and `repair_completed` events.
- On-Demand Manual Repair: `POST /repair/{object_id}` and `POST /repair/all`.

### Phase 6: Data Corruption Detection & Bit Rot Self-Healing
- Corruption Simulation: `POST /objects/{object_id}/simulate-corruption?node_id=X` mutates file bytes directly on disk without altering database checksums.
- Pure Checksum Verification: `services/checksum.py` provides `verify_replica(replica) -> bool`.
- Periodic Integrity Scanner: Background loop scans healthy replicas on online nodes every 10 seconds.
- On-Demand Verification Endpoint: `GET /objects/{object_id}/verify` inspects all replicas, marks corrupted replicas, broadcasts events, and triggers self-healing repair.
- Event Order: Emits `corruption_detected` → `repair_started` → `repair_completed` → `corruption_repaired` over `/ws/dashboard`.

### Phase 7: The Living Vault — Interactive React Dashboard
- **Stack:** Vite, React 18, Tailwind CSS, Framer Motion, Lucide Icons.
- **Topology Visualization:** Symmetrical SVG pentagon layout dynamically representing cluster state. Nodes dynamically scale with storage utilization, pulsating amber aura on healing, and flash red on bit-rot corruption.
- **Traveling Particles:** Ingestion particles stream from the central hub into selected nodes upon upload; amber healing particles transfer data across nodes during repair.
- **Live Control Bar:** Interactive chaos panel allowing on-the-fly node outages (`Kill Node`), instant recovery (`Heal Node`), silent bit rot injection (`Inject Bit Rot`), and cluster-wide repair sweeps.
- **Real-Time Activity Feed:** Auto-scrolling, color-coded audit log capturing every heartbeat, failure, replication, corruption detection, and healing event via persistent WebSocket with auto-reconnection.
- **Cluster Object Catalog:** High-density inventory displaying real-time replica ratios (`live/total`), SHA-256 hashes, failover download triggers, and on-demand per-object integrity verifications.

### Phase 8: Advanced Resilience, Polish & Cluster Orchestration
- **Piece 1 — Version Management:**
  - Re-uploading an existing filename automatically increments `version`, recomputes SHA-256, replicates bytes across a fresh set of nodes, and marks old replicas `stale`.
  - Endpoint `GET /objects/{id}/versions` provides comprehensive version audit trails (version number, checksum, timestamp, live/stale status, and replica counts).
  - Downloads consistently serve the latest version's healthy replicas.
  - Interactive UI version badges (`v1`, `v2`) and expandable version history drawer.
- **Piece 2 — Storage Rebalancing:**
  - Endpoint `POST /rebalance` computes storage utilization across all online nodes, detects imbalances, and moves object replicas from the most-used to the least-used node.
  - Emits `rebalance_completed` event and animates node-to-node transfer particles across the cluster topology.
  - Interactive before/after horizontal utilization bar charts in the control panel.
- **Piece 3 — Network Partition Simulation:**
  - Endpoint `POST /nodes/{id}/simulate-partition` transitions a node to `PARTITIONED` status.
  - Health monitor continues detecting physical directory presence and updates `last_heartbeat` (simulating network disconnection while process remains alive).
  - Storage downloads and repairs transparently bypass partitioned nodes without marking them permanently failed.
  - Graph visualization renders a distinct rotating dashed purple ring and `PARTITION` badge.
  - Unified recovery via `POST /nodes/{id}/recover` restores both failed and partitioned nodes to `ONLINE`.

---

## Project Structure

```
vault/
├── backend/
│   ├── main.py              # FastAPI app, CORS middleware, lifespan background monitors
│   ├── database.py          # SQLAlchemy SQLite engine/session setup (vault.db)
│   ├── models.py            # StoredObject ('objects'), Node ('nodes'), Replica ('replicas')
│   ├── schemas.py           # Pydantic schemas for objects, replicas, nodes, health, & versions
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── objects.py       # Object upload, versioning, download (failover), delete, & versions
│   │   ├── nodes.py         # Nodes listing, simulate-failure, recover, & simulate-partition
│   │   ├── health.py        # GET /health/nodes & GET /health/summary
│   │   ├── websocket.py     # Real-time WebSocket endpoint /ws/dashboard
│   │   ├── repair.py        # POST /repair/{id} & POST /repair/all
│   │   ├── corruption.py    # POST /objects/{id}/simulate-corruption & GET /objects/{id}/verify
│   │   └── rebalance.py     # POST /rebalance (storage utilization equalizer)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── storage_manager.py    # Disk I/O, live size calculation, & choose_node()
│   │   ├── checksum.py           # SHA-256 helper & pure verify_replica()
│   │   ├── replication.py        # Multi-node replication service (replicate_object)
│   │   ├── connection_manager.py # Reusable WebSocket pub/sub ConnectionManager
│   │   ├── health_monitor.py     # Heartbeat loop & periodic integrity scanner
│   │   └── repair.py             # Repair engine (repair_object, detect_and_repair_replica)
│   ├── storage/
│   │   └── node1..node5/    # 5 simulated node storage directories
│   └── vault.db             # SQLite database
├── frontend/
│   ├── index.html           # Single-page application entrypoint
│   ├── vite.config.js       # Vite configuration with dev server setup
│   ├── tailwind.config.js   # Tailwind custom dark theme & colors
│   ├── postcss.config.js    # PostCSS configuration
│   ├── package.json         # React 18, Framer Motion, Lucide-react, Tailwind
│   └── src/
│       ├── main.jsx         # React DOM bootstrap
│       ├── App.jsx          # Living Vault main dashboard application
│       ├── index.css        # Tailwind directives and custom scrollbars
│       ├── components/
│       │   ├── TopBar.jsx       # Cluster health banner & WebSocket status
│       │   ├── VaultGraph.jsx   # Pentagon topology, particles & partitioned styling
│       │   ├── UploadZone.jsx   # Drag-and-drop file ingestion & replica selector
│       │   ├── ControlBar.jsx   # Chaos controls, partition button & rebalance chart
│       │   ├── ActivityFeed.jsx # Real-time event log
│       │   └── ObjectsTable.jsx # Object catalog with version badges & history drawer
│       ├── services/
│       │   ├── api.js           # REST API client
│       │   └── websocket.js     # Resilient auto-reconnecting WebSocket client
│       └── utils/
│           └── formatters.js    # Byte size and checksum formatters
├── requirements.txt
└── README.md
```

---

## How to Run Backend and Frontend

### 1. Start the Backend Server (Terminal 1)
```bash
cd vault/backend
py -3.13 -m uvicorn main:app --port 8000
```
- API Base URL: `http://127.0.0.1:8000`
- Interactive API Docs: `http://127.0.0.1:8000/docs`
- WebSocket Feed: `ws://127.0.0.1:8000/ws/dashboard`

### 2. Start the Frontend Dashboard (Terminal 2)
```bash
cd vault/frontend
npm.cmd run dev
```
*(On non-Windows systems, run `npm run dev`)*
- Web Dashboard: `http://localhost:5173`

---

## Demonstration Walkthrough

1. **Version Management:**
   - Upload `notes.txt` (content: `Version 1`). Observe badge `v1`.
   - Re-upload `notes.txt` (content: `Version 2`). Badge updates to `v2`, event `object_updated` appears in the feed, and old replicas are marked `stale`.
   - Click the **History** button on the row to view the full version history drawer with timestamps, hashes, and live/stale statuses.
   - Download the file to verify it bit-accurately delivers `Version 2`.

2. **Storage Rebalancing:**
   - Upload several files to create an imbalance between storage nodes.
   - Click **Rebalance** in the control panel.
   - Purple transfer particles travel between nodes on the graph.
   - An inline comparison bar chart displays storage before vs after, noting moved objects.

3. **Network Partitioning:**
   - In the control panel, select an active node and click **Partition**.
   - The node transitions to purple with a rotating dashed outline and status `PARTITION`.
   - Health heartbeats continue to register live timestamps, but download requests transparently failover to online peers.
   - Click **Heal** to clear the partition and return the node to `ONLINE`.
