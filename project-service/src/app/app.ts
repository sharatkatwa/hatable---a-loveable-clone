import morgan from "morgan";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import router from "./index.routes.js";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();

app.use(morgan("dev"));

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
  const targetUrl = `http://nextjs-service-${uniqueId}`;
  const proxyMiddleware = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: { "^/": "/" },
  });

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
