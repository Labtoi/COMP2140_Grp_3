import 'dotenv/config';
import path from 'path';
import express from 'express';

import pool from './shared/src/config/postgres';
import { supabase } from './shared/src/config/supabase';

import { SqlAccountRepository } from './shared/src/repositories/SqlAccountRepository';
import { SqlMSRepository } from './shared/src/repositories/SqlMSRepository';
import { SqlStockRepository } from './owner/src/repositories/SqlStockRepository';
import { SqlAnalysisRepository } from './owner/src/repositories/SqlAnalysisRepository';

import { StockManagement } from './owner/src/mainClasses/StockManagement';
import { StockAnalysis } from './owner/src/mainClasses/StockAnalysis';
import { NutritionInformation } from './shared/src/mainClasses/NutritionInformation';
import { OrderProcessing } from './shared/src/mainClasses/OrderProcessing';

import { createCustomerRouter } from './customer/src/routes/customerRouting';
import { createOrderRouter } from './customer/src/routes/orderRouting';
import { createChefRouter } from './chef/src/routes/chefRouting';
import { createRouter as createAnalysisRouter } from './owner/src/routes/analysisRouting';
import { createStockRouter } from './owner/src/routes/stockRouting';
import { createAccountsRouter } from './owner/src/routes/accountsRouting';
import { createOwnerMenuRouter } from './owner/src/routes/ownerMenuRouting';

const app = express();
const PORT = process.env.PORT || 3000;

// ---- one set of objects, shared by the customer, chef and owner pages ----
// Orders are kept in memory inside OrderProcessing, so all three roles must talk to the SAME server process.
const accountRepo = new SqlAccountRepository();                 // IChefRepo + ICustomerRepo
const msRepo = new SqlMSRepository(supabase);                    // menu, nutrition, prep (SqlDatabaseMeals / Sides / Prep)
const stockManagement = new StockManagement(new SqlStockRepository(pool));       // SqlDatabaseM
const stockAnalysis = new StockAnalysis(new SqlAnalysisRepository(pool));        // SqlDatabaseA
const nutrition = new NutritionInformation(msRepo, msRepo);
const orders = new OrderProcessing({ menu: msRepo, prepRepo: msRepo, stock: stockManagement, analysis: stockAnalysis, nutrition });

app.set('trust proxy', 1); // so req.ip is the real visitor behind a host's proxy
app.use(express.json({ limit: '100kb' }));

// The pages are public HTML; they contain no data and no key. Each role keeps its page in its own folder:
//   /customer.html   /chef.html   /owner.html      ("/" opens the customer page)
app.use(express.static(path.join(__dirname, 'customer', 'public'), { index: 'customer.html' }));
app.use(express.static(path.join(__dirname, 'chef', 'public')));
app.use(express.static(path.join(__dirname, 'owner', 'public')));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true });
  } catch (error) {
    console.error('Health check: database not reachable', error);
    res.status(503).json({ success: false, message: 'Database not reachable' });
  }
});

// customers: login, menu, ordering, pickup notification
app.use('/', createCustomerRouter(accountRepo));
app.use('/', createOrderRouter({ accounts: accountRepo, orders, nutrition }));
// chefs: login, menu / nutrition / prep editing, incoming orders, "order ready"
app.use('/', createChefRouter(nutrition, msRepo, accountRepo, orders));
// owner (x-owner-key): analysis, stock, accounts, menu overview
app.use('/', createAnalysisRouter(stockAnalysis));
app.use('/', createStockRouter(stockManagement));
app.use('/', createAccountsRouter(accountRepo));
app.use('/', createOwnerMenuRouter(nutrition));

orders.clearOrphanedTasks()
  .then((n) => { if (n) console.log(`Removed ${n} order prep task(s) left over from before the restart.`); })
  .catch((e) => console.error('Could not clear old order prep tasks:', e));

app.listen(PORT, () => console.log(`Registrar Bites running on port ${PORT} (customer.html, chef.html, owner.html)`));
