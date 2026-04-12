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
  BarChart,
  Bar,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import "./index.css";

const socket = io("http://localhost:8000");
const API_BASE = "http://localhost:8000/api/metrics";

function formatUptime(seconds) {
  const total = Number(seconds || 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
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

function getUsageTone(value = 0) {
  if (value >= 85) return "critical";
  if (value >= 60) return "warning";
  return "healthy";
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
          axios.get(`${API_BASE}/containers/latest?systemId=${selectedSystemId}`),
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

  const containerChartData = useMemo(() => {
    return containerMetrics.map((container) => ({
      name:
        container.name?.length > 12
          ? `${container.name.slice(0, 12)}...`
          : container.name,
      fullName: container.name,
      cpu: Number(container.cpu || 0),
      memory: Number(container.memory || 0),
      status: container.status,
    }));
  }, [containerMetrics]);

  const activeAlerts = alerts.filter((a) => !a.is_resolved).length;
  const resolvedAlerts = alerts.filter((a) => a.is_resolved).length;

  if (loading && !selectedSystemId) {
    return (
      <div className="page">
        <div className="loading-screen">
          <h2>Loading dashboard...</h2>
          <p>Please wait while metrics are being fetched.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="dashboard-shell">
        <div className="hero-card">
          <div className="hero-left">
            <div className="hero-pill">Sentra Observability</div>
            <h1>System Monitoring Dashboard</h1>
            <p>
              Track system health, alerts, resource usage, and container-level
              metrics in one place.
            </p>

            <div className="system-selector modern-select">
              <label htmlFor="systemSelect">Select System</label>
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

            <div className="hero-meta">
              <div>
                <span className="meta-label">Monitoring</span>
                <strong>{selectedSystemId || "--"}</strong>
              </div>
              <div>
                <span className="meta-label">Last Updated</span>
                <strong>{formatLastUpdated(lastSeenAt)}</strong>
              </div>
            </div>
          </div>

          <div className="hero-right">
            <div className={`status-ring ${systemStatus}`}>
              <span>{systemStatus.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="top-stats-grid">
          <div className="glass-card stat-card">
            <div className="stat-top">
              <span>CPU Usage</span>
              <strong>{latest ? `${latest.cpu}%` : "--"}</strong>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill ${getUsageTone(Number(latest?.cpu || 0))}`}
                style={{ width: `${Math.min(Number(latest?.cpu || 0), 100)}%` }}
              />
            </div>
          </div>

          <div className="glass-card stat-card">
            <div className="stat-top">
              <span>Memory Usage</span>
              <strong>{latest ? `${latest.memory}%` : "--"}</strong>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill ${getUsageTone(Number(latest?.memory || 0))}`}
                style={{
                  width: `${Math.min(Number(latest?.memory || 0), 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="glass-card stat-card">
            <div className="stat-top">
              <span>Uptime</span>
              <strong>{latest ? formatUptime(latest.uptime) : "--"}</strong>
            </div>
            <p className="stat-subtext">System running duration</p>
          </div>

          <div className="glass-card stat-card">
            <div className="stat-top">
              <span>Containers</span>
              <strong>{containerMetrics.length}</strong>
            </div>
            <p className="stat-subtext">Active containers detected</p>
          </div>

          <div className="glass-card stat-card">
            <div className="stat-top">
              <span>Active Alerts</span>
              <strong>{activeAlerts}</strong>
            </div>
            <p className="stat-subtext">Needs attention</p>
          </div>

          <div className="glass-card stat-card">
            <div className="stat-top">
              <span>Resolved Alerts</span>
              <strong>{resolvedAlerts}</strong>
            </div>
            <p className="stat-subtext">Recovered incidents</p>
          </div>
        </div>

        <div className="section-card">
          <div className="section-header">
            <h2>Alerts</h2>
            <span>{alerts.length} total</span>
          </div>

          {alerts.length === 0 ? (
            <div className="empty-state">No alerts found</div>
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

        <div className="charts-grid">
          <div className="section-card">
            <div className="section-header">
              <h2>CPU History</h2>
              <span>Last {chartData.length} points</span>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                <XAxis dataKey="time" minTickGap={20} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} stroke="#94a3b8" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#60a5fa"
                  fill="url(#cpuGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="section-card">
            <div className="section-header">
              <h2>Memory History</h2>
              <span>Last {chartData.length} points</span>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient
                    id="memoryGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                <XAxis dataKey="time" minTickGap={20} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} stroke="#94a3b8" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="memory"
                  stroke="#4ade80"
                  fill="url(#memoryGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="section-card">
          <div className="section-header">
            <h2>Container Metrics</h2>
            <span>Cards + graphs</span>
          </div>

          {containerMetrics.length === 0 ? (
            <div className="empty-state">No running containers found</div>
          ) : (
            <>
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
                        <div className="mini-progress">
                          <div
                            className="mini-progress-fill cpu"
                            style={{
                              width: `${Math.min(Number(container.cpu || 0), 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <span>Memory</span>
                        <strong>{container.memory}%</strong>
                        <div className="mini-progress">
                          <div
                            className="mini-progress-fill memory"
                            style={{
                              width: `${Math.min(
                                Number(container.memory || 0),
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <p className="container-time">
                      Updated: {new Date(container.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="container-graphs-grid">
                <div className="inner-chart-card">
                  <h3>Container CPU Comparison</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={containerChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis domain={[0, 100]} stroke="#94a3b8" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="cpu" fill="#60a5fa" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="inner-chart-card">
                  <h3>Container Memory Comparison</h3>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={containerChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis domain={[0, 100]} stroke="#94a3b8" />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="memory"
                        fill="#34d399"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="section-card">
          <div className="section-header">
            <h2>Combined Resource Trend</h2>
            <span>CPU vs Memory</span>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
              <XAxis dataKey="time" minTickGap={20} stroke="#94a3b8" />
              <YAxis domain={[0, 100]} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#60a5fa"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="memory"
                stroke="#4ade80"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default App;