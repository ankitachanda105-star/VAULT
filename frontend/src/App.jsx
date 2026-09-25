import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { VaultGraph } from './components/VaultGraph';
import { UploadZone } from './components/UploadZone';
import { ControlBar } from './components/ControlBar';
import { ActivityFeed } from './components/ActivityFeed';
import { ObjectsTable } from './components/ObjectsTable';
import { wsService } from './services/websocket';
import * as api from './services/api';

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [objects, setObjects] = useState([]);
  const [summary, setSummary] = useState({});
  const [events, setEvents] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [rebalanceData, setRebalanceData] = useState(null);

  // Active particle animations on the canvas
  const [activeParticles, setActiveParticles] = useState([]);
  const [flashingNodes, setFlashingNodes] = useState([]);
  const [repairAuraNodeId, setRepairAuraNodeId] = useState(null);

  // Fetch initial cluster state
  const refreshData = async () => {
    try {
      const [nodesData, objectsData, summaryData] = await Promise.all([
        api.fetchNodes(),
        api.fetchObjects(),
        api.fetchHealthSummary(),
      ]);
      setNodes(nodesData);
      setObjects(objectsData);
      setSummary(summaryData);
    } catch (e) {
      console.warn('Error fetching cluster data', e);
    }
  };

  useEffect(() => {
    refreshData();
    wsService.connect();
    const unsubStatus = wsService.onStatusChange(setWsConnected);

    // Subscribe to all WebSocket events
    const unsubAll = wsService.subscribeAll((event) => {
      const newEvent = {
        id: `${Date.now()}-${Math.random()}`,
        event: event.event,
        data: event.data,
        timestamp: event.timestamp || new Date().toISOString(),
      };
      setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);

      // Handle custom graph animations per event type
      if (
        event.event === 'node_status_changed' ||
        event.event === 'node_failed' ||
        event.event === 'node_recovered' ||
        event.event === 'node_partitioned'
      ) {
        refreshData();
      }

      if (event.event === 'corruption_detected') {
        const nodeId = event.data?.node_id;
        if (nodeId) {
          setFlashingNodes((prev) => [...prev, nodeId]);
          setTimeout(() => {
            setFlashingNodes((prev) => prev.filter((id) => id !== nodeId));
          }, 2000);
        }
        refreshData();
      }

      if (event.event === 'repair_started') {
        const targetNodeId = event.data?.node_id;
        if (targetNodeId) {
          setRepairAuraNodeId(targetNodeId);
          triggerRepairParticle(targetNodeId);
        }
        refreshData();
      }

      if (
        event.event === 'repair_completed' ||
        event.event === 'corruption_repaired' ||
        event.event === 'object_updated'
      ) {
        setRepairAuraNodeId(null);
        refreshData();
      }

      if (event.event === 'rebalance_completed') {
        setRebalanceData(event.data);
        const moved = event.data?.objects_moved || [];
        moved.forEach((m) => {
          if (m.from_node_id && m.to_node_id) {
            triggerTransferParticle(m.from_node_id, m.to_node_id);
          }
        });
        refreshData();
      }
    });

    return () => {
      unsubStatus();
      unsubAll();
    };
  }, []);

  // Particle helper for upload distribution
  const triggerUploadParticles = (replicaNodeNames) => {
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 210;

    const newParticles = replicaNodeNames.map((name, idx) => {
      const nodeNum = parseInt(name.replace('Node-', ''), 10) || (idx + 1);
      const angle = ((nodeNum - 1) * 2 * Math.PI) / 5 - Math.PI / 2;
      const targetX = centerX + radius * Math.cos(angle);
      const targetY = centerY + radius * Math.sin(angle);

      return {
        id: `upload-${Date.now()}-${idx}`,
        startX: centerX,
        startY: centerY,
        targetX,
        targetY,
        color: '#38bdf8',
        duration: 1.2,
      };
    });

    setActiveParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setActiveParticles((prev) => prev.filter((p) => !p.id.startsWith('upload-')));
    }, 1400);
  };

  // Particle helper for repair transfer
  const triggerRepairParticle = (targetNodeId) => {
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 210;

    const angle = ((targetNodeId - 1) * 2 * Math.PI) / 5 - Math.PI / 2;
    const targetX = centerX + radius * Math.cos(angle);
    const targetY = centerY + radius * Math.sin(angle);

    const repairParticle = {
      id: `repair-${Date.now()}`,
      startX: centerX,
      startY: centerY,
      targetX,
      targetY,
      color: '#f59e0b',
      duration: 1.4,
    };

    setActiveParticles((prev) => [...prev, repairParticle]);
    setTimeout(() => {
      setActiveParticles((prev) => prev.filter((p) => p.id !== repairParticle.id));
    }, 1600);
  };

  // Particle helper for node-to-node rebalancing transfer
  const triggerTransferParticle = (fromNodeId, toNodeId) => {
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 210;

    const angle1 = ((fromNodeId - 1) * 2 * Math.PI) / 5 - Math.PI / 2;
    const startX = centerX + radius * Math.cos(angle1);
    const startY = centerY + radius * Math.sin(angle1);

    const angle2 = ((toNodeId - 1) * 2 * Math.PI) / 5 - Math.PI / 2;
    const targetX = centerX + radius * Math.cos(angle2);
    const targetY = centerY + radius * Math.sin(angle2);

    const transferParticle = {
      id: `rebalance-${Date.now()}-${Math.random()}`,
      startX,
      startY,
      targetX,
      targetY,
      color: '#818cf8',
      duration: 1.5,
    };

    setActiveParticles((prev) => [...prev, transferParticle]);
    setTimeout(() => {
      setActiveParticles((prev) => prev.filter((p) => p.id !== transferParticle.id));
    }, 1700);
  };

  // Upload handler
  const handleUpload = async (file, replicationFactor) => {
    try {
      setIsUploading(true);
      const res = await api.uploadObject(file, replicationFactor);
      
      if (res.replicas && res.replicas.length > 0) {
        triggerUploadParticles(res.replicas);
      }

      const isUpdate = Boolean(res.version && res.version > 1);
      setEvents((prev) => [
        {
          id: `${Date.now()}-up`,
          event: isUpdate ? 'object_updated' : 'upload',
          message: isUpdate
            ? `Object '${res.name}' upgraded to v${res.version} across [${res.replicas.join(', ')}]`
            : `Uploaded '${res.name}' (${res.size} B) across [${res.replicas.join(', ')}]`,
          data: { object_id: res.object_id, node_name: res.replicas.join(', '), version: res.version },
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);

      await refreshData();
    } catch (err) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (objectId, filename) => {
    try {
      await api.downloadObject(objectId, filename);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleDelete = async (objectId) => {
    if (!window.confirm(`Delete object #${objectId} across all replica nodes?`)) return;
    try {
      await api.deleteObject(objectId);
      await refreshData();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleVerify = async (objectId) => {
    try {
      setVerifyingId(objectId);
      await api.verifyObject(objectId);
      await refreshData();
    } catch (err) {
      alert(`Verify error: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSimulateFailure = async (nodeId) => {
    try {
      await api.simulateNodeFailure(nodeId);
      await refreshData();
    } catch (err) {
      alert(`Failed to simulate outage: ${err.message}`);
    }
  };

  const handleSimulatePartition = async (nodeId) => {
    try {
      await api.simulatePartition(nodeId);
      await refreshData();
    } catch (err) {
      alert(`Failed to simulate partition: ${err.message}`);
    }
  };

  const handleRecover = async (nodeId) => {
    try {
      await api.recoverNode(nodeId);
      await refreshData();
    } catch (err) {
      alert(`Failed to recover node: ${err.message}`);
    }
  };

  const handleSimulateCorruption = async (objectId, nodeId) => {
    try {
      await api.simulateCorruption(objectId, nodeId);
      setFlashingNodes((prev) => [...prev, nodeId]);
      setTimeout(() => {
        setFlashingNodes((prev) => prev.filter((id) => id !== nodeId));
      }, 2000);
      await refreshData();
    } catch (err) {
      alert(`Failed to inject bit rot: ${err.message}`);
    }
  };

  const handleManualRepair = async () => {
    try {
      await api.triggerRepairAll();
      await refreshData();
    } catch (err) {
      alert(`Repair error: ${err.message}`);
    }
  };

  const handleRebalance = async () => {
    try {
      const res = await api.triggerRebalance();
      setRebalanceData(res);
      const moved = res.objects_moved || [];
      moved.forEach((m) => {
        if (m.from_node_id && m.to_node_id) {
          triggerTransferParticle(m.from_node_id, m.to_node_id);
        }
      });
      await refreshData();
    } catch (err) {
      alert(`Rebalance error: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0e14] text-slate-100 overflow-hidden font-sans">
      {/* Top Status Bar */}
      <TopBar
        nodes={nodes}
        summary={summary}
        wsConnected={wsConnected}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: The Living Graph Centerpiece + Bottom Action Controls */}
        <div className="flex-1 flex flex-col min-w-0 h-full border-r border-slate-800/80">
          <div className="flex-1 relative min-h-0">
            <VaultGraph
              nodes={nodes}
              objects={objects}
              activeParticles={activeParticles}
              flashingNodes={flashingNodes}
              repairAuraNodeId={repairAuraNodeId}
            />
          </div>

          {/* Bottom Control Bar & Ingestion Zone */}
          <div className="p-4 bg-[#0d131c] border-t border-slate-800/80 space-y-3 z-20">
            <ControlBar
              nodes={nodes}
              objects={objects}
              onSimulateFailure={handleSimulateFailure}
              onRecover={handleRecover}
              onSimulateCorruption={handleSimulateCorruption}
              onManualRepair={handleManualRepair}
              onRebalance={handleRebalance}
              rebalanceData={rebalanceData}
              onClearRebalance={() => setRebalanceData(null)}
              onSimulatePartition={handleSimulatePartition}
            />
            <UploadZone onUpload={handleUpload} isUploading={isUploading} />
          </div>
        </div>

        {/* Right Collapsible Panel: Activity Feed + Objects Catalog */}
        {isPanelOpen && (
          <aside className="w-[480px] xl:w-[540px] flex flex-col h-full bg-[#0a0e14] p-4 gap-4 overflow-hidden shrink-0">
            <div className="h-[46%] min-h-[220px]">
              <ActivityFeed events={events} />
            </div>

            <div className="flex-1 min-h-[260px]">
              <ObjectsTable
                objects={objects}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onVerify={handleVerify}
                verifyingId={verifyingId}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
