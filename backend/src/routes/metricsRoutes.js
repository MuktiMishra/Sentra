import express from "express";
import {
  createMetric,
  getLatestMetric,
  getMetricsHistory,
} from "../controllers/metricsController.js";

const router = express.Router();

router.post("/", createMetric);
router.get("/latest", getLatestMetric);
router.get("/history", getMetricsHistory);

export default router;