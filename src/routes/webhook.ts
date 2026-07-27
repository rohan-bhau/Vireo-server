import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { handleStripeWebhook } from "../services/billing";
import { authenticate } from "../middleware/auth";
import { testWebhook } from "../services/integration";

const router = Router();

router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers["stripe-signature"] as string;
      const rawBody = req.body;
      const result = await handleStripeWebhook(rawBody, signature);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/trigger",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url, payload } = req.body;
      if (!url) {
        res.status(400).json({ status: "error", message: "url is required" });
        return;
      }
      const result = await testWebhook(url, payload || {});
      res.json({ status: "success", data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
