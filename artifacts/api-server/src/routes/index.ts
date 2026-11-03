import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tadarukRouter from "./tadaruk";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tadarukRouter);

export default router;
