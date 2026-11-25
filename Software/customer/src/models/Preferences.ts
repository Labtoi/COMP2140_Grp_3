
export class Preferences {
  constructor(
    public allergies: string[] = [],
    public foodPreferences: string[] = []
  ) {}

  public getAllergies(): string[] {
    return [...this.allergies];
  }

  public getFoodPreferences(): string[] {
    return [...this.foodPreferences];
  }
}
