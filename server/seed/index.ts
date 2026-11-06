/**
 * Seeds the local PocketBase instance through its HTTP API (server must be running).
 *   pnpm seed            upsert seed users + posts
 *   pnpm seed --reset    delete seeded users/posts first
 */
import path from "node:path";
import { config } from "dotenv";
import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";
import { SEED_PASSWORD, seedConversations, seedPosts, seedUsers, fullName } from "./data";

config({
  path: [path.resolve(process.cwd(), "../.env"), path.resolve(process.cwd(), ".env")],
  quiet: true,
});

const url = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const adminEmail = process.env.PB_ADMIN_EMAIL || "admin@example.com";
const adminPassword = process.env.PB_ADMIN_PASSWORD || "changeme-admin-1234";
const reset = process.argv.includes("--reset");

const pb = new PocketBase(url);
pb.autoCancellation(false);

async function findOne(collection: string, filter: string): Promise<RecordModel | null> {
  try {
    return await pb.collection(collection).getFirstListItem(filter);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) return null;
    throw error;
  }
}

async function resetSeededData() {
  for (const post of seedPosts) {
    const existing = await findOne("posts", pb.filter("slug = {:slug}", { slug: post.slug }));
    if (existing) await pb.collection("posts").delete(existing.id);
  }
  for (const user of seedUsers) {
    const existing = await findOne("users", pb.filter("email = {:email}", { email: user.email }));
    if (existing) await pb.collection("users").delete(existing.id);
  }
  console.info("Removed previously seeded records");
}

async function seed() {
  console.info(`Seeding ${url} ...`);
  await pb.collection("_superusers").authWithPassword(adminEmail, adminPassword);

  if (reset) await resetSeededData();

  const userIds = new Map<string, string>();
  for (const user of seedUsers) {
    const existing = await findOne("users", pb.filter("email = {:email}", { email: user.email }));
    const names = { firstName: user.firstName, lastName: user.lastName, name: fullName(user) };
    const record = existing
      ? await pb.collection("users").update(existing.id, names)
      : await pb.collection("users").create({
          email: user.email,
          password: SEED_PASSWORD,
          passwordConfirm: SEED_PASSWORD,
          ...names,
          verified: true,
        });
    userIds.set(user.email, record.id);
  }
  console.info(`Users: ${userIds.size} (password: ${SEED_PASSWORD})`);

  let count = 0;
  for (const post of seedPosts) {
    const author = userIds.get(post.authorEmail);
    if (!author) throw new Error(`Unknown author ${post.authorEmail}`);
    const data = {
      slug: post.slug,
      title: post.title,
      content: post.content,
      published: post.published,
      author,
    };
    const existing = await findOne("posts", pb.filter("slug = {:slug}", { slug: post.slug }));
    if (existing) await pb.collection("posts").update(existing.id, data);
    else await pb.collection("posts").create(data);
    count += 1;
  }
  console.info(`Posts: ${count}`);

  for (const conversation of seedConversations) {
    const user = userIds.get(conversation.userEmail);
    if (!user) throw new Error(`Unknown user ${conversation.userEmail}`);
    const data = { user, title: conversation.title, messages: conversation.messages };
    const existing = await findOne(
      "conversations",
      pb.filter("user = {:user} && title = {:title}", { user, title: conversation.title }),
    );
    if (existing) await pb.collection("conversations").update(existing.id, data);
    else await pb.collection("conversations").create(data);
  }
  console.info(`Conversations: ${seedConversations.length}`);

  console.info("Seed complete.");
}

seed().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  if (error instanceof ClientResponseError) console.error(JSON.stringify(error.response, null, 2));
  process.exit(1);
});
