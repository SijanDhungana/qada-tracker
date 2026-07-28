import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

/**
 * The single source of truth for "who is making this request".
 *
 * Every read and write in the app goes through here, so the user id always
 * comes from the signed session cookie and never from anything the client
 * sends. Callers must scope their queries with the returned `user.id`.
 */
export async function requireUser(): Promise<User> {
  const session = await auth();
  const id = session?.user?.id;

  if (!id) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

  // Session cookie is valid but the row is gone (e.g. account deleted).
  if (!user) redirect("/login");

  return user;
}
