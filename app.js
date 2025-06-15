const express = require('express');
const pool = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Rota: resumo de contas por data
app.get('/7ca54631c26827f57b08354475acd64f/accounts-summary', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Parâmetro "date" é obrigatório (formato YYYY-MM-DD).' });

  try {
    const [rows] = await pool.query(`
      SELECT 
        a.invoiceid,
        a.gateway,
        SUM(a.amountin) AS total_amountin,
        SUM(a.fees) AS total_fees
      FROM tblaccounts a
      JOIN tblinvoices i ON i.id = a.invoiceid
      WHERE DATE(i.datepaid) = ?
        AND i.status = 'Paid'
      GROUP BY a.invoiceid, a.gateway
    `, [date]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar resumo de contas', details: err.message });
  }
});

// Rota: detalhamento de transações por painel e cliente
app.get('/7ca54631c26827f57b08354475acd64f/transactions/detailed', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Parâmetros "start" e "end" são obrigatórios (formato YYYY-MM-DD).' });

  try {
    const [rows] = await pool.query(`
      SELECT 
        mt.id AS transaction_id,
        mt.date,
        mt.amount,
        mt.credits_total,
        mt.panel_type AS painel,
        mt.payment_method AS gateway,
        mt.sanding_status,
        mt.client_id,
        mt.client_name,
        mt.client_email,
        mt.client_data_registration,
        mt.cupom_code,
        mt.currency,
        mt.external_reference,
        mt.amount AS bruto,
        COALESCE(a.fees, 0) AS taxas,
        (mt.amount - COALESCE(a.fees, 0)) AS liquido
      FROM mod_transactions mt
      LEFT JOIN (
        SELECT invoiceid, SUM(fees) AS fees
        FROM tblaccounts
        GROUP BY invoiceid
      ) a ON a.invoiceid = mt.external_reference
      WHERE DATE(mt.date) BETWEEN ? AND ?
      ORDER BY mt.date DESC
    `, [start, end]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar transações detalhadas', details: err.message });
  }
});

// Rota: buscar cliente e cupom por invoice
app.get('/7ca54631c26827f57b08354475acd64f/client-cupom', async (req, res) => {
  const { invoiceid } = req.query;
  if (!invoiceid) return res.status(400).json({ error: 'Parâmetro "invoiceid" é obrigatório.' });

  try {
    const [rows] = await pool.query(`
      SELECT 
        u.id AS client_id,
        u.firstname AS client_name,
        u.email AS client_email,
        u.datecreated AS client_data_registration,
        (
          SELECT ii.description
          FROM tblinvoiceitems ii
          WHERE ii.invoiceid = i.id
            AND (ii.description LIKE '%cupom%' OR ii.description LIKE '%desconto%' OR ii.type = 'Promoção')
          ORDER BY ii.id DESC
          LIMIT 1
        ) AS cupom_code
      FROM tblinvoices i
      JOIN tblclients u ON u.id = i.userid
      WHERE i.id = ?
    `, [invoiceid]);

    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dados do cliente', details: err.message });
  }
});

// Rota única com todos os dados detalhados filtrados por período, incluindo painel e créditos via tblinvoiceitems/mod_recarga_produto
app.get('/7ca54631c26827f57b08354475acd64f/transactions/full-report', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Parâmetros "start" e "end" são obrigatórios (formato YYYY-MM-DD).' });

  try {
    const [rows] = await pool.query(`
      SELECT 
        i.id AS invoice_id,
        i.datepaid AS date,
        i.total AS bruto,
        i.paymentmethod AS gateway,
        u.id AS client_id,
        u.firstname AS client_name,
        u.email AS client_email,
        u.datecreated AS client_data_registration,
        rp.painel,
        rp.creditos,
        (
          SELECT ii.description
          FROM tblinvoiceitems ii
          WHERE ii.invoiceid = i.id
            AND (ii.description LIKE '%cupom%' OR ii.description LIKE '%desconto%' OR ii.type = 'Promoção')
          ORDER BY ii.id DESC
          LIMIT 1
        ) AS cupom_code,
        ac.amountin AS real_amount,
        ac.fees AS taxas,
        (ac.amountin - ac.fees) AS liquido
      FROM tblinvoices i
      JOIN tblclients u ON u.id = i.userid
      JOIN tblinvoiceitems ii ON ii.invoiceid = i.id
      JOIN mod_recarga_produto rp ON rp.product_id = ii.product
      LEFT JOIN (
        SELECT invoiceid, SUM(amountin) AS amountin, SUM(fees) AS fees
        FROM tblaccounts
        GROUP BY invoiceid
      ) ac ON ac.invoiceid = i.id
      WHERE DATE(i.datepaid) BETWEEN ? AND ?
        AND i.status = 'Paid'
      ORDER BY i.datepaid DESC
    `, [start, end]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar relatório completo de transações', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
