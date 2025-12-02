import dotenv from 'dotenv';
import express from 'express';
import { createTrackingService } from './service.js';

dotenv.config();

const service = createTrackingService(process.env);
const { config, fetchDailySnapshot, fetchGlobalSnapshot, persistDailyEntries } = service;
const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.get('/api/trackers/global', async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined;
    const snapshot = await fetchGlobalSnapshot(days);
    res.json({ ok: true, data: snapshot });
  } catch (error) {
    console.error('Failed to load global snapshot', error);
    res.status(500).json({ ok: false, error: 'Failed to load global snapshot.' });
  }
});

app.get('/api/trackers/daily', async (req, res) => {
  try {
    const snapshot = await fetchDailySnapshot(req.query.date);
    res.json({ ok: true, data: snapshot });
  } catch (error) {
    console.error('Failed to load daily snapshot', error);
    res.status(500).json({ ok: false, error: 'Failed to load daily snapshot.' });
  }
});

app.post('/api/trackers/daily', async (req, res) => {
  const { date, updates } = req.body ?? {};
  if (!Array.isArray(updates)) {
    return res.status(400).json({ ok: false, error: 'updates must be an array.' });
  }
  try {
    const payload = await persistDailyEntries(date, updates);
    res.json({ ok: true, data: payload });
  } catch (error) {
    console.error('Failed to save daily entries', error);
    res.status(500).json({ ok: false, error: 'Failed to save daily entries.' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`Tracking API listening on http://localhost:${config.port}`);
});
