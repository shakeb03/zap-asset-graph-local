import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from repo root first, then backend/ (so backend/.env can override)
config({ path: resolve(process.cwd(), '..', '.env') });
config({ path: resolve(process.cwd(), '.env') });

import express from 'express';
import cors from 'cors';
import assetsRoutes from './routes/assets';
import healthRoutes from './routes/health';
import auditRoutes from './routes/audit';
import assistantRoutes from './routes/assistant';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/assets', assetsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/assistant', assistantRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
