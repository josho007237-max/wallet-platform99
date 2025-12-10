import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import authRouter from './routes/auth';
import ezrichRouter from './routes/ezrich';
import withdrawalSettingsRouter from './routes/withdrawalSettings';
import withdrawRouter from './routes/withdraw';
import depositRouter from './routes/deposit';
import walletRouter from './routes/wallet';
import webhookTrueMoney from './routes/webhookTrueMoney';
import webhookPromptPay from './routes/webhookPromptPay';
import './workers'; // start queue processors
import './cron';    // balance polling

const app = express();
app.use(cors());
app.use(express.json());

// Public
app.use(authRouter);
app.use(webhookTrueMoney);
app.use(webhookPromptPay);

// Protected (TODO: add real auth guards instead of stubs)
app.use(ezrichRouter);
app.use(withdrawalSettingsRouter);
app.use(withdrawRouter);
app.use(depositRouter);
app.use(walletRouter);

app.listen(3000, () => console.log('API running on :3000'));
