import { Router } from "express";
import * as searchController from "../controllers/search";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", searchController.search);
router.get("/global", searchController.globalSearch);
router.post("/advanced", searchController.advancedFilter);

export default router;
