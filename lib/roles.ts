import { clerkClient } from "@clerk/nextjs/server";

export type UserRole = "admin" | "pro" | "free";

/** Reads the user's role from Clerk publicMetadata.role. Defaults to "free". */
export async function getUserRole(userId: string | null | undefined): Promise<UserRole> {
    if (!userId) return "free";

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = user.publicMetadata?.role;

    if (role === "admin" || role === "pro") return role;
    return "free";
}
