import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { premiumGenerations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { FREE_PREMIUM_GENERATIONS_PER_DAY, PRO_PREMIUM_GENERATIONS_PER_DAY } from "@/lib/ai/models";
import { getUserRole } from "@/lib/premium";

function todayDate(): string {
    return new Date().toISOString().slice(0, 10);
}

export async function GET() {
    const { userId } = await auth();

    if (!userId) {
        return NextResponse.json({ signedIn: false, available: false, used: 0, limit: 0, unlimited: false });
    }

    const role = await getUserRole(userId);

    if (role === "admin") {
        return NextResponse.json({ signedIn: true, available: true, used: 0, limit: 0, unlimited: true });
    }

    const rows = await db
        .select()
        .from(premiumGenerations)
        .where(and(eq(premiumGenerations.userId, userId), eq(premiumGenerations.date, todayDate())));

    const used = rows[0]?.count ?? 0;
    const limit = role === "pro" ? PRO_PREMIUM_GENERATIONS_PER_DAY : FREE_PREMIUM_GENERATIONS_PER_DAY;
    return NextResponse.json({ signedIn: true, available: used < limit, used, limit, unlimited: false });
}
