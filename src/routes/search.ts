import { Router } from "express";
import * as searchController from "../controllers/search";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", searchController.search);
router.get("/global", searchController.globalSearch);
router.post("/advanced", searchController.advancedFilter);
router.get("/jql", searchController.jqlSearch);
router.post("/validate", searchController.validateJqlEndpoint);
router.get("/suggest", searchController.suggest);

export default router;
