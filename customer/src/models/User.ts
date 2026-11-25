
export class User {
  constructor(
    protected name: string,
    protected ID: string
  ) {}

  public getName(): string {
    return this.name;
  }

  public getID(): string {
    return this.ID;
  }

  public CheckPassword(password: string): Promise<boolean> {
    // Password verification must use the authentication service.
    throw new Error("Authentication integration not implemented");
  }

  public Login(): Promise<void> {
    // Login must be connected to Supabase Auth.
    throw new Error("Authentication integration not implemented");
  }
}
