import { Router } from "express";
import * as usersController from "../controllers/users";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/profile", authenticate, usersController.getProfile);
router.put("/profile", authenticate, usersController.updateProfile);

export default router;
