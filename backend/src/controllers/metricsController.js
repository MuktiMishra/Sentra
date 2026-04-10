import pool from "../config/db.js";
import { getIO } from "../socket.js";

export const getSystems = async (req, res) => {
  try {
    const query = `
      SELECT
        s.system_id,
        s.hostname,
        s.os_name,
        s.agent_version,
        MAX(sm.timestamp) AS last_metric_at
      FROM systems s
      LEFT JOIN system_metrics sm
        ON s.system_id = sm.system_id
      GROUP BY s.system_id, s.hostname, s.os_name, s.agent_version
      ORDER BY s.hostname ASC NULLS LAST, s.system_id ASC
    `;

    const result = await pool.query(query);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch systems",
      error: error.message,
    });
  }
};

export const createContainerMetrics = async (req, res) => {
  const client = await pool.connect();

  try {
    const { systemId, containers, timestamp } = req.body;

    if (!systemId || !Array.isArray(containers)) {
      return res.status(400).json({
        success: false,
        message: "systemId and containers array are required",
      });
    }

    await client.query("BEGIN");

    for (const container of containers) {
      const {
        containerId,
        name,
        imageName,
        cpu,
        memory,
        status,
      } = container;

      if (
        !containerId ||
        !name ||
        cpu === undefined ||
        memory === undefined
      ) {
        continue;
      }

      const existingContainer = await client.query(
        `SELECT container_id FROM containers WHERE container_id = $1`,
        [containerId]
      );

      if (existingContainer.rows.length === 0) {
        await client.query(
          `INSERT INTO containers (container_id, system_id, name, image_name)
           VALUES ($1, $2, $3, $4)`,
          [containerId, systemId, name, imageName || null]
        );
      }

      await client.query(
        `INSERT INTO container_metrics (container_id, cpu, memory, status, timestamp)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          containerId,
          cpu,
          memory,
          status || "unknown",
          timestamp || new Date(),
        ]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Container metrics stored successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({
      success: false,
      message: "Failed to store container metrics",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const getLatestContainerMetrics = async (req, res) => {
  try {
    const { systemId } = req.query;

    if (!systemId) {
      return res.status(400).json({
        success: false,
        message: "systemId is required",
      });
    }

    const query = `
      SELECT
        c.container_id,
        c.name,
        c.image_name,
        cm.cpu,
        cm.memory,
        cm.status,
        cm.timestamp
      FROM containers c
      JOIN LATERAL (
        SELECT cpu, memory, status, timestamp
        FROM container_metrics
        WHERE container_id = c.container_id
        ORDER BY timestamp DESC
        LIMIT 1
      ) cm ON true
      WHERE c.system_id = $1
      ORDER BY c.name ASC
    `;

    const result = await pool.query(query, [systemId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch latest container metrics",
      error: error.message,
    });
  }
};

const handleAlert = async ({
  client,
  systemId,
  alertType,
  metricValue,
  thresholdValue,
  severity = "high",
  message,
}) => {
  const activeAlertQuery = `
    SELECT id
    FROM alerts
    WHERE system_id = $1
      AND alert_type = $2
      AND is_resolved = FALSE
    LIMIT 1
  `;

  const activeAlert = await client.query(activeAlertQuery, [systemId, alertType]);

  if (metricValue > thresholdValue) {
    if (activeAlert.rows.length === 0) {
      const insertAlertQuery = `
        INSERT INTO alerts (
          system_id,
          alert_type,
          severity,
          message,
          metric_value,
          threshold_value,
          is_resolved
        )
        VALUES ($1, $2, $3, $4, $5, $6, FALSE)
      `;

      await client.query(insertAlertQuery, [
        systemId,
        alertType,
        severity,
        message,
        metricValue,
        thresholdValue,
      ]);
    }
  } else {
    if (activeAlert.rows.length > 0) {
      const resolveAlertQuery = `
        UPDATE alerts
        SET is_resolved = TRUE,
            resolved_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(resolveAlertQuery, [activeAlert.rows[0].id]);
    }
  }
};

export const createMetric = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      systemId,
      hostname,
      osName,
      agentVersion,
      cpu,
      memory,
      uptime,
      timestamp,
    } = req.body;

    if (
      !systemId ||
      cpu === undefined ||
      memory === undefined ||
      uptime === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "systemId, cpu, memory, and uptime are required",
      });
    }

    await client.query("BEGIN");

    const checkSystemQuery = `
      SELECT system_id FROM systems WHERE system_id = $1
    `;
    const existingSystem = await client.query(checkSystemQuery, [systemId]);

    if (existingSystem.rows.length === 0) {
      const insertSystemQuery = `
        INSERT INTO systems (system_id, hostname, os_name, agent_version)
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(insertSystemQuery, [
        systemId,
        hostname || null,
        osName || null,
        agentVersion || null,
      ]);
    }

    const insertMetricQuery = `
      INSERT INTO system_metrics (system_id, cpu, memory, uptime, timestamp)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const values = [
      systemId,
      cpu,
      memory,
      uptime,
      timestamp || new Date(),
    ];

    const result = await client.query(insertMetricQuery, values);

    await handleAlert({
      client,
      systemId,
      alertType: "cpu",
      metricValue: cpu,
      thresholdValue: 50,
      severity: "high",
      message: `CPU usage exceeded 50% on ${systemId}`,
    });

    await handleAlert({
      client,
      systemId,
      alertType: "memory",
      metricValue: memory,
      thresholdValue: 85,
      severity: "high",
      message: `Memory usage exceeded 85% on ${systemId}`,
    });

    await client.query("COMMIT");

    getIO().emit("metric:new", {
      systemId,
      metric: result.rows[0],
    });

    res.status(201).json({
      success: true,
      message: "Metric stored successfully",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    res.status(500).json({
      success: false,
      message: "Failed to store metric",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const getLatestMetric = async (req, res) => {
  try {
    const { systemId } = req.query;

    if (!systemId) {
      return res.status(400).json({
        success: false,
        message: "systemId is required",
      });
    }

    const query = `
      SELECT *
      FROM system_metrics
      WHERE system_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [systemId]);

    res.status(200).json({
      success: true,
      data: result.rows[0] || null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch latest metric",
      error: error.message,
    });
  }
};

export const getMetricsHistory = async (req, res) => {
  try {
    const { systemId } = req.query;

    if (!systemId) {
      return res.status(400).json({
        success: false,
        message: "systemId is required",
      });
    }

    const query = `
      SELECT *
      FROM system_metrics
      WHERE system_id = $1
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [systemId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch metrics history",
      error: error.message,
    });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const { systemId } = req.query;

    if (!systemId) {
      return res.status(400).json({
        success: false,
        message: "systemId is required",
      });
    }

    const query = `
      SELECT *
      FROM alerts
      WHERE system_id = $1
      ORDER BY triggered_at DESC
      LIMIT 20
    `;

    const result = await pool.query(query, [systemId]);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts",
      error: error.message,
    });
  }
};