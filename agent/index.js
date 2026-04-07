import axios from "axios";
import si from "systeminformation";
import dotenv from "dotenv";

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL;
const SYSTEM_ID = process.env.SYSTEM_ID || "machine-001";
const HOSTNAME = process.env.HOSTNAME || "local-machine";
const OS_NAME = process.env.OS_NAME || "Unknown OS";
const AGENT_VERSION = process.env.AGENT_VERSION || "1.0.0";
const INTERVAL_MS = Number(process.env.INTERVAL_MS) || 10000;

const sendMetrics = async () => {
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

    console.log("Sending metrics:", payload);

    const response = await axios.post(BACKEND_URL, payload);

    console.log("Metric stored:", response.data.data.id || "success");
  } catch (error) {
    console.error(
      "Failed to send metrics:",
      error.response?.data || error.message
    );
  }
};

console.log(`Agent started. Sending metrics every ${INTERVAL_MS / 1000} seconds...`);

sendMetrics();
setInterval(sendMetrics, INTERVAL_MS);