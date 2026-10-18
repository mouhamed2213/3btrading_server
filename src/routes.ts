import { Router } from "express";
import { requireAuth } from "./middlewares/auth.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { customersRouter } from "./modules/customers/customers.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { equipmentRouter } from "./modules/equipment/equipment.routes.js";
import { inquiriesRouter } from "./modules/inquiries/inquiries.routes.js";
import { invoicesRouter, paymentsRouter } from "./modules/invoices/invoices.routes.js";
import { maintenanceRouter } from "./modules/maintenance/maintenance.routes.js";
import { mediaRouter } from "./modules/media/media.routes.js";
import { partsRouter } from "./modules/parts/parts.routes.js";
import { publicRouter } from "./modules/public/public.routes.js";
import { reservationsRouter } from "./modules/reservations/reservations.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { worksitesRouter } from "./modules/worksites/worksites.routes.js";

export const api = Router();

// Sans authentification
api.use("/auth", authRouter);
api.use("/public", publicRouter);

// Espace administrateur (JWT requis)
const protectedRoutes: [string, Router][] = [
  ["/dashboard", dashboardRouter],
  ["/reservations", reservationsRouter],
  ["/equipment", equipmentRouter],
  ["/parts", partsRouter],
  ["/images", mediaRouter],
  ["/worksites", worksitesRouter],
  ["/customers", customersRouter],
  ["/invoices", invoicesRouter],
  ["/payments", paymentsRouter],
  ["/maintenance", maintenanceRouter],
  ["/inquiries", inquiriesRouter],
  ["/users", usersRouter],
];
for (const [path, router] of protectedRoutes) api.use(path, requireAuth, router);
