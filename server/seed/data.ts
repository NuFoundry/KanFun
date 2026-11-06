/**
 * Seed data. Keep it small, deterministic and idempotent (unique email / slug per record).
 * The same data is used by `pnpm seed`, `pnpm db:reset` and the Playwright suite.
 */

export const SEED_PASSWORD = process.env.SEED_USER_PASSWORD || "password1234";

export type SeedUser = { email: string; firstName: string; lastName: string };

/** The display name stored in `users.name`; the client derives it the same way on save. */
export function fullName(user: Pick<SeedUser, "firstName" | "lastName">): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ");
}
export type SeedConversation = {
  userEmail: string;
  title: string;
  messages: { role: "user" | "assistant"; content: string }[];
};
export type SeedPost = {
  slug: string;
  title: string;
  content: string;
  published: boolean;
  authorEmail: string;
};

export const seedUsers: SeedUser[] = [
  { email: "alice@example.com", firstName: "Alice", lastName: "Example" },
  { email: "bob@example.com", firstName: "Bob", lastName: "Builder" },
];

export const seedPosts: SeedPost[] = [
  {
    slug: "welcome-to-kan-fun",
    title: "Welcome to KanFun",
    content:
      "This post was created by the seed script. Edit server/seed/data.ts to change what your local database starts with.",
    published: true,
    authorEmail: "alice@example.com",
  },
  {
    slug: "how-the-stack-fits-together",
    title: "How the stack fits together",
    content:
      "React + Vite talk to PocketBase directly through the JS SDK. Anything that needs a secret (like calling an AI API) goes through a Node service under services/.",
    published: true,
    authorEmail: "bob@example.com",
  },
  {
    slug: "alices-draft",
    title: "A draft only Alice can see",
    content:
      "Unpublished posts are visible to their author only, enforced by PocketBase API rules.",
    published: false,
    authorEmail: "alice@example.com",
  },
];

/** One saved chat so the assistant's history has something to show (and to load slowly in
 *  e2e/loading.spec.ts). Other conversations of seeded users are left alone. */
export const seedConversations: SeedConversation[] = [
  {
    userEmail: "alice@example.com",
    title: "What can you help me with?",
    messages: [
      { role: "user", content: "What can you help me with?" },
      {
        role: "assistant",
        content:
          "Ask me anything about the app, or dictate a message with the microphone. Without an AI key I only echo what you say; add one in `.env` for real answers.",
      },
    ],
  },
];
