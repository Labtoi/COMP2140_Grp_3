import 'dotenv/config';
import path from 'path';
import express from 'express';
import { supabase } from './config/supabase';
import { SqlAccountRepository } from './repositories/SqlAccountRepository';
import { SqlMSRepository } from './repositories/SqlMSRepository';
import { NutritionInformation } from './mainClasses/NutritionInformation';
import { createChefRouter } from './routes/chefRouting';

const app = express();
const PORT = process.env.PORT || 2000;

// IChefRepo (chef details, login) and INutritionRepository + IPreplistRepository (menu, nutrition, prep)
const accountRepo = new SqlAccountRepository();
const msRepo = new SqlMSRepository(supabase);
const nutrition = new NutritionInformation(msRepo);

app.set('trust proxy', 1);   // needed on most hosts so req.ip is the real visitor
app.use(express.json());

// The chef page itself is public HTML; it contains no data. Data needs a chef login.
app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'chef.html' }));

app.get('/health', (_req, res) => {
  res.json({ success: true });
});

app.use('/', createChefRouter(nutrition, msRepo, accountRepo));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
