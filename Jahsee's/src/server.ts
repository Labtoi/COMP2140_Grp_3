import 'dotenv/config';
import express from 'express';
import pool from './config/postgres';
import { createRouter } from './routes/routing';
import { IAnalysisRepo } from './interfaces/IAnalysisRepo';
import { databaseAnalysisRepository } from './repositories/databaseAnalysisRepository';
import { StockAnalysis } from './mainClasses/StockAnalysis'

const app = express();
const PORT = process.env.PORT || 3000;

const repo: IAnalysisRepo = new databaseAnalysisRepository(pool);
const stockAnalysis: new StockAnalysis(repo);

app.use(express.json());
app.use('/', createRouter(stockAnalysis));

app.get('/health', async (_req, res) => {
  const result = await pool.query('SELECT NOW()');
  res.json({ success: true, time: result.rows[0].now });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));