import { Router, type IRouter } from "express";
import healthRouter from "./health";
import obfuscatorRouter from "./obfuscator";

const router: IRouter = Router();

router.use(healthRouter);
router.use(obfuscatorRouter);

export default router;
