import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import roomsRouter from './rooms';
import devicesRouter from './devices';

const router = Router();

router.use(healthRouter);
router.use('/api', authRouter);
router.use('/api', roomsRouter);
router.use('/api', devicesRouter);

export default router;
