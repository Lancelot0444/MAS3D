import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Pruebas contra un PostgreSQL real. Por defecto usa el servidor local de pruebas:
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres
 * Cada archivo de pruebas crea una base nueva, aplica el "shim" de Supabase y las migraciones.
 */
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/postgres';

export async function crearBaseDePrueba(): Promise<{ db: Client; url: string; cerrar: () => Promise<void> }> {
  const nombre = `mas3d_t_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${nombre}`);
  const url = new URL(ADMIN_URL);
  url.pathname = `/${nombre}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query('set client_min_messages = error');
  const raiz = path.resolve(__dirname, '../..');
  await db.query(readFileSync(path.join(raiz, 'tests/db/supabase-shim.sql'), 'utf8'));
  const dir = path.join(raiz, 'supabase/migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.query(readFileSync(path.join(dir, f), 'utf8'));
  }
  return {
    db,
    url: url.toString(),
    cerrar: async () => {
      await db.end();
      await admin.query(`drop database if exists ${nombre} with (force)`);
      await admin.end();
    },
  };
}

export type Usuario = { id: string; email: string };

/** Crea un usuario de auth (como lo haría Supabase), opcionalmente invitado con un rol. */
export async function crearUsuario(db: Client, email: string, rol?: string): Promise<Usuario> {
  if (rol) await db.query('insert into public.invitaciones (email, nombre, rol) values ($1, $2, $3)', [email, email.split('@')[0], rol]);
  const id = randomUUID();
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  return { id, email };
}

/** Ejecuta consultas como un usuario autenticado (rol "authenticated" + JWT), igual que la API de Supabase. */
export async function como<T>(db: Client, u: Usuario, fn: (q: (sql: string, params?: unknown[]) => Promise<any[]>) => Promise<T>): Promise<T> {
  await db.query('begin');
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u.id, role: 'authenticated', email: u.email })]);
    await db.query('set local role authenticated');
    const r = await fn(async (sql, params) => (await db.query(sql, params as any[])).rows);
    await db.query('commit');
    return r;
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}

export const uuid = () => randomUUID();
export const n = (v: unknown) => Number(v);
