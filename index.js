require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRouter    = require('./routes/auth');
const coursesRouter = require('./routes/courses');
const webhookRouter = require('./routes/webhook');

const app = express();

app.use(cors({
  origin: [
    'https://academia-solupro.com',
    'https://solupro-frontend.vercel.app',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.get('/', (req, res) => res.send('🚀 Academia SoluPro API v8.0 Online'));

app.use('/api', authRouter);
app.use('/api', coursesRouter);
app.use('/api', webhookRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('🚀 SoluPro v8.0 listo en puerto ' + PORT));
