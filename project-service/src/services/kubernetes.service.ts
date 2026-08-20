import * as k8s from "@kubernetes/client-node";
import { memoryUsage } from "node:process";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

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
          protocol: "TCP",
          port: 80,
          targetPort: 3000,
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
