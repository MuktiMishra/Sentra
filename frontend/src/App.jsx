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

const SYSTEM_ID = "machine-001";
const API_BASE = "http://localhost:8000/api/metrics";

function formatUptime(seconds) {
  const total = Number(seconds || 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hrs}h ${mins}m ${secs}s`;
}

function getSystemStatus(timestamp, now) {
  if (!timestamp) return "offline";

  const metricTime = new Date(timestamp).getTime();
  const diffInSeconds = (now - metricTime) / 1000;

  return diffInSeconds <= 15 ? "online" : "offline";
}

function formatLastUpdated(timestamp) {
  if (!timestamp) return "--";
  return new Date(timestamp).toLocaleString();
}

function App() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const systemStatus = getSystemStatus(latest?.timestamp, now);

  const fetchMetrics = async () => {
    try {
      const [latestRes, historyRes, alertsRes] = await Promise.all([
        axios.get(`${API_BASE}/latest?systemId=${SYSTEM_ID}`),
        axios.get(`${API_BASE}/history?systemId=${SYSTEM_ID}`),
        axios.get(`${API_BASE}/alerts?systemId=${SYSTEM_ID}`),
      ]);

      setLatest(latestRes.data.data);

      const historyData = (historyRes.data.data || []).slice().reverse();
      setHistory(historyData);

      setAlerts(alertsRes.data.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
  const timer = setInterval(() => {
    setNow(Date.now());
  }, 1000);

  return () => clearInterval(timer);
}, []);
  

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
  const handleNewMetric = async (payload) => {
    if (payload.systemId !== SYSTEM_ID) return;

    const newMetric = payload.metric;

    setLatest(newMetric);

    setHistory((prev) => {
      const updated = [...prev, newMetric];
      return updated.slice(-50);
    });

    try {
      const alertsRes = await axios.get(
        `${API_BASE}/alerts?systemId=${SYSTEM_ID}`
      );
      setAlerts(alertsRes.data.data || []);
    } catch (err) {
      console.error("Failed to refresh alerts:", err.message);
    }
  };

  socket.on("metric:new", handleNewMetric);

  return () => {
    socket.off("metric:new", handleNewMetric);
  };
}, []);

  const chartData = useMemo(() => {
    return history.map((item) => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      cpu: Number(item.cpu),
      memory: Number(item.memory),
    }));
  }, [history]);

  if (loading) {
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
    <p>Monitoring: {SYSTEM_ID}</p>
    <p>Last Updated: {formatLastUpdated(latest?.timestamp)}</p>
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