import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Toast Notification state
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ id: Date.now(), message });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  };

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

      // Handle custom graph animations & toasts per event type
      if (
        event.event === 'node_status_changed' ||
        event.event === 'node_failed' ||
        event.event === 'node_recovered' ||
        event.event === 'node_partitioned'
      ) {
        refreshData();
      }

      if (event.event === 'node_failed') {
        const name = event.data?.node_name || (event.data?.node_id ? `Node-${event.data.node_id}` : 'Node');
        showToast(`${name} went offline!`);
      }

      if (event.event === 'node_recovered') {
        const name = event.data?.node_name || (event.data?.node_id ? `Node-${event.data.node_id}` : 'Node');
        showToast(`${name} recovered and back online`);
      }

      if (event.event === 'corruption_detected') {
        const nodeId = event.data?.node_id;
        if (nodeId) {
          setFlashingNodes((prev) => [...prev, nodeId]);
          setTimeout(() => {
            setFlashingNodes((prev) => prev.filter((id) => id !== nodeId));
          }, 2000);
        }
        showToast(`Bit rot detected on Node-${nodeId}!`);
        refreshData();
      }

      if (event.event === 'repair_started') {
        const targetNodeId = event.data?.node_id;
        if (targetNodeId) {
          setRepairAuraNodeId(targetNodeId);
          triggerRepairParticle(targetNodeId);
        }
        showToast(`Auto-repair initiated for Node-${targetNodeId}`);
        refreshData();
      }

      if (
        event.event === 'repair_completed' ||
        event.event === 'corruption_repaired' ||
        event.event === 'object_updated'
      ) {
        setRepairAuraNodeId(null);
        if (event.event === 'repair_completed') {
          showToast('Quorum restored — Auto-repair complete');
        } else if (event.event === 'corruption_repaired') {
          showToast('Bit rot repaired and verified');
        }
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
        showToast(`Storage rebalanced: moved ${moved.length} object(s)`);
        refreshData();
      }
    });

    return () => {
      unsubStatus();
      unsubAll();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Particle helper for upload distribution (cyan)
  const triggerUploadParticles = (replicaNodeNames) => {
    const width = 800;
    const height = 580;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 205;

    const newParticles = replicaNodeNames.map((name, idx) => {
      const nodeNum = parseInt(String(name).replace('Node-', ''), 10) || (idx + 1);
      const angle = ((nodeNum - 1) * 2 * Math.PI) / 5 - Math.PI / 2;
      const targetX = centerX + radius * Math.cos(angle);
      const targetY = centerY + radius * Math.sin(angle);

      return {
        id: `upload-${Date.now()}-${idx}`,
        startX: centerX,
        startY: centerY,
        targetX,
        targetY,
        color: '#22d3ee', // Cyan
        duration: 1.2,
      };
    });

    setActiveParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setActiveParticles((prev) => prev.filter((p) => !p.id.startsWith('upload-')));
    }, 1400);
  };

  // Particle helper for repair transfer (amber)
  const triggerRepairParticle = (targetNodeId) => {
    const width = 800;
    const height = 580;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 205;

    const angle = ((targetNodeId - 1) * 2 * Math.PI) / 5 - Math.PI / 2;
    const targetX = centerX + radius * Math.cos(angle);
    const targetY = centerY + radius * Math.sin(angle);

    const repairParticle = {
      id: `repair-${Date.now()}`,
      startX: centerX,
      startY: centerY,
      targetX,
      targetY,
      color: '#f59e0b', // Amber
      duration: 1.4,
    };

    setActiveParticles((prev) => [...prev, repairParticle]);
    setTimeout(() => {
      setActiveParticles((prev) => prev.filter((p) => p.id !== repairParticle.id));
    }, 1600);
  };

  // Particle helper for node-to-node rebalancing transfer (violet)
  const triggerTransferParticle = (fromNodeId, toNodeId) => {
    const width = 800;
    const height = 580;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 205;

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
      color: '#a78bfa', // Violet
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
      showToast(isUpdate ? `Updated '${res.name}' to v${res.version}` : `Uploaded '${res.name}' across ${res.replicas.length} nodes`);

      setEvents((prev) => [
        {
          id: `${Date.now()}-up`,
          event: isUpdate ? 'object_updated' : 'upload',
          message: isUpdate
            ? `Object '${res.name}' upgraded to v${res.version} across [${res.replicas.join(', ')}]`
            : `Uploaded '${res.name}' (${res.size} B) across [${res.replicas.join(', ')}]`,
          data: { object_name: res.name, node_name: res.replicas.join(', '), version: res.version, size: res.size },
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
      showToast(`Downloading '${filename}'...`);
      await api.downloadObject(objectId, filename);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleDelete = async (objectId) => {
    if (!window.confirm(`Delete object #${objectId} across all replica nodes?`)) return;
    try {
      await api.deleteObject(objectId);
      showToast(`Object #${objectId} removed from all nodes`);
      await refreshData();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleVerify = async (objectId) => {
    try {
      setVerifyingId(objectId);
      const res = await api.verifyObject(objectId);
      showToast(res.status === 'repaired' ? 'Corrupted replica repaired successfully!' : 'All replicas bit-accurate & verified');
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
      showToast(`Node-${nodeId} outage simulated`);
      await refreshData();
    } catch (err) {
      alert(`Failed to simulate outage: ${err.message}`);
    }
  };

  const handleSimulatePartition = async (nodeId) => {
    try {
      await api.simulatePartition(nodeId);
      showToast(`Node-${nodeId} partitioned from network`);
      await refreshData();
    } catch (err) {
      alert(`Failed to simulate partition: ${err.message}`);
    }
  };

  const handleRecover = async (nodeId) => {
    try {
      await api.recoverNode(nodeId);
      showToast(`Node-${nodeId} recovered`);
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
      showToast(`Bit rot injected on Node-${nodeId}`);
      await refreshData();
    } catch (err) {
      alert(`Failed to inject bit rot: ${err.message}`);
    }
  };

  const handleManualRepair = async () => {
    try {
      await api.triggerRepairAll();
      showToast('Cluster repair initiated across all objects');
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
      showToast(moved.length > 0 ? `Rebalanced ${moved.length} objects` : 'Cluster already balanced');
      await refreshData();
    } catch (err) {
      alert(`Rebalance error: ${err.message}`);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-screen bg-[var(--bg-0)] text-slate-100 overflow-hidden font-sans select-none">
      {/* Background Ambient Layers (Fixed position, pointer-events none) */}
      <div className="ambient-background">
        <div className="ambient-glow-cyan" />
        <div className="ambient-glow-violet" />
        <div className="ambient-grid" />
      </div>

      {/* Top Status Bar */}
      <TopBar
        nodes={nodes}
        summary={summary}
        wsConnected={wsConnected}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden z-10">
        {/* Left: Living Graph Centerpiece + Bottom Action Controls */}
        <div className="flex-1 flex flex-col min-w-0 h-full border-r border-[var(--line)]">
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
          <div className="p-4 bg-[#0c1118]/70 backdrop-blur-md border-t border-[var(--line)] space-y-3 z-20">
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
          <aside className="w-[490px] xl:w-[560px] flex flex-col h-full bg-[#07090d]/60 backdrop-blur-sm p-4 gap-4 overflow-hidden shrink-0">
            <div className="h-[46%] min-h-[220px]">
              <ActivityFeed
                events={events}
                onClear={() => setEvents([])}
              />
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

      {/* Toast Notification Component (Bottom-Center, Slide-Up Glass Panel) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 glass-panel border border-cyan-500/40 text-slate-100 shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_20px_rgba(34,211,238,0.2)] text-xs font-sans pointer-events-none"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 pulse-dot-cyan shrink-0" />
            <span className="font-medium tracking-wide">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
