import { IMenuRepository, INutritionRepository, IPreplistRepository, PrepOwner } from '../../shared/src/interfaces';
import { Dish, Prep } from '../../shared/src/models';

type Kind = 'meal' | 'side';
type StoredPrep = { owner: { kind: Kind; name: string }; prep: Prep };

/**
 * In-memory stand-in for SqlMSRepository so the contract tests run without a database.
 * Keep its behaviour in step with the real class (see the notes on remove/delete below);
 * tests/helpers/makeRepo.ts can run the same tests against the real class instead.
 */
export class InMemoryMsRepository implements IMenuRepository, INutritionRepository, IPreplistRepository {
  private dishes: Record<Kind, Map<string, Omit<Dish, 'prepList'>>> = { meal: new Map(), side: new Map() };
  private preps: StoredPrep[] = [];
  private seq = 0;

  private withPrep(kind: Kind, d: Omit<Dish, 'prepList'>): Dish {
    const prepList = this.preps.filter((p) => p.owner.kind === kind && p.owner.name === d.name).map((p) => p.prep);
    return structuredClone({ ...d, prepList });
  }
  private list(kind: Kind) { return [...this.dishes[kind].values()].map((d) => this.withPrep(kind, d)); }
  private get(kind: Kind, name: string) {
    const d = this.dishes[kind].get(name);
    if (!d) throw new Error(`${kind} "${name}" was not found`);
    return this.withPrep(kind, d);
  }
  private add(kind: Kind, dish: Dish) {
    if (this.dishes[kind].has(dish.name)) throw new Error(`${kind} "${dish.name}" already exists`);
    const { prepList: _ignored, ...rest } = dish; // prep steps are added with addPrep
    this.dishes[kind].set(dish.name, structuredClone(rest));
    return this.get(kind, dish.name);
  }
  private update(kind: Kind, name: string, changes: Partial<Omit<Dish, 'name' | 'prepList'>>) {
    const d = this.dishes[kind].get(name);
    if (!d) throw new Error(`${kind} "${name}" was not found`);
    this.dishes[kind].set(name, { ...d, ...structuredClone(changes) });
    return this.get(kind, name);
  }
  // Like SqlMSRepository: deleting a row that is not there is not an error (idempotent).
  // Prep rows go with their dish (ON DELETE CASCADE).
  private remove(kind: Kind, name: string) {
    this.dishes[kind].delete(name);
    this.preps = this.preps.filter((p) => !(p.owner.kind === kind && p.owner.name === name));
  }

  async showAllMeals() { return this.list('meal'); }
  async showAllSides() { return this.list('side'); }
  async getMeal(name: string) { return this.get('meal', name); }
  async getSide(name: string) { return this.get('side', name); }
  async addMeal(meal: Dish) { return this.add('meal', meal); }
  async addSide(side: Dish) { return this.add('side', side); }
  async updateMeal(name: string, c: Partial<Omit<Dish, 'name' | 'prepList'>>) { return this.update('meal', name, c); }
  async updateSide(name: string, c: Partial<Omit<Dish, 'name' | 'prepList'>>) { return this.update('side', name, c); }
  async deleteMeal(name: string) { this.remove('meal', name); }
  async deleteSide(name: string) { this.remove('side', name); }

  async showAllPrep() { return structuredClone(this.preps.map((p) => p.prep)); }
  async getPrep(name: string) {
    const p = this.preps.find((x) => x.prep.itemName === name);
    if (!p) throw new Error(`prep "${name}" was not found`);
    return structuredClone(p.prep);
  }
  async addPrep(owner: PrepOwner, prep: Prep) {
    const o = 'meal' in owner ? { kind: 'meal' as const, name: owner.meal } : { kind: 'side' as const, name: owner.side };
    if (!this.dishes[o.kind].has(o.name)) throw new Error(`${o.kind} "${o.name}" was not found`);
    const stored: Prep = { ...structuredClone(prep), id: `prep-${++this.seq}` };
    this.preps.push({ owner: o, prep: stored });
    return structuredClone(stored);
  }
  async updatePrep(name: string, changes: Partial<Omit<Prep, 'id'>>) {
    const p = this.preps.find((x) => x.prep.itemName === name);
    if (!p) throw new Error(`prep "${name}" was not found`);
    Object.assign(p.prep, structuredClone(changes));
    return structuredClone(p.prep);
  }
  async removePrep(name: string) {
    // Like SqlMSRepository: deleting by item_name when nothing matches is not an error.
    this.preps = this.preps.filter((x) => x.prep.itemName !== name);
  }
}
