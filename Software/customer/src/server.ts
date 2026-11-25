import 'dotenv/config';
import path from 'path';
import express from 'express';
import { SqlAccountRepository } from './repositories/SqlAccountRepository.js';
import { createCustomerRouter } from './routes/customerRouting.js';

const app = express();
// 3001 so it doesn't clash with the owner server (3000) when both run locally.
const PORT = process.env.PORT || 3001;

const accountRepo = new SqlAccountRepository();

app.set('trust proxy', 1); // so req.ip is the real visitor behind a host's proxy
app.use(express.json({ limit: '10kb' }));

// The customer page itself is public HTML; it contains no data and no key.
app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'customer.html' }));

app.get('/health', (_req, res) => {
  res.json({ success: true });
});

app.use('/', createCustomerRouter(accountRepo));

app.listen(PORT, () => console.log(`Customer server running on port ${PORT}`));
