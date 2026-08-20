import type { Request, Response } from "express";
import { createPod, createService } from "../services/kubernetes.service.js";
import { v4 as uuidv4 } from 'uuid';

export const createPodController = async (req: Request, res: Response) => {
  try {
    const podName = `nextjs-pod-${uuidv4()}`;
    const serviceName = `nextjs-service-${uuidv4()}`;
    
    await createPod(podName);
    await createService(serviceName, podName);
    
    res.status(201).json({ message: "Pod created successfully" });

  } catch (error) {
    console.error("Failed to create pod:", error);
    res.status(500).json({ error: "Failed to create pod" });
  }
};
