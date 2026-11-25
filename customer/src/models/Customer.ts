
import { User } from "./User.js";
import { Preferences } from "./Preferences.js";
import type { Order } from "./Order.js";
import type { INotification } from "./INotification.js";

export class Customer extends User implements INotification {
  public realName: string;
  private details: string;
  private preferencesData: Preferences;

  private orderReady = false;
  private currentOrder: Order | null = null;
  private chefName: string | null = null;

  constructor(
    user: User,
    preferencesData: Preferences,
    realName: string = "",
    details: string = ""
  ) {
    super(user.getName(), user.getID());

    this.realName = realName;
    this.details = details;
    this.preferencesData = preferencesData;
  }

  public getDetails(): string {
    return this.details;
  }

  public getAllergies(): string[] {
    return this.preferencesData.getAllergies();
  }

  public getPreferences(): string[] {
    return this.preferencesData.getFoodPreferences();
  }

  public OrderReady(
    chefName: string,
    customer: string,
    order: Order
  ): void {
    if (customer !== this.realName) {
      throw new Error("Order belongs to a different customer");
    }

    this.chefName = chefName;
    this.currentOrder = order;
    this.orderReady = true;
  }

  public OrderReadyReset(): void {
    this.currentOrder = null;
    this.chefName = null;
    this.orderReady = false;
  }

  public ReadyForPickup(): boolean {
    return this.orderReady;
  }

  public ReadyForPickupReset(): void {
    this.orderReady = false;
  }
}
