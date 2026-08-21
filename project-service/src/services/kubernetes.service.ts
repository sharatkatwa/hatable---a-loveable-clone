import * as k8s from "@kubernetes/client-node";
import { memoryUsage } from "node:process";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

function isNotFound(error: unknown) {
  return (error as { code?: number })?.code === 404;
}

// delete k8s pod
export async function deletePod(podName: string) {
  try {
    await k8sApi.deleteNamespacedPod({
      name: podName,
      namespace: "default",
    });
    console.log(`${podName} pod deleted successfully 🗑️ `);
    return {
      status: "success",
      message: "Pod deleted successfully",
    };
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
}

// delete k8s service
export async function deleteService(serviceName: string) {
  try {
    await k8sApi.deleteNamespacedService({
      namespace: "default",
      name: serviceName,
    });
    console.log(`Service ${serviceName} deleted`);
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
}

export async function createPod(podName: string) {
  const podManifest: k8s.V1Pod = {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: podName,
      labels: {
        app: podName,
      },
    },
    spec: {
      volumes: [
        {
          name: "app-volume",
          emptyDir: {}, // This creates an empty directory for the pod
        },
      ],
      initContainers: [
        {
          name: "init-container",
          image: "nextjs-boilerplate",
          command: ["sh", "-c", "mkdir -p /app-copy && cp -r /app/* /app-copy"],
          volumeMounts: [
            {
              name: "app-volume",
              mountPath: "/app-copy",
            },
          ],
        },
      ],
      containers: [
        {
          name: "nextjs-container",
          image: "nextjs-boilerplate",
          ports: [{ containerPort: 3000 }],
          resources: {
            requests: {
              memory: "1024Mi",
              cpu: "500m",
            },
            limits: {
              memory: "2Gi",
              cpu: "1",
            },
          },
          volumeMounts: [
            {
              name: "app-volume",
              mountPath: "/app",
            },
          ],
        },
        {
          name: "file-server-container",
          image: "express-file-server",
          ports: [
            {
              containerPort: 8080,
            },
          ],
          resources: {
            requests: {
              memory: "512Mi", // Minimum memory guaranteed
              cpu: "250m", // Minimum CPU guaranteed (0.25 cores)
            },
            limits: {
              memory: "1024Mi", // Maximum memory allowed before OOMKilled
              cpu: "500m", // Maximum CPU allowed before throttling
            },
          },
          volumeMounts: [
            {
              name: "app-volume",
              mountPath: "/app",
            },
          ],
        },
      ],
    },
  };

  const res = await k8sApi.createNamespacedPod({
    namespace: "default",
    body: podManifest,
  });

  console.log("Pod created successfully 💚 ");
  console.log(res);
}

export async function createService(serviceName: string, podName: string) {
  const serviceManifest: k8s.V1Service = {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: serviceName,
      labels: {
        app: podName,
      },
    },
    spec: {
      selector: {
        app: podName,
      },
      ports: [
        {
          name: "preview-port",
          protocol: "TCP",
          port: 80,
          targetPort: 3000,
        },
        {
          name: "file-server-port",
          protocol: "TCP",
          port: 8000,
          targetPort: 8080,
        },
      ],
      type: "LoadBalancer",
    },
  };

  const res = await k8sApi.createNamespacedService({
    namespace: "default",
    body: serviceManifest,
  });

  console.log("Service created successfully 💚 ");
  console.log(res);
}
