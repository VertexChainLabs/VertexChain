import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  if (req.method === 'PATCH') {
    try {
      const { name, polygon } = req.body;
      if (!name && !polygon) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      let query = 'UPDATE regions SET ';
      const values: unknown[] = [];
      let paramCount = 1;

      if (name) {
        query += `name = $${paramCount}, `;
        values.push(name);
        paramCount++;
      }
      if (polygon) {
        query += `polygon = $${paramCount}, `;
        values.push(JSON.stringify(polygon));
        paramCount++;
      }

      // Remove trailing comma and space
      query = query.slice(0, -2);
      query += ` WHERE id = $${paramCount} RETURNING id, name, polygon`;
      values.push(id);

      const { rows } = await pool.query(query, values);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Region not found' });
      }
      return res.status(200).json(rows[0]);
    } catch (error) {
      console.error('Failed to update region:', error);
      return res.status(500).json({ error: 'Failed to update region' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { rowCount } = await pool.query('DELETE FROM regions WHERE id = $1', [id]);
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Region not found' });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to delete region:', error);
      return res.status(500).json({ error: 'Failed to delete region' });
    }
  } else {
    res.setHeader('Allow', ['PATCH', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
