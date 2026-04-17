import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { assetRouter } from "~/server/api/routers/asset";
import { categoryRouter } from "~/server/api/routers/category";
import { familyRouter } from "~/server/api/routers/family";
import { financialAccountRouter } from "~/server/api/routers/financial-account";
import { invitationRouter } from "~/server/api/routers/invitation";
import { transactionRouter } from "~/server/api/routers/transaction";
import { userRouter } from "~/server/api/routers/user";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  asset: assetRouter,
  category: categoryRouter,
  family: familyRouter,
  financialAccount: financialAccountRouter,
  invitation: invitationRouter,
  transaction: transactionRouter,
  user: userRouter,
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
