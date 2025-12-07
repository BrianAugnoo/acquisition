import express from 'express';
import logger from './config/logger.js';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import router from './routes/auth.routes.js';
import securityMiddleware from '#middleware/security.middleware.js';
const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(cors());
app.use(cookieParser());
app.use(securityMiddleware);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});


app.get('/', (req, res) => {
  logger.info('Received request for root endpoint');
  res.status(200).send('Hello from acquisition api!');
});

app.get('/api', (req, res) => {
  res.status(200).json({ message: 'Welcome to the Acquisition API', version: '1.0.0' });
});

app.use('/api/auth', router);

export default app;
