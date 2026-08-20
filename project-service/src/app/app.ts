import morgan from "morgan";
import express from "express";
import router from "./index.routes.js";

const app = express();

app.use(morgan("dev"));
app.use(express.json());

// routes
app.use("/api/project", router);

app.use("/_status/healthz", (req, res) => {
  res.status(200).json({ message: "server is healthy" });
});
app.use("/_status/readyz", (req, res) => {
  res.status(200).json({ message: "server is ready" });
});

export default app;
