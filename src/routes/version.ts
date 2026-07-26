import { Router } from "express";
import * as versionController from "../controllers/version";
import { authenticate } from "../middleware/auth";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/project/:projectId", versionController.getByProject);
router.get("/:id", versionController.getById);
router.post("/", versionController.create);
router.put("/:id", versionController.update);
router.delete("/:id", versionController.remove);
router.post("/:id/release", versionController.release);
router.get("/:id/progress", versionController.getProgress);

export default router;
