import morgan from "morgan";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import router from "./index.routes.js";
import { createProxyMiddleware } from "http-proxy-middleware";
import { onPreviewReaped, recordActivity } from "../services/activity.service.js";

const app = express();


const proxyMap: { [key: string]: Function } = {};

onPreviewReaped((uniqueId)=>{
  delete proxyMap[uniqueId]
})

app.use(morgan("dev"));

function getProxy(uniqueId: string) {
  if (proxyMap[uniqueId]) {
    return proxyMap[uniqueId];
  }
  const targetUrl = `http://nextjs-service-${uniqueId}`;
  const proxyMiddleware = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: { "^": "/" },
  });
  proxyMap[uniqueId] = proxyMiddleware;
  return proxyMiddleware;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const host = req.headers.host || "";

  if (!host.includes("preview")) {
    return next();
  }
  const subdomain = host?.split(".");
  if (!subdomain[1]) {
    return next();
  }
  const uniqueId = subdomain[0];
  if (!uniqueId) {
    return res.status(400).json({ message: "Invalid preview URL provided." });
  }
  void recordActivity(uniqueId)
  const proxyMiddleware = getProxy(uniqueId);

  return proxyMiddleware(req, res, next);
});

app.use(express.json());

// routes
app.use("/api/projects", router);

app.use("/_status/healthz", (req, res) => {
  res.status(200).json({ message: "server is healthy" });
});
app.use("/_status/readyz", (req, res) => {
  res.status(200).json({ message: "server is ready" });
});

export default app;
