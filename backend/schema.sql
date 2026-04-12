CREATE DATABASE sentra;

CREATE TABLE systems (
  id SERIAL PRIMARY KEY,
  system_id VARCHAR(100) UNIQUE NOT NULL,
  hostname VARCHAR(255),
  os_name VARCHAR(100),
  agent_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_metrics (
  id BIGSERIAL PRIMARY KEY,
  system_id VARCHAR(100) NOT NULL,
  cpu NUMERIC(5,2) NOT NULL CHECK (cpu >= 0 AND cpu <= 100),
  memory NUMERIC(5,2) NOT NULL CHECK (memory >= 0 AND memory <= 100),
  uptime BIGINT NOT NULL CHECK (uptime >= 0),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_system_metrics_system
    FOREIGN KEY (system_id)
    REFERENCES systems(system_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_system_metrics_system_id
ON system_metrics(system_id);

CREATE INDEX idx_system_metrics_timestamp
ON system_metrics(timestamp DESC);

CREATE INDEX idx_system_metrics_system_time
ON system_metrics(system_id, timestamp DESC);

CREATE TABLE alerts (
  id BIGSERIAL PRIMARY KEY,
  system_id VARCHAR(100) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  metric_value NUMERIC(10,2) NOT NULL,
  threshold_value NUMERIC(10,2) NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  CONSTRAINT fk_alerts_system
    FOREIGN KEY (system_id)
    REFERENCES systems(system_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_alerts_system_id
ON alerts(system_id);

CREATE INDEX idx_alerts_system_type_resolved
ON alerts(system_id, alert_type, is_resolved);

CREATE TABLE containers (
  id SERIAL PRIMARY KEY,
  container_id VARCHAR(100) UNIQUE NOT NULL,
  system_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  image_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_containers_system
    FOREIGN KEY (system_id)
    REFERENCES systems(system_id)
    ON DELETE CASCADE
);

CREATE TABLE container_metrics (
  id BIGSERIAL PRIMARY KEY,
  container_id VARCHAR(100) NOT NULL,
  cpu NUMERIC(5,2) NOT NULL CHECK (cpu >= 0),
  memory NUMERIC(5,2) NOT NULL CHECK (memory >= 0),
  status VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_container_metrics_container
    FOREIGN KEY (container_id)
    REFERENCES containers(container_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_containers_system_id
ON containers(system_id);

CREATE INDEX idx_container_metrics_container_id
ON container_metrics(container_id);

CREATE INDEX idx_container_metrics_time
ON container_metrics(timestamp DESC);