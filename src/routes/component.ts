import { Router } from "express";
import * as componentController from "../controllers/component";
import { authenticate } from "../middleware/auth";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/project/:projectId", componentController.getByProject);
router.get("/:id", componentController.getById);
router.post("/", componentController.create);
router.put("/:id", componentController.update);
router.delete("/:id", componentController.remove);

export default router;
