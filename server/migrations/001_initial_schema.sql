-- ============================================================
--  FloorVerse — Initial Database Schema
--  Compatible with: MySQL 5.7+, MySQL 8+, MariaDB 10.3+
-- ============================================================

CREATE DATABASE IF NOT EXISTS floorverse
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE floorverse;

-- ─────────────────────────────────────────────────────────
--  TENANTS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              VARCHAR(36)   NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  slug            VARCHAR(100)  NOT NULL,
  plan            ENUM('starter','pro','business','enterprise') NOT NULL DEFAULT 'starter',
  status          ENUM('active','suspended','cancelled','trial') NOT NULL DEFAULT 'trial',
  logo_url        VARCHAR(500)  DEFAULT NULL,
  brand_color     VARCHAR(7)    NOT NULL DEFAULT '#1A3C6B',
  custom_domain   VARCHAR(255)  DEFAULT NULL,
  subscription_id VARCHAR(255)  DEFAULT NULL,
  max_floor_plans INT           NOT NULL DEFAULT 5,
  trial_ends_at   TIMESTAMP     NULL DEFAULT NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)   NOT NULL,
  tenant_id     VARCHAR(36)   DEFAULT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  DEFAULT NULL,
  first_name    VARCHAR(100)  NOT NULL,
  last_name     VARCHAR(100)  NOT NULL,
  role          ENUM('super_admin','tenant_admin','designer','sales_manager','consumer') NOT NULL DEFAULT 'consumer',
  avatar_url    VARCHAR(500)  DEFAULT NULL,
  phone         VARCHAR(20)   DEFAULT NULL,
  is_verified   TINYINT(1)    NOT NULL DEFAULT 0,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  last_login    TIMESTAMP     NULL DEFAULT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_tenant_id (tenant_id),
  KEY idx_users_role (role),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
--  REFRESH TOKENS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         VARCHAR(36)  NOT NULL,
  user_id    VARCHAR(36)  NOT NULL,
  token      VARCHAR(512) NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rt_user_id (user_id),
  KEY idx_rt_token (token(64)),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
--  BUILDINGS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buildings (
  id              VARCHAR(36)   NOT NULL,
  tenant_id       VARCHAR(36)   NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  address         TEXT          DEFAULT NULL,
  city            VARCHAR(100)  DEFAULT NULL,
  state           VARCHAR(100)  DEFAULT NULL,
  pincode         VARCHAR(10)   DEFAULT NULL,
  latitude        DECIMAL(10,8) DEFAULT NULL,
  longitude       DECIMAL(11,8) DEFAULT NULL,
  total_floors    INT           NOT NULL DEFAULT 1,
  description     TEXT          DEFAULT NULL,
  cover_image_url VARCHAR(500)  DEFAULT NULL,
  status          ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
  created_by      VARCHAR(36)   DEFAULT NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_buildings_tenant_id (tenant_id),
  KEY idx_buildings_city (city),
  KEY idx_buildings_status (status),
  CONSTRAINT fk_buildings_tenant  FOREIGN KEY (tenant_id)  REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_buildings_creator FOREIGN KEY (created_by) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
--  FLOOR PLANS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plans (
  id            VARCHAR(36)   NOT NULL,
  tenant_id     VARCHAR(36)   NOT NULL,
  building_id   VARCHAR(36)   NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  floor_number  INT           NOT NULL DEFAULT 1,
  unit_type     VARCHAR(20)   DEFAULT NULL,
  area_sqft     DECIMAL(10,2) DEFAULT NULL,
  price_min     DECIMAL(15,2) DEFAULT NULL,
  price_max     DECIMAL(15,2) DEFAULT NULL,
  canvas_data   LONGTEXT      DEFAULT NULL,
  scene_data    LONGTEXT      DEFAULT NULL,
  scene_url     VARCHAR(500)  DEFAULT NULL,
  thumbnail_url VARCHAR(500)  DEFAULT NULL,
  is_published  TINYINT(1)    NOT NULL DEFAULT 0,
  published_at  TIMESTAMP     NULL DEFAULT NULL,
  view_count    INT           NOT NULL DEFAULT 0,
  created_by    VARCHAR(36)   DEFAULT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fp_tenant_id (tenant_id),
  KEY idx_fp_building_id (building_id),
  KEY idx_fp_published (is_published),
  KEY idx_fp_unit_type (unit_type),
  CONSTRAINT fk_fp_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenants(id)   ON DELETE CASCADE,
  CONSTRAINT fk_fp_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
  CONSTRAINT fk_fp_creator  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
--  ROOMS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id            VARCHAR(36)  NOT NULL,
  floor_plan_id VARCHAR(36)  NOT NULL,
  tenant_id     VARCHAR(36)  NOT NULL,
  name          VARCHAR(100) NOT NULL,
  room_type     ENUM('bedroom','bathroom','kitchen','living_room','dining','balcony','study','utility','corridor','other') NOT NULL DEFAULT 'other',
  area_sqft     DECIMAL(8,2) DEFAULT NULL,
  x             DECIMAL(10,4) NOT NULL DEFAULT 0,
  y             DECIMAL(10,4) NOT NULL DEFAULT 0,
  width         DECIMAL(10,4) NOT NULL DEFAULT 100,
  height        DECIMAL(10,4) NOT NULL DEFAULT 100,
  color         VARCHAR(7)   DEFAULT '#E8F0FB',
  notes         TEXT         DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rooms_floor_plan_id (floor_plan_id),
  KEY idx_rooms_tenant_id (tenant_id),
  CONSTRAINT fk_rooms_fp     FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_rooms_tenant FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
--  LISTINGS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id              VARCHAR(36)  NOT NULL,
  tenant_id       VARCHAR(36)  NOT NULL,
  building_id     VARCHAR(36)  NOT NULL,
  floor_plan_id   VARCHAR(36)  NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT         DEFAULT NULL,
  possession_date DATE         DEFAULT NULL,
  amenities       TEXT         DEFAULT NULL,
  images          TEXT         DEFAULT NULL,
  is_featured     TINYINT(1)   NOT NULL DEFAULT 0,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  inquiry_count   INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_listings_tenant_id (tenant_id),
  KEY idx_listings_building_id (building_id),
  KEY idx_listings_fp_id (floor_plan_id),
  KEY idx_listings_active (is_active),
  CONSTRAINT fk_listings_tenant FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE,
  CONSTRAINT fk_listings_bld    FOREIGN KEY (building_id)   REFERENCES buildings(id)   ON DELETE CASCADE,
  CONSTRAINT fk_listings_fp     FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
--  LEADS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                   VARCHAR(36)  NOT NULL,
  tenant_id            VARCHAR(36)  NOT NULL,
  listing_id           VARCHAR(36)  DEFAULT NULL,
  floor_plan_id        VARCHAR(36)  DEFAULT NULL,
  consumer_id          VARCHAR(36)  DEFAULT NULL,
  name                 VARCHAR(255) NOT NULL,
  email                VARCHAR(255) NOT NULL,
  phone                VARCHAR(20)  DEFAULT NULL,
  message              TEXT         DEFAULT NULL,
  preferred_visit_date DATE         DEFAULT NULL,
  budget               VARCHAR(100) DEFAULT NULL,
  status               ENUM('new','contacted','qualified','converted','lost') NOT NULL DEFAULT 'new',
  notes                TEXT         DEFAULT NULL,
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leads_tenant_id (tenant_id),
  KEY idx_leads_listing_id (listing_id),
  KEY idx_leads_status (status),
  CONSTRAINT fk_leads_tenant   FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE,
  CONSTRAINT fk_leads_listing  FOREIGN KEY (listing_id)    REFERENCES listings(id)    ON DELETE SET NULL,
  CONSTRAINT fk_leads_fp       FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_consumer FOREIGN KEY (consumer_id)   REFERENCES users(id)       ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
--  AUDIT LOGS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            VARCHAR(36)  NOT NULL,
  tenant_id     VARCHAR(36)  DEFAULT NULL,
  user_id       VARCHAR(36)  DEFAULT NULL,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50)  DEFAULT NULL,
  resource_id   VARCHAR(36)  DEFAULT NULL,
  metadata      TEXT         DEFAULT NULL,
  ip_address    VARCHAR(45)  DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_al_tenant_id (tenant_id),
  KEY idx_al_user_id (user_id),
  KEY idx_al_created_at (created_at),
  KEY idx_al_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
--  SEED: Super Admin
--  Password: Admin@123
-- ─────────────────────────────────────────────────────────
INSERT IGNORE INTO users
  (id, email, password_hash, first_name, last_name, role, is_verified, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@floorverse.io',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBpj2GfGGQvbFy',
  'Super',
  'Admin',
  'super_admin',
  1,
  1
);
