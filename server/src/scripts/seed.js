/**
 * FloorVerse — Seed Script
 * Creates the System tenant + Super Admin user with a correct bcrypt hash.
 * Safe to re-run — deletes & re-inserts by fixed ID.
 * Run: node src/scripts/seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const bcrypt = require('bcrypt');
const db     = require('../config/db');

// Fixed IDs — re-running the seed is fully idempotent
const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const SUPER_ADMIN_ID   = '00000000-0000-0000-0000-000000000001';

async function seed() {
  console.log('\n🌱 FloorVerse Seed Script\n');

  // ── 1. Create System tenant ─────────────────────────────
  console.log('🏢 Creating System tenant...');
  await db.query('DELETE FROM tenants WHERE id = ?', [SYSTEM_TENANT_ID]);
  await db.query(
    `INSERT INTO tenants (id, name, slug, plan, status, max_floor_plans)
     VALUES (?, 'FloorVerse System', 'floorverse-system', 'enterprise', 'active', 9999)`,
    [SYSTEM_TENANT_ID]
  );
  console.log('   Tenant ID :', SYSTEM_TENANT_ID);

  // ── 2. Create Super Admin ───────────────────────────────
  const email    = 'admin@floorverse.io';
  const password = 'Admin@123';
  const hash     = await bcrypt.hash(password, 12);

  console.log('\n🔑 Hashing password...');
  console.log('   Email    :', email);
  console.log('   Password :', password);

  // Remove any existing record (by ID or email) before inserting fresh
  await db.query('DELETE FROM users WHERE id = ? OR email = ?', [SUPER_ADMIN_ID, email]);

  await db.query(
    `INSERT INTO users
       (id, tenant_id, email, password_hash, first_name, last_name, role, is_verified, is_active)
     VALUES (?, ?, ?, ?, 'Super', 'Admin', 'super_admin', 1, 1)`,
    [SUPER_ADMIN_ID, SYSTEM_TENANT_ID, email, hash]
  );
  console.log('   User ID  :', SUPER_ADMIN_ID);

  console.log('\n✅ Seed complete!');
  console.log('   Login at : http://localhost:5173/login');
  console.log('   Email    :', email);
  console.log('   Password :', password);
  console.log('\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
