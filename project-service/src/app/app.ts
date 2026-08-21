import morgan from "morgan";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import router from "./index.routes.js";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  onPreviewReaped,
  recordActivity,
} from "../services/activity.service.js";

const app = express();

const proxyMap: { [key: string]: Function } = {};
const proxyMapForFiles: { [key: string]: Function } = {};

onPreviewReaped((uniqueId) => {
  delete proxyMap[uniqueId];
});

app.use(morgan("dev"));

function getProxy(uniqueId: string) {
  if (proxyMap[uniqueId]) {
    return proxyMap[uniqueId];
  }
  const targetUrl = `http://nextjs-service-${uniqueId}`;
  const proxyMiddleware = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    // pathRewrite: { "^/": "/" },
  });
  proxyMap[uniqueId] = proxyMiddleware;
  return proxyMiddleware;
}

function getProxyForFiles(uniqueId: string) {
  if (proxyMapForFiles[uniqueId]) {
    return proxyMapForFiles[uniqueId];
  }

  const targetUrl = `http://nextjs-service-${uniqueId}:8000`;

  const proxyMiddleware = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
   
  });

  proxyMapForFiles[uniqueId] = proxyMiddleware;

  return proxyMiddleware;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const host = req.headers.host || "";


  const subdomain = host?.split(".");
  if (!host.includes("preview") && !host.includes("file-system")) {
    return next();
  }
  const uniqueId = subdomain[0];
  if (!uniqueId) {
    return res.status(400).json({ message: "Invalid preview URL provided." });
  }
  void recordActivity(uniqueId);
  
  if (host.includes("file-system")) {
    void recordActivity(uniqueId);
    return getProxyForFiles(uniqueId)(req, res, next);
  }

  return getProxy(uniqueId)(req, res, next);
});

app.use(express.json());

// routes
app.use("/api/projects", router);

app.use("/_status/healthz", (_req, res) => {
  res.status(200).json({ message: "server is healthy" });
});
app.use("/_status/readyz", (_req, res) => {
  res.status(200).json({ message: "server is ready" });
});

export default app;
