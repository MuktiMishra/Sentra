import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./index.css";

const SYSTEM_ID = "machine-001";
const API_BASE = "http://localhost:8000/api/metrics";

function formatUptime(seconds) {
  const total = Number(seconds || 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hrs}h ${mins}m ${secs}s`;
}

function App() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMetrics = async () => {
    try {
      const [latestRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE}/latest?systemId=${SYSTEM_ID}`),
        axios.get(`${API_BASE}/history?systemId=${SYSTEM_ID}`),
      ]);

      setLatest(latestRes.data.data);
      const historyData = (historyRes.data.data || []).slice().reverse();
      setHistory(historyData);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const chartData = useMemo(() => {
    return history.map((item) => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      cpu: Number(item.cpu),
      memory: Number(item.memory),
    }));
  }, [history]);

  if (loading) {
    return <div className="page"><h2>Loading dashboard...</h2></div>;
  }

  return (
    <div className="page">
      <div className="header">
        <h1>System Monitoring Dashboard</h1>
        <p>Monitoring: {SYSTEM_ID}</p>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="cards">
        <div className="card">
          <h3>CPU Usage</h3>
          <p>{latest ? `${latest.cpu}%` : "--"}</p>
        </div>

        <div className="card">
          <h3>Memory Usage</h3>
          <p>{latest ? `${latest.memory}%` : "--"}</p>
        </div>

        <div className="card">
          <h3>Uptime</h3>
          <p>{latest ? formatUptime(latest.uptime) : "--"}</p>
        </div>
      </div>

      <div className="chart-card">
        <h3>CPU History</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" minTickGap={20} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="cpu" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-card">
        <h3>Memory History</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" minTickGap={20} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="memory" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;