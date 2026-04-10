import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
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

const socket = io("http://localhost:8000");
const API_BASE = "http://localhost:8000/api/metrics";

function formatUptime(seconds) {
  const total = Number(seconds || 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hrs}h ${mins}m ${secs}s`;
}

function getSystemStatus(lastSeenAt, now) {
  if (!lastSeenAt) return "offline";

  const diffInSeconds = (now - lastSeenAt) / 1000;
  return diffInSeconds <= 15 ? "online" : "offline";
}

function formatLastUpdated(lastSeenAt) {
  if (!lastSeenAt) return "--";
  return new Date(lastSeenAt).toLocaleString();
}

function App() {
  const [systems, setSystems] = useState([]);
  const [selectedSystemId, setSelectedSystemId] = useState("");

  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [containerMetrics, setContainerMetrics] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [lastSeenAt, setLastSeenAt] = useState(null);

  const systemStatus = getSystemStatus(lastSeenAt, now);

  const fetchSystems = async () => {
    try {
      const res = await axios.get(`${API_BASE}/systems`);
      const systemsData = res.data.data || [];

      setSystems(systemsData);

      if (!selectedSystemId && systemsData.length > 0) {
        setSelectedSystemId(systemsData[0].system_id);
      }
    } catch (err) {
      console.error("Failed to fetch systems:", err.message);
      setError("Failed to fetch systems");
    }
  };

  const fetchMetrics = async () => {
    if (!selectedSystemId) return;

    try {
      const [latestRes, historyRes, alertsRes, containersRes] =
        await Promise.all([
          axios.get(`${API_BASE}/latest?systemId=${selectedSystemId}`),
          axios.get(`${API_BASE}/history?systemId=${selectedSystemId}`),
          axios.get(`${API_BASE}/alerts?systemId=${selectedSystemId}`),
          axios.get(
            `${API_BASE}/containers/latest?systemId=${selectedSystemId}`
          ),
        ]);

      setLatest(latestRes.data.data);

      const historyData = (historyRes.data.data || []).slice().reverse();
      setHistory(historyData);

      setAlerts(alertsRes.data.data || []);
      setContainerMetrics(containersRes.data.data || []);
      setLastSeenAt(Date.now());
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystems();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedSystemId) return;

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);

    return () => clearInterval(interval);
  }, [selectedSystemId]);

  useEffect(() => {
    setLatest(null);
    setHistory([]);
    setAlerts([]);
    setContainerMetrics([]);
    setLastSeenAt(null);
  }, [selectedSystemId]);

  useEffect(() => {
    if (!selectedSystemId) return;

    const handleNewMetric = async (payload) => {
      if (payload.systemId !== selectedSystemId) return;

      const newMetric = payload.metric;

      setLatest(newMetric);
      setLastSeenAt(Date.now());

      setHistory((prev) => {
        const updated = [...prev, newMetric];
        return updated.slice(-50);
      });

      try {
        const alertsRes = await axios.get(
          `${API_BASE}/alerts?systemId=${selectedSystemId}`
        );
        setAlerts(alertsRes.data.data || []);
      } catch (err) {
        console.error("Failed to refresh alerts:", err.message);
      }

      try {
        const containersRes = await axios.get(
          `${API_BASE}/containers/latest?systemId=${selectedSystemId}`
        );
        setContainerMetrics(containersRes.data.data || []);
      } catch (err) {
        console.error("Failed to refresh container metrics:", err.message);
      }
    };

    socket.on("metric:new", handleNewMetric);

    return () => {
      socket.off("metric:new", handleNewMetric);
    };
  }, [selectedSystemId]);

  const chartData = useMemo(() => {
    return history.map((item) => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      cpu: Number(item.cpu),
      memory: Number(item.memory),
    }));
  }, [history]);

  if (loading && !selectedSystemId) {
    return (
      <div className="page">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <div>
          <h1>System Monitoring Dashboard</h1>

          <div className="system-selector">
            <label htmlFor="systemSelect">System:</label>
            <select
              id="systemSelect"
              value={selectedSystemId}
              onChange={(e) => setSelectedSystemId(e.target.value)}
            >
              {systems.map((system) => (
                <option key={system.system_id} value={system.system_id}>
                  {system.hostname || system.system_id} ({system.system_id})
                </option>
              ))}
            </select>
          </div>

          <p>Monitoring: {selectedSystemId || "--"}</p>
          <p>Last Updated: {formatLastUpdated(lastSeenAt)}</p>
        </div>

        <div className={`status-badge ${systemStatus}`}>
          {systemStatus.toUpperCase()}
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="alerts-section">
        <h2>Alerts</h2>

        {alerts.length === 0 ? (
          <div className="alert-empty">No alerts found</div>
        ) : (
          <div className="alerts-list">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-card ${
                  alert.is_resolved ? "resolved" : "active"
                }`}
              >
                <div className="alert-top">
                  <span className="alert-type">
                    {alert.alert_type.toUpperCase()}
                  </span>
                  <span className="alert-status">
                    {alert.is_resolved ? "Resolved" : "Active"}
                  </span>
                </div>

                <p className="alert-message">{alert.message}</p>

                <div className="alert-meta">
                  <span>Value: {alert.metric_value}</span>
                  <span>Threshold: {alert.threshold_value}</span>
                </div>

                <div className="alert-time">
                  Triggered: {new Date(alert.triggered_at).toLocaleString()}
                </div>

                {alert.resolved_at && (
                  <div className="alert-time">
                    Resolved: {new Date(alert.resolved_at).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="containers-section">
        <h2>Containers</h2>

        {containerMetrics.length === 0 ? (
          <div className="container-empty">No running containers found</div>
        ) : (
          <div className="containers-grid">
            {containerMetrics.map((container) => (
              <div className="container-card" key={container.container_id}>
                <div className="container-card-top">
                  <h3>{container.name}</h3>
                  <span className={`container-status ${container.status}`}>
                    {container.status}
                  </span>
                </div>

                <p className="container-image">
                  Image: {container.image_name || "Unknown"}
                </p>

                <div className="container-metrics">
                  <div>
                    <span>CPU</span>
                    <strong>{container.cpu}%</strong>
                  </div>

                  <div>
                    <span>Memory</span>
                    <strong>{container.memory}%</strong>
                  </div>
                </div>

                <p className="container-time">
                  Updated: {new Date(container.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

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
            <Line
              type="monotone"
              dataKey="memory"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;