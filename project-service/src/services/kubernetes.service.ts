import * as k8s from "@kubernetes/client-node";
import { memoryUsage } from "node:process";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

export async function createPod() {
  const podManifest: k8s.V1Pod = {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: "nextjs-pod",
      labels: {
        app: "nextjs",
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

  console.log('Pod created successfully 💚 ')
  console.log(res)
}
