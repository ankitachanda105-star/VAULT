const BASE_URL = 'http://127.0.0.1:8000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    let errMessage = `HTTP ${response.status}`;
    try {
      const errData = await response.json();
      errMessage = errData.detail || errData.error || errMessage;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }
  return response;
}

export async function fetchNodes() {
  const res = await request('/nodes');
  return res.json();
}

export async function fetchHealthSummary() {
  const res = await request('/health/summary');
  return res.json();
}

export async function fetchObjects() {
  const res = await request('/objects');
  return res.json();
}

export async function fetchObjectVersions(objectId) {
  const res = await request(`/objects/${objectId}/versions`);
  return res.json();
}

export async function uploadObject(file, replicationFactor = 3) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('replication_factor', replicationFactor);

  const res = await request('/objects/upload', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function downloadObject(objectId, filename) {
  const res = await request(`/objects/${objectId}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `object_${objectId}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function deleteObject(objectId) {
  const res = await request(`/objects/${objectId}`, { method: 'DELETE' });
  return res.json();
}

export async function verifyObject(objectId) {
  const res = await request(`/objects/${objectId}/verify`);
  return res.json();
}

export async function simulateNodeFailure(nodeId) {
  const res = await request(`/nodes/${nodeId}/simulate-failure`, { method: 'POST' });
  return res.json();
}

export async function recoverNode(nodeId) {
  const res = await request(`/nodes/${nodeId}/recover`, { method: 'POST' });
  return res.json();
}

export async function simulateCorruption(objectId, nodeId) {
  const res = await request(`/objects/${objectId}/simulate-corruption?node_id=${nodeId}`, {
    method: 'POST',
  });
  return res.json();
}

export async function triggerRepairAll() {
  const res = await request('/repair/all', { method: 'POST' });
  return res.json();
}

export async function triggerRebalance() {
  const res = await request('/rebalance', { method: 'POST' });
  return res.json();
}

export async function simulatePartition(nodeId) {
  const res = await request(`/nodes/${nodeId}/simulate-partition`, { method: 'POST' });
  return res.json();
}
