import express from "express";
import {
  createMetric,
  getLatestMetric,
  getMetricsHistory,
  getAlerts,
} from "../controllers/metricsController.js";

const router = express.Router();

router.post("/", createMetric);
router.get("/latest", getLatestMetric);
router.get("/history", getMetricsHistory);
router.get("/alerts", getAlerts);

export default router;