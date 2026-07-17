import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Ensure the table exists on startup/first access to be self-healing
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "regions" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "polygon" JSONB NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_regions_id" PRIMARY KEY ("id")
      )
    `);
  } catch (err) {
    console.error('Failed to ensure regions table exists:', err);
  }

  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query('SELECT id, name, polygon FROM regions ORDER BY created_at ASC');
      return res.status(200).json(rows);
    } catch (error) {
      console.error('Failed to get regions:', error);
      return res.status(500).json({ error: 'Failed to fetch regions' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, polygon } = req.body;
      if (!name || !polygon || !Array.isArray(polygon)) {
        return res.status(400).json({ error: 'Missing name or polygon' });
      }
      const { rows } = await pool.query(
        'INSERT INTO regions (name, polygon) VALUES ($1, $2) RETURNING id, name, polygon',
        [name, JSON.stringify(polygon)]
      );
      return res.status(201).json(rows[0]);
    } catch (error) {
      console.error('Failed to create region:', error);
      return res.status(500).json({ error: 'Failed to create region' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
