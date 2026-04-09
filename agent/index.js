import axios from "axios";
import si from "systeminformation";
import dotenv from "dotenv";
import Docker from "dockerode";

dotenv.config();

const docker = new Docker();

const BACKEND_URL = process.env.BACKEND_URL;
const CONTAINER_BACKEND_URL =
  process.env.CONTAINER_BACKEND_URL || "http://localhost:8000/api/metrics/containers";

const SYSTEM_ID = process.env.SYSTEM_ID || "machine-001";
const HOSTNAME = process.env.HOSTNAME || "local-machine";
const OS_NAME = process.env.OS_NAME || "Unknown OS";
const AGENT_VERSION = process.env.AGENT_VERSION || "1.0.0";
const INTERVAL_MS = Number(process.env.INTERVAL_MS) || 5000;

const sendSystemMetrics = async () => {
  try {
    const load = await si.currentLoad();
    const mem = await si.mem();
    const time = await si.time();

    const memoryPercent = (mem.used / mem.total) * 100;

    const payload = {
      systemId: SYSTEM_ID,
      hostname: HOSTNAME,
      osName: OS_NAME,
      agentVersion: AGENT_VERSION,
      cpu: Number(load.currentLoad.toFixed(2)),
      memory: Number(memoryPercent.toFixed(2)),
      uptime: Math.floor(time.uptime),
      timestamp: new Date().toISOString(),
    };

    console.log("Sending system metrics:", payload);

    await axios.post(BACKEND_URL, payload);
  } catch (error) {
    console.error(
      "Failed to send system metrics:",
      error.response?.data || error.message
    );
  }
};

const calculateContainerCpuPercent = (stats) => {
  const cpuDelta =
    stats.cpu_stats?.cpu_usage?.total_usage -
    stats.precpu_stats?.cpu_usage?.total_usage;

  const systemDelta =
    stats.cpu_stats?.system_cpu_usage -
    stats.precpu_stats?.system_cpu_usage;

  const cpuCount =
    stats.cpu_stats?.online_cpus ||
    stats.cpu_stats?.cpu_usage?.percpu_usage?.length ||
    1;

  if (cpuDelta > 0 && systemDelta > 0) {
    return Number(((cpuDelta / systemDelta) * cpuCount * 100).toFixed(2));
  }

  return 0;
};

const calculateContainerMemoryPercent = (stats) => {
  const usage = stats.memory_stats?.usage || 0;
  const limit = stats.memory_stats?.limit || 1;

  return Number(((usage / limit) * 100).toFixed(2));
};

const collectContainerMetrics = async () => {
  try {
    const containers = await docker.listContainers({ all: false });

    if (!containers.length) {
      console.log("No running containers found.");
      return;
    }

    const containerPayloads = [];

    for (const containerInfo of containers) {
      try {
        const container = docker.getContainer(containerInfo.Id);
        const stats = await container.stats({ stream: false });

        containerPayloads.push({
          containerId: containerInfo.Id,
          name: containerInfo.Names?.[0]?.replace("/", "") || "unknown",
          imageName: containerInfo.Image || null,
          cpu: calculateContainerCpuPercent(stats),
          memory: calculateContainerMemoryPercent(stats),
          status: containerInfo.State || "unknown",
        });
      } catch (err) {
        console.error(
          `Failed to collect stats for container ${containerInfo.Id}:`,
          err.message
        );
      }
    }

    if (!containerPayloads.length) {
      return;
    }

    const payload = {
      systemId: SYSTEM_ID,
      timestamp: new Date().toISOString(),
      containers: containerPayloads,
    };

    console.log("Sending container metrics:", payload);

    await axios.post(CONTAINER_BACKEND_URL, payload);
  } catch (error) {
    console.error(
      "Failed to send container metrics:",
      error.response?.data || error.message
    );
  }
};

const runAgent = async () => {
  await sendSystemMetrics();
  await collectContainerMetrics();
};

console.log(`Agent started. Sending metrics every ${INTERVAL_MS / 1000} seconds...`);

runAgent();
setInterval(runAgent, INTERVAL_MS);