import express from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { SystemRouter } from "../modules/system/system.route.js";
import { NewsletterRoutes } from "../modules/newsletter/newsletter.route.js";
import { LegalRouter } from "../modules/legal/legal.routes.js";
import { ContactRoutes } from "../modules/contact/contact.route.js";
import { NotificationRoutes } from "../modules/notification/notification.route.js";
import { RaceRouter } from "../modules/race/race.route.js";
import { HorseRouter } from "../modules/horse/horse.route.js";
import { SubscriptionRouter } from "../modules/subscription/subscription.route.js";
import { LanguageRouter } from "../modules/language/language.route.js";
import { JockeyRouter } from "../modules/jockey/jockey.route.js";
import { OddsRouter } from "../modules/odds/odds.route.js";

const router = express.Router();

const moduleRoutes = [
  { path: "/auth",    route: AuthRoutes },
  { path: "/system",  route: SystemRouter },
  { path: "/newsletter", route: NewsletterRoutes },
  { path: "/legal", route: LegalRouter },
  { path: "/contact", route: ContactRoutes },
  { path: "/notification", route: NotificationRoutes },
  { path: "/race", route: RaceRouter },
  { path: "/horse", route: HorseRouter },
  { path: "/subscription", route: SubscriptionRouter },
  { path: "/language", route: LanguageRouter },
  { path: "/jockey", route: JockeyRouter },
  { path: "/odds", route: OddsRouter },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
