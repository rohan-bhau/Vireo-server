import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { handleStripeWebhook } from "../services/billing";

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

export default router;
