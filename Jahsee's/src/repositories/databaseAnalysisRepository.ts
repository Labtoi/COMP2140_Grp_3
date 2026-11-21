import { Pool } from 'pg';
import { IAnalysisRepo } from '../interfaces/IAnalysisRepo';
import { Analysis, NewAnalysis } from '../models/Analysis';

const TABLE = '"DatabaseA"';

export class databaseAnalysisRepository implements IAnalysisRepo {
  constructor(private readonly pool: Pool) {}

  private toAnalysis(row: any): Analysis {
    return {
        id: row.id,
        date: row.date,
        revenue: Number(row.revenue),   // pg returns numeric as string
        totalSold: Number(row.total_sold),
        meals: row.meals,
        sides: row.sides,
        mealsSold: Number(row.meals_sold),
        sidesSold: Number(row.sides_sold),
    };
  }

  async GetAllAnalysis(): Promise<Analysis[]> {
    const result = await this.pool.query(`SELECT * FROM ${TABLE} ORDER BY date DESC`);
    return result.rows.map((r) => this.toAnalysis(r));
  }

  async GetAllIDs(): Promise<string[]> {
    const result = await this.pool.query(`SELECT id FROM ${TABLE} ORDER BY date DESC`);
    return result.rows.map((r) => r.id);
  }

  async GetAnalysis(id: string): Promise<Analysis | null> {
    const result = await this.pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
    return result.rows[0] ? this.toAnalysis(result.rows[0]) : null;
  }

  async RemoveAnalysis(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  }

  async AddAnalysis(analysis: NewAnalysis): Promise<Analysis> {
    const result = await this.pool.query(
      `INSERT INTO ${TABLE} (id, date, revenue, total_sold, meals, sides, meals_sold, sides_sold)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
       RETURNING *`,
      [analysis.id, analysis.date, analysis.revenue, analysis.totalSold, JSON.stringify(analysis.meals), JSON.stringify(analysis.sides), analysis.mealsSold, analysis.sidesSold]
    );
    return this.toAnalysis(result.rows[0]);
  }
}