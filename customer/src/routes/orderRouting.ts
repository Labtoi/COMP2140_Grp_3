import { Router, Request, Response, NextFunction } from 'express';
import type { ICustomerRepo } from '../interfaces/ICustomerRepo.js';
import { AuthedRequest, requireCustomerSession } from '../middleware/customerAuth.js';
import {
  NutritionInformation, NotFoundError, ValidationError, parseKind,
} from '../../../shared/src/mainClasses/NutritionInformation';
import {
  OrderProcessing, OrderDeniedError, OrderLimitError, OrderNotFoundError, OrderValidationError,
} from '../../../shared/src/mainClasses/OrderProcessing';

export interface OrderRouterDeps {
  accounts: ICustomerRepo;
  orders: OrderProcessing;
  /** Used for reading only: the edit methods are never routed on the customer server. */
  nutrition: NutritionInformation;
}

export function createOrderRouter(deps: OrderRouterDeps): Router {
  const router = Router();
  const { accounts, orders, nutrition } = deps;

  const fail = (res: Response, error: unknown) => {
    if (error instanceof OrderDeniedError) {
      console.warn('Order denied:', error.details.join('; '));
      return res.status(409).json({ message: error.message, unavailable: error.unavailable });
    }
    if (error instanceof OrderLimitError) return res.status(429).json({ message: error.message });
    if (error instanceof OrderValidationError || error instanceof ValidationError) return res.status(400).json({ message: error.message });
    if (error instanceof OrderNotFoundError || error instanceof NotFoundError) return res.status(404).json({ message: error.message });
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  };

  const noStore = (_req: Request, res: Response, next: NextFunction) => { res.set('Cache-Control', 'no-store'); next(); };
  const orderNumber = (req: Request) => {
    const n = Number(req.params.orderNumber);
    if (!Number.isInteger(n) || n < 1) throw new OrderValidationError('Order number must be a whole number.');
    return n;
  };

  // ---------------- customers (logged in) ----------------

  // The menu: meals and sides with prices, nutrition, allergens, what can be made right now,
  // and a warning on anything that contains one of the customer's own allergies.
  router.get('/Menu', noStore, requireCustomerSession, async (req: AuthedRequest, res: Response) => {
    try {
      const me = await accounts.GetCustomerByID(req.customerID!);
      res.status(200).json({ success: true, data: await orders.getMenu(me.customerPreferences?.allergies ?? []) });
    } catch (error) { fail(res, error); }
  });

  // One item's nutrition label for a portion size: /Menu/meal/Classic%20Burger?weight=250
  router.get('/Menu/:kind/:name', noStore, requireCustomerSession, async (req: AuthedRequest, res: Response) => {
    try {
      const w = req.query.weight;
      const weight = typeof w === 'string' && w !== '' ? Number(w) : undefined;
      const view = await nutrition.getInformation(parseKind(String(req.params.kind)), String(req.params.name), weight);
      res.status(200).json({ success: true, data: view });
    } catch (error) { fail(res, error); }
  });

  // Place an order. Body: { items: [{ kind: "meal" | "side", name, quantity }] }
  router.post('/Orders', noStore, requireCustomerSession, async (req: AuthedRequest, res: Response) => {
    try {
      const me = await accounts.GetCustomerByID(req.customerID!);
      const order = await orders.placeOrder(
        { customerID: me.customerID, customerName: me.customerName, allergies: me.customerPreferences?.allergies ?? [] },
        req.body?.items,
      );
      res.status(201).json({ success: true, data: order });
    } catch (error) { fail(res, error); }
  });

  // The customer's orders, and whether one is ready for pickup (the page checks this every few seconds).
  router.get('/Orders/mine', noStore, requireCustomerSession, (req: AuthedRequest, res: Response) => {
    try {
      res.status(200).json({ success: true, data: orders.ordersFor(req.customerID!) });
    } catch (error) { fail(res, error); }
  });

  router.post('/Orders/:orderNumber/collected', noStore, requireCustomerSession, (req: AuthedRequest, res: Response) => {
    try {
      res.status(200).json({ success: true, data: orders.collected(req.customerID!, orderNumber(req)) });
    } catch (error) { fail(res, error); }
  });

  // The kitchen side (chefs seeing orders and marking them ready) is in chefRouting.ts, behind the chef login.

  return router;
}
