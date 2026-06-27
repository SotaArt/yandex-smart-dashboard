import { Router, type IRouter } from "express";
import healthRouter from "./health";
import yandexRouter from "./yandex";
import weatherRouter from "./weather";

const router: IRouter = Router();

router.use(healthRouter);
router.use(yandexRouter);
router.use(weatherRouter);

export default router;
