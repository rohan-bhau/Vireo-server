import { Router } from "express";
import * as authController from "../controllers/auth";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authenticate, authController.logout);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-otp", authController.resendOtp);
router.post("/onboarding", authenticate, authController.onboarding);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

router.get("/:provider", authController.oauthRedirect);
router.get("/:provider/callback", authController.oauthCallback);

export default router;
