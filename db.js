const mysql = require('mysql2/promise');
require('dotenv').config();

// Conexão padrão (WHMCS principal)
const poolDefault = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Conexão separada para o DROPAGE
const poolDropage = mysql.createPool({
  host: process.env.DB_HOST_DROPAGE,
  user: process.env.DB_USER_DROPAGE,
  password: process.env.DB_PASS_DROPAGE,
  database: process.env.DB_NAME_DROPAGE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = { poolDefault, poolDropage };
