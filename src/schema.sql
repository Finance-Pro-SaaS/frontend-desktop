-- =====================================================================
-- ONG FINANCE PRO — SCHÉMA SQLITE (BASE LOCALE / OFFLINE FIRST)
-- Chaque table métier porte : server_id, sync_status, is_dirty,
-- local_updated_at, is_deleted (soft delete pour propager les suppressions)
--
-- Convention d'identifiants :
--   id          -> identifiant LOCAL (TEXT, UUID généré côté client)
--   server_id   -> identifiant renvoyé par le serveur une fois synchronisé
--                  (NULL tant que l'enregistrement n'a jamais été poussé)
--   sync_status -> 'synced' | 'pending' | 'syncing' | 'conflict' | 'error'
-- =====================================================================

PRAGMA foreign_keys = ON;

-- =====================================================================
-- 0. PARAMÈTRES LOCAUX DE L'APPAREIL (clé-valeur)
-- =====================================================================

CREATE TABLE app_settings (
    key     TEXT PRIMARY KEY,
    value   TEXT
);
-- Exemples de clés : device_uuid, current_user_id, current_organization_id,
-- last_full_sync_at, api_base_url, preferred_language

-- =====================================================================
-- 1. RÉFÉRENCES MISES EN CACHE DEPUIS LE SERVEUR (lecture seule locale)
-- =====================================================================

CREATE TABLE organizations_local (
    id                  TEXT PRIMARY KEY,          -- = server_id (UUID)
    name                TEXT NOT NULL,
    acronym             TEXT,
    default_currency    TEXT NOT NULL DEFAULT 'XOF',
    logo_path           TEXT,
    cached_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users_local (
    id                  TEXT PRIMARY KEY,
    full_name           TEXT NOT NULL,
    email               TEXT,
    role_code           TEXT,                       -- rôle dans l'organisation courante
    cached_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects_local (
    id                  TEXT PRIMARY KEY,           -- server_id si connu, sinon local temp id
    server_id           TEXT,
    organization_id     TEXT NOT NULL,
    donor_id            TEXT,
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    total_budget        REAL NOT NULL DEFAULT 0,
    currency             TEXT NOT NULL DEFAULT 'XOF',
    start_date          TEXT,
    end_date            TEXT,
    status              TEXT NOT NULL DEFAULT 'draft',
    project_manager_id  TEXT,
    sync_status         TEXT NOT NULL DEFAULT 'synced',
    is_dirty            INTEGER NOT NULL DEFAULT 0,
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    local_updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE budget_lines_local (
    id              TEXT PRIMARY KEY,
    server_id       TEXT,
    project_id      TEXT NOT NULL,
    code            TEXT,
    category        TEXT NOT NULL,
    planned_amount  REAL NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'XOF',
    sync_status     TEXT NOT NULL DEFAULT 'synced',
    is_dirty        INTEGER NOT NULL DEFAULT 0,
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    local_updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE expense_categories_local (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT,
    code        TEXT,
    name        TEXT NOT NULL,
    cached_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE payment_methods_local (
    id                  INTEGER PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    requires_reference  INTEGER NOT NULL DEFAULT 0
);

-- =====================================================================
-- 2. DONNÉES MÉTIER CRÉÉES LOCALEMENT (source des sync "push")
-- =====================================================================

CREATE TABLE expenses_local (
    id                      TEXT PRIMARY KEY,       -- UUID généré localement à la création
    server_id               TEXT,                    -- rempli après premier sync réussi
    organization_id         TEXT NOT NULL,
    project_id              TEXT NOT NULL,
    budget_line_id          TEXT,
    category_id             TEXT,
    amount                  REAL NOT NULL,
    currency                TEXT NOT NULL DEFAULT 'XOF',
    amount_in_org_currency  REAL,
    supplier_name           TEXT,
    supplier_contact        TEXT,
    payment_method_id       INTEGER NOT NULL,
    payment_reference       TEXT,
    expense_date            TEXT NOT NULL,           -- format ISO 'YYYY-MM-DD'
    description             TEXT,
    status                  TEXT NOT NULL DEFAULT 'draft',
    created_by              TEXT NOT NULL,           -- user_id
    approved_by             TEXT,
    approved_at             TEXT,
    rejection_reason        TEXT,

    -- colonnes de synchronisation
    sync_status             TEXT NOT NULL DEFAULT 'pending',   -- pending | syncing | synced | conflict | error
    is_dirty                INTEGER NOT NULL DEFAULT 1,
    is_deleted              INTEGER NOT NULL DEFAULT 0,
    local_updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    server_updated_at       TEXT,                    -- dernière valeur connue côté serveur (pour détection de conflit)
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_expenses_local_sync ON expenses_local(sync_status);
CREATE INDEX idx_expenses_local_project ON expenses_local(project_id, expense_date);

CREATE TABLE revenues_local (
    id                      TEXT PRIMARY KEY,
    server_id               TEXT,
    organization_id         TEXT NOT NULL,
    project_id              TEXT,
    donor_id                TEXT,
    amount                  REAL NOT NULL,
    currency                TEXT NOT NULL DEFAULT 'XOF',
    amount_in_org_currency  REAL,
    revenue_type            TEXT NOT NULL,
    received_date           TEXT NOT NULL,
    payment_method_id       INTEGER NOT NULL,
    payment_reference       TEXT,
    description             TEXT,
    status                  TEXT NOT NULL DEFAULT 'draft',
    created_by              TEXT NOT NULL,

    sync_status             TEXT NOT NULL DEFAULT 'pending',
    is_dirty                INTEGER NOT NULL DEFAULT 1,
    is_deleted              INTEGER NOT NULL DEFAULT 0,
    local_updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    server_updated_at       TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_revenues_local_sync ON revenues_local(sync_status);

CREATE TABLE documents_local (
    id                  TEXT PRIMARY KEY,
    server_id           TEXT,
    owner_type          TEXT NOT NULL,       -- expense, revenue, project...
    owner_id            TEXT NOT NULL,       -- id LOCAL de l'objet parent
    file_name           TEXT NOT NULL,
    local_file_path     TEXT NOT NULL,        -- chemin sur le disque de l'appareil
    remote_file_path    TEXT,                 -- chemin cloud une fois uploadé
    file_type            TEXT,
    file_size_bytes      INTEGER,
    sha256_hash          TEXT NOT NULL,
    uploaded_by          TEXT NOT NULL,

    sync_status          TEXT NOT NULL DEFAULT 'pending',   -- upload du FICHIER, distinct des métadonnées
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    is_deleted             INTEGER NOT NULL DEFAULT 0,
    local_updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_documents_local_owner ON documents_local(owner_type, owner_id);
CREATE INDEX idx_documents_local_sync ON documents_local(sync_status);

CREATE TABLE mobile_money_transactions_local (
    id                      TEXT PRIMARY KEY,
    server_id               TEXT,
    organization_id         TEXT NOT NULL,
    provider                TEXT NOT NULL,       -- mtn, moov, orange
    provider_transaction_id TEXT NOT NULL,
    phone_number            TEXT NOT NULL,
    amount                  REAL NOT NULL,
    currency                TEXT NOT NULL DEFAULT 'XOF',
    transaction_type        TEXT NOT NULL,
    transaction_date        TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'en_attente',
    reconciled_expense_id   TEXT,
    reconciled_revenue_id   TEXT,

    sync_status              TEXT NOT NULL DEFAULT 'pending',
    is_dirty                  INTEGER NOT NULL DEFAULT 1,
    is_deleted                 INTEGER NOT NULL DEFAULT 0,
    local_updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE approval_actions_local (
    id              TEXT PRIMARY KEY,
    server_id       TEXT,
    approvable_type TEXT NOT NULL,      -- expense | revenue
    approvable_id   TEXT NOT NULL,       -- id LOCAL de la dépense/recette
    approver_id     TEXT NOT NULL,
    action          TEXT NOT NULL,        -- approved | rejected | returned
    comment         TEXT,
    action_at       TEXT NOT NULL DEFAULT (datetime('now')),

    sync_status     TEXT NOT NULL DEFAULT 'pending',
    is_dirty        INTEGER NOT NULL DEFAULT 1
);

-- =====================================================================
-- 3. FILE DE SYNCHRONISATION (moteur de sync)
-- =====================================================================

CREATE TABLE sync_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,          -- expenses, revenues, documents, mobile_money_transactions...
    entity_id       TEXT NOT NULL,           -- id LOCAL de l'enregistrement concerné
    operation       TEXT NOT NULL,            -- insert | update | delete
    payload         TEXT,                      -- JSON sérialisé de l'enregistrement au moment de la mise en file
    priority        INTEGER NOT NULL DEFAULT 5, -- 1 = critique (comptable) ... 9 = accessoire (photos HD)
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending | syncing | synced | failed
    retry_count     INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at       TEXT
);
CREATE INDEX idx_sync_queue_status ON sync_queue(status, priority);

-- Conflits détectés localement, en attente d'affichage à l'utilisateur
CREATE TABLE sync_conflicts_local (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    local_version   TEXT NOT NULL,      -- JSON
    server_version  TEXT NOT NULL,      -- JSON
    detected_at     TEXT NOT NULL DEFAULT (datetime('now')),
    resolution      TEXT NOT NULL DEFAULT 'pending',   -- server_wins | client_wins | manual | pending
    resolved_at     TEXT
);

-- Journal d'audit local (répliqué vers audit_logs au serveur lors du sync)
CREATE TABLE audit_logs_local (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    action          TEXT NOT NULL,          -- create | update | delete | approve | reject | login
    old_values      TEXT,                    -- JSON
    new_values      TEXT,                    -- JSON
    user_id         TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    sync_status     TEXT NOT NULL DEFAULT 'pending'
);

-- =====================================================================
-- 4. TRIGGERS UTILES
-- =====================================================================

-- Marque automatiquement une dépense comme "dirty" et "pending" dès
-- qu'elle est modifiée, et l'ajoute à la file de synchronisation.
CREATE TRIGGER trg_expenses_local_update
AFTER UPDATE ON expenses_local
FOR EACH ROW
WHEN NEW.is_dirty = 0
BEGIN
    UPDATE expenses_local
       SET is_dirty = 1,
           sync_status = 'pending',
           local_updated_at = datetime('now')
     WHERE id = NEW.id;
END;

CREATE TRIGGER trg_expenses_local_insert
AFTER INSERT ON expenses_local
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (entity_type, entity_id, operation, priority)
    VALUES ('expenses', NEW.id, 'insert', 1);
END;

CREATE TRIGGER trg_revenues_local_insert
AFTER INSERT ON revenues_local
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (entity_type, entity_id, operation, priority)
    VALUES ('revenues', NEW.id, 'insert', 1);
END;

-- Les documents (photos/PDF) sont prioritaires 8 : ils passent APRÈS
-- les données comptables critiques, pour économiser la bande passante 2G.
CREATE TRIGGER trg_documents_local_insert
AFTER INSERT ON documents_local
FOR EACH ROW
BEGIN
    INSERT INTO sync_queue (entity_type, entity_id, operation, priority)
    VALUES ('documents', NEW.id, 'insert', 8);
END;
