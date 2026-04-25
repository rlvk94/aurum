import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { assetRouter } from "~/server/api/routers/asset";
import { budgetRouter } from "~/server/api/routers/budget";
import { categoryRouter } from "~/server/api/routers/category";
import { challengeRouter } from "~/server/api/routers/challenge";
import { contactRouter } from "~/server/api/routers/contact";
import { debtRouter } from "~/server/api/routers/debt";
import { familyRouter } from "~/server/api/routers/family";
import { favoriteRouter } from "~/server/api/routers/favorite";
import { financialAccountRouter } from "~/server/api/routers/financial-account";
import { incomePlanRouter } from "~/server/api/routers/income-plan";
import { invitationRouter } from "~/server/api/routers/invitation";
import { projectRouter } from "~/server/api/routers/project";
import { transactionRouter } from "~/server/api/routers/transaction";
import { userRouter } from "~/server/api/routers/user";
import { announcementRouter } from "~/server/api/routers/announcement";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  asset: assetRouter,
  budget: budgetRouter,
  category: categoryRouter,
  challenge: challengeRouter,
  contact: contactRouter,
  debt: debtRouter,
  family: familyRouter,
  favorite: favoriteRouter,
  financialAccount: financialAccountRouter,
  incomePlan: incomePlanRouter,
  invitation: invitationRouter,
  project: projectRouter,
  transaction: transactionRouter,
  user: userRouter,
  announcement: announcementRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
