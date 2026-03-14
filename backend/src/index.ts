import express from 'express';
import cors from 'cors';
import assetsRoutes from './routes/assets';
import healthRoutes from './routes/health';
import auditRoutes from './routes/audit';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/assets', assetsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/audit', auditRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
