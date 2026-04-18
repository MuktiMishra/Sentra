# Sentra

**Sentra** is a small real-time observability and monitoring platform for **host systems** and **Docker containers**. It follows an **agent-based architecture** where each monitored machine runs a lightweight agent that collects metrics and sends them to a central backend. The backend stores data in PostgreSQL, pushes live updates through Socket.IO, and powers a React dashboard for monitoring multiple systems.


---

## Features

- Real-time **host system monitoring**
  - CPU usage
  - Memory usage
  - Uptime
- Real-time **Docker container monitoring**
  - Per-container CPU usage
  - Per-container memory usage
  - Container status
- **Threshold-based alerts**
  - CPU alerting
  - Memory alerting
- **Online / Offline status detection**
- **Multi-system support**
- **Live dashboard updates** using Socket.IO
- Historical charts for host metrics
- PostgreSQL-based persistent storage

---

## Architecture

```text
Agent (Host + Docker Metrics)
        |
        v
   Express Backend API
        |
        v
     PostgreSQL
        |
        v
   Socket.IO Server
        |
        v
   React Dashboard

```


---

## ⚙️ How It Works

1. A lightweight **agent** runs on each monitored system  
2. The agent collects:
   - Host metrics (CPU, memory, uptime)
   - Docker container metrics (CPU, memory, status)
3. Metrics are sent to the **backend API**  
4. The backend:
   - Stores data in PostgreSQL
   - Emits real-time updates via Socket.IO  
5. The **frontend dashboard**:
   - Displays system metrics
   - Shows alerts and container data
   - Updates live in real-time  

---

## 🧰 Tech Stack

### Frontend
- React
- Recharts
- Axios
- Socket.IO Client

### Backend
- Node.js
- Express
- PostgreSQL
- Socket.IO

### Agent
- Node.js
- systeminformation
- dockerode
- Axios

### DevOps
- Docker
- Docker Compose

---
v0 Completed !
v1 In progress ...

