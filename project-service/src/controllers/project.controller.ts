import type { Request, Response } from "express";
import { createPod, createService } from "../services/kubernetes.service.js";
import { v4 as uuidv4 } from "uuid";
import { recordActivity } from "../services/activity.service.js";

export const createPodController = async (req: Request, res: Response) => {
  try {
    const uniqueId = uuidv4();
    const podName = `nextjs-pod-${uniqueId}`;
    const serviceName = `nextjs-service-${uniqueId}`;

    await createPod(podName);
    await createService(serviceName, podName);
    await recordActivity(uniqueId)

    res
      .status(201)
      .json({
        message: "Pod created successfully",
        previewUrl: `http://${uniqueId}.preview.localhost`,
      });
  } catch (error) {
    console.error("Failed to create pod:", error);
    res.status(500).json({ error: "Failed to create pod" });
  }
};
