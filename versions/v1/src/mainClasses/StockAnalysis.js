export class ValidationError extends Error {
}
export class StockAnalysis {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    checkRange(range, limit) {
        const ok = /^\d{4}-\d{2}-\d{2}$/;
        if (!ok.test(range.start) || !ok.test(range.end))
            throw new ValidationError('dates must look like YYYY-MM-DD');
        if (range.start > range.end)
            throw new ValidationError('start date must not be after end date');
        if (!Number.isInteger(limit) || limit < 1 || limit > 50)
            throw new ValidationError('limit must be a whole number from 1 to 50');
    }
    mostPopularMeals(range, limit = 5) {
        this.checkRange(range, limit);
        return this.repo.MostPopularMeals(range, limit);
    }
    leastPopularMeals(range, limit = 5) {
        this.checkRange(range, limit);
        return this.repo.LeastPopularMeals(range, limit);
    }
    mostPopularSides(range, limit = 5) {
        this.checkRange(range, limit);
        return this.repo.MostPopularSides(range, limit);
    }
    leastPopularSides(range, limit = 5) {
        this.checkRange(range, limit);
        return this.repo.LeastPopularSides(range, limit);
    }
    totalMealsSold(range) {
        this.checkRange(range, 1);
        return this.repo.TotalMealsSold(range);
    }
    getTotalRevenue(range) {
        this.checkRange(range, 1);
        return this.repo.GetAllRevenue(range);
    }
    totalSidesSold(range) {
        this.checkRange(range, 1);
        return this.repo.TotalSidesSold(range);
    }
    getAll() {
        return this.repo.GetAllAnalysis();
    }
    getAllIds() {
        return this.repo.GetAllIDs();
    }
    getById(id) {
        return this.repo.GetAnalysis(id);
    }
    async idExists(id) {
        return (await this.repo.GetAnalysis(id)) !== null;
    }
    async add(input) {
        return this.repo.AddAnalysis(input);
    }
    async addFromItems(draft) {
        const items = [...draft.meals, ...draft.sides];
        if (items.some((i) => !Number.isFinite(i.price) || !Number.isFinite(i.quantity) || i.price < 0 || i.quantity < 0)) {
            throw new ValidationError('every item needs a non-negative price and quantity (name:price:quantity)');
        }
        const sum = (list) => list.reduce((total, i) => total + i.quantity, 0);
        const mealsSold = sum(draft.meals);
        const sidesSold = sum(draft.sides);
        const revenue = items.reduce((total, i) => total + i.price * i.quantity, 0);
        return this.add({
            ...draft,
            mealsSold,
            sidesSold,
            totalSold: mealsSold + sidesSold,
            revenue: Math.round(revenue * 100) / 100, // avoids floating-point noise like 38.970000000000006
        });
    }
    remove(id) {
        return this.repo.RemoveAnalysis(id);
    }
}
