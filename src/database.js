const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

let db = null

/**
 * Ouvre (ou crée) la base SQLite locale dans le dossier userData de l'app,
 * et applique le schéma s'il n'a jamais été appliqué (première ouverture).
 *
 * @param {string} userDataPath - app.getPath('userData')
 * @returns {import('better-sqlite3').Database}
 */
function initDatabase(userDataPath) {
  if (db) return db

  const dbPath = path.join(userDataPath, 'finance-pro.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL') // meilleures perfs + tolérance aux coupures brutales
  db.pragma('foreign_keys = ON')

  const alreadyInitialized = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'")
    .get()

  if (!alreadyInitialized) {
    const schemaPath = path.join(__dirname, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf-8')
    db.exec(schema)
  }

  return db
}

function getDb() {
  if (!db) {
    throw new Error('Base de données non initialisée — appeler initDatabase() au démarrage de l\'app.')
  }
  return db
}

function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}

// ---------------------------------------------------------------------
// Paramètres locaux (clé-valeur)
// ---------------------------------------------------------------------

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key)
  return row ? row.value : null
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT key, value FROM app_settings').all()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

function setSetting(key, value) {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value)
  return { key, value }
}

// ---------------------------------------------------------------------
// Dépenses (expenses_local)
// ---------------------------------------------------------------------

function listExpenses({ projectId, status } = {}) {
  let query = 'SELECT * FROM expenses_local WHERE is_deleted = 0'
  const params = []

  if (projectId) {
    query += ' AND project_id = ?'
    params.push(projectId)
  }
  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }
  query += ' ORDER BY expense_date DESC'

  return getDb().prepare(query).all(...params)
}

function createExpense(expense) {
  const id = expense.id || crypto.randomUUID()
  const now = new Date().toISOString()

  getDb()
    .prepare(
      `INSERT INTO expenses_local (
        id, organization_id, project_id, budget_line_id, category_id,
        amount, currency, amount_in_org_currency, supplier_name, supplier_contact,
        payment_method_id, payment_reference, expense_date, description,
        status, created_by, created_at
      ) VALUES (
        @id, @organizationId, @projectId, @budgetLineId, @categoryId,
        @amount, @currency, @amountInOrgCurrency, @supplierName, @supplierContact,
        @paymentMethodId, @paymentReference, @expenseDate, @description,
        @status, @createdBy, @now
      )`
    )
    .run({
      id,
      organizationId: expense.organizationId,
      projectId: expense.projectId,
      budgetLineId: expense.budgetLineId || null,
      categoryId: expense.categoryId || null,
      amount: expense.amount,
      currency: expense.currency || 'XOF',
      amountInOrgCurrency: expense.amountInOrgCurrency || null,
      supplierName: expense.supplierName || null,
      supplierContact: expense.supplierContact || null,
      paymentMethodId: expense.paymentMethodId,
      paymentReference: expense.paymentReference || null,
      expenseDate: expense.expenseDate,
      description: expense.description || null,
      status: expense.status || 'draft',
      createdBy: expense.createdBy,
      now,
    })

  return getDb().prepare('SELECT * FROM expenses_local WHERE id = ?').get(id)
}

function updateExpense(id, patch) {
  const existing = getDb().prepare('SELECT * FROM expenses_local WHERE id = ?').get(id)
  if (!existing) {
    throw new Error(`Dépense introuvable : ${id}`)
  }

  const allowedFields = [
    'budget_line_id', 'category_id', 'amount', 'currency', 'amount_in_org_currency',
    'supplier_name', 'supplier_contact', 'payment_method_id', 'payment_reference',
    'expense_date', 'description', 'status', 'approved_by', 'approved_at', 'rejection_reason',
  ]

  const fieldsToUpdate = Object.keys(patch).filter((k) => allowedFields.includes(k))
  if (fieldsToUpdate.length === 0) return existing

  const setClause = fieldsToUpdate.map((f) => `${f} = @${f}`).join(', ')
  getDb()
    .prepare(`UPDATE expenses_local SET ${setClause} WHERE id = @id`)
    .run({ id, ...patch })
  // Le trigger trg_expenses_local_update se charge de is_dirty / sync_status / local_updated_at

  return getDb().prepare('SELECT * FROM expenses_local WHERE id = ?').get(id)
}

// ---------------------------------------------------------------------
// Recettes (revenues_local)
// ---------------------------------------------------------------------

function listRevenues({ projectId, status } = {}) {
  let query = 'SELECT * FROM revenues_local WHERE is_deleted = 0'
  const params = []

  if (projectId) {
    query += ' AND project_id = ?'
    params.push(projectId)
  }
  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }
  query += ' ORDER BY received_date DESC'

  return getDb().prepare(query).all(...params)
}

function createRevenue(revenue) {
  const id = revenue.id || crypto.randomUUID()
  const now = new Date().toISOString()

  getDb()
    .prepare(
      `INSERT INTO revenues_local (
        id, organization_id, project_id, donor_id, amount, currency,
        amount_in_org_currency, revenue_type, received_date, payment_method_id,
        payment_reference, description, status, created_by, created_at
      ) VALUES (
        @id, @organizationId, @projectId, @donorId, @amount, @currency,
        @amountInOrgCurrency, @revenueType, @receivedDate, @paymentMethodId,
        @paymentReference, @description, @status, @createdBy, @now
      )`
    )
    .run({
      id,
      organizationId: revenue.organizationId,
      projectId: revenue.projectId || null,
      donorId: revenue.donorId || null,
      amount: revenue.amount,
      currency: revenue.currency || 'XOF',
      amountInOrgCurrency: revenue.amountInOrgCurrency || null,
      revenueType: revenue.revenueType,
      receivedDate: revenue.receivedDate,
      paymentMethodId: revenue.paymentMethodId,
      paymentReference: revenue.paymentReference || null,
      description: revenue.description || null,
      status: revenue.status || 'draft',
      createdBy: revenue.createdBy,
      now,
    })

  return getDb().prepare('SELECT * FROM revenues_local WHERE id = ?').get(id)
}

// ---------------------------------------------------------------------
// File de synchronisation
// ---------------------------------------------------------------------

function getSyncQueueStatus() {
  const rows = getDb()
    .prepare('SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status')
    .all()
  return Object.fromEntries(rows.map((r) => [r.status, r.count]))
}

function listPendingSyncItems(limit = 50) {
  return getDb()
    .prepare('SELECT * FROM sync_queue WHERE status = ? ORDER BY priority ASC, created_at ASC LIMIT ?')
    .all('pending', limit)
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  getSetting,
  getAllSettings,
  setSetting,
  listExpenses,
  createExpense,
  updateExpense,
  listRevenues,
  createRevenue,
  getSyncQueueStatus,
  listPendingSyncItems,
}
