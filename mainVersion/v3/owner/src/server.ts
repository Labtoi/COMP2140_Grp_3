import 'dotenv/config';
import path from 'path';
import express from 'express';
import pool from './config/postgres';
import { createRouter } from './routes/analysisRouting';
import { IAnalysisRepo } from './interfaces/IAnalysisRepo';
import { SqlAnalysisRepository } from './repositories/SqlAnalysisRepository';
import { StockAnalysis } from './mainClasses/StockAnalysis'
import { IStockRepository } from './interfaces/IStockRepository';
import { IStockService } from './interfaces/IStockService';
import { SqlStockRepository } from './repositories/SqlStockRepository';
import { StockManagement } from './mainClasses/StockManagement';
import { createStockRouter } from './routes/stockRouting';
import { SqlAccountRepository } from './repositories/SqlAccountRepository';
import { createAccountsRouter } from './routes/accountsRouting';
import { supabase } from './config/supabase';
import { SqlMSRepository } from './repositories/SqlMSRepository';
import { NutritionInformation } from './mainClasses/NutritionInformation';
import { createOwnerMenuRouter } from './routes/ownerMenuRouting';


const app = express();
const PORT = process.env.PORT || 3000;

const repo: IAnalysisRepo = new SqlAnalysisRepository(pool);
const stockAnalysis = new StockAnalysis(repo);
const stockRepo: IStockRepository = new SqlStockRepository(pool);
const stockManagement: IStockService = new StockManagement(stockRepo);
const accountRepo = new SqlAccountRepository();
const msRepo = new SqlMSRepository(supabase);
const nutrition = new NutritionInformation(msRepo, msRepo);

app.set('trust proxy', 1);                       // needed on most hosts so req.ip is the real visitor
app.use(express.json());

// The owner page itself is public HTML; it contains no data and no key.
app.use(express.static(path.join(__dirname, '..', 'public'), {index: 'owner.html'}));

app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ success: true });
});

app.use('/', createRouter(stockAnalysis));
app.use('/', createStockRouter(stockManagement)); 
app.use('/', createAccountsRouter(accountRepo));
app.use('/', createOwnerMenuRouter(nutrition));


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
