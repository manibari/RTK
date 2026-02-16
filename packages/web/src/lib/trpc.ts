import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@rtk/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: API_URL,
    }),
  ],
});
