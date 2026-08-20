import type { Request, Response } from "express";
import { createPod } from "../services/kubernetes.service.js";

export const createPodController = async (req: Request, res: Response) => {
  try {
    await createPod();
    res.status(201).json({ message: "Pod created successfully" });
  } catch (error) {
    console.error("Failed to create pod:", error);
    res.status(500).json({ error: "Failed to create pod" });
  }
};
