const TABLE = '"DatabaseA"';
// Includes the whole end day. Without this, "2026-11-21" means midnight and
// would skip every entry made later that day, now that dates carry a time.
const RANGE = `date >= $1::date AND date < ($2::date + INTERVAL '1 day')`;
export class databaseAnalysisRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    toAnalysis(row) {
        return {
            id: row.id,
            date: row.date,
            revenue: Number(row.revenue), // pg returns numeric as string
            totalSold: Number(row.total_sold),
            meals: row.meals,
            sides: row.sides,
            mealsSold: Number(row.meals_sold),
            sidesSold: Number(row.sides_sold),
        };
    }
    async rankItems(column, range, limit, direction) {
        const result = await this.pool.query(`SELECT MIN(TRIM(item->>'name')) AS name,
              SUM(COALESCE((item->>'quantity')::numeric, 0)) AS quantity_sold
       FROM ${TABLE}, jsonb_array_elements(${column}) AS item
       WHERE ${RANGE}
       GROUP BY LOWER(TRIM(item->>'name'))
       ORDER BY quantity_sold ${direction}, name ASC
       LIMIT $3`, [range.start, range.end, limit]);
        return result.rows.map((r) => ({ name: r.name, quantitySold: Number(r.quantity_sold) }));
    }
    async GetAllAnalysis() {
        const result = await this.pool.query(`SELECT * FROM ${TABLE} ORDER BY date ASC`);
        return result.rows.map((r) => this.toAnalysis(r));
    }
    async GetAllIDs() {
        const result = await this.pool.query(`SELECT id FROM ${TABLE} ORDER BY date ASC`);
        return result.rows.map((r) => r.id);
    }
    async GetAnalysis(id) {
        const result = await this.pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
        return result.rows[0] ? this.toAnalysis(result.rows[0]) : null;
    }
    async GetAllRevenue(dateRange) {
        const result = await this.pool.query(`SELECT SUM(revenue) AS total_revenue FROM ${TABLE} WHERE ${RANGE}`, [dateRange.start, dateRange.end]);
        return Number(result.rows[0].total_revenue);
    }
    MostPopularMeals(range, limit = 5) { return this.rankItems('meals', range, limit, 'DESC'); }
    LeastPopularMeals(range, limit = 5) { return this.rankItems('meals', range, limit, 'ASC'); }
    MostPopularSides(range, limit = 5) { return this.rankItems('sides', range, limit, 'DESC'); }
    LeastPopularSides(range, limit = 5) { return this.rankItems('sides', range, limit, 'ASC'); }
    async TotalMealsSold(range) {
        const r = await this.pool.query(`SELECT COALESCE(SUM(meals_sold), 0) AS total FROM ${TABLE} WHERE ${RANGE}`, [range.start, range.end]);
        return Number(r.rows[0].total);
    }
    async TotalSidesSold(range) {
        const r = await this.pool.query(`SELECT COALESCE(SUM(sides_sold), 0) AS total FROM ${TABLE} WHERE ${RANGE}`, [range.start, range.end]);
        return Number(r.rows[0].total);
    }
    async RemoveAnalysis(id) {
        await this.pool.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
    }
    async AddAnalysis(analysis) {
        const result = await this.pool.query(`INSERT INTO ${TABLE} (id, date, revenue, total_sold, meals, sides, meals_sold, sides_sold)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
       RETURNING *`, [analysis.id, analysis.date, analysis.revenue, analysis.totalSold, JSON.stringify(analysis.meals), JSON.stringify(analysis.sides), analysis.mealsSold, analysis.sidesSold]);
        return this.toAnalysis(result.rows[0]);
    }
}
