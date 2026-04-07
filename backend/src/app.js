import express from "express";
import cors from "cors";
import metricsRoutes from "./routes/metricsRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend running" });
});

app.use("/api/metrics", metricsRoutes);

export default app;