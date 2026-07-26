import { Router } from "express";
import * as reportController from "../controllers/report";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/burndown", reportController.getBurndown);
router.get("/velocity", reportController.getVelocity);
router.get("/sprint-report", reportController.getSprintReport);
router.get("/cfd", reportController.getCumulativeFlow);
router.get("/control-chart", reportController.getControlChart);
router.get("/created-vs-resolved", reportController.getCreatedVsResolved);
router.get("/average-age", reportController.getAverageAge);
router.get("/time-to-resolution", reportController.getTimeToResolution);

export default router;
