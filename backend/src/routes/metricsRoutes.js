import express from "express";
import {
  createMetric,
  getLatestMetric,
  getMetricsHistory,
  getAlerts,
  createContainerMetrics,
  getLatestContainerMetrics
} from "../controllers/metricsController.js";

const router = express.Router();

router.post("/", createMetric);
router.get("/latest", getLatestMetric);
router.get("/history", getMetricsHistory);
router.get("/alerts", getAlerts);
router.post("/containers", createContainerMetrics);
router.get("/containers/latest", getLatestContainerMetrics);

export default router;