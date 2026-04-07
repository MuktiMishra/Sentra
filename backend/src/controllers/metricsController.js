import pool from "../config/db.js";

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

    await client.query("COMMIT");

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