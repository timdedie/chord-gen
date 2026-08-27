import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { savedProgressions } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { normalizeDoc } from "@/lib/progression/doc";
import type { ProgressionDoc } from "@/lib/progression/types";

export interface SavedProgressionResponse {
    id: string;
    chords: string[];
    /** Always present — rebuilt from `chords` for rows saved before the editor. */
    doc: ProgressionDoc;
    style: string;
    prompt: string;
    savedAt: number;
}

function toResponse(row: typeof savedProgressions.$inferSelect): SavedProgressionResponse {
    return {
        id: row.id,
        chords: row.chords,
        doc: normalizeDoc(row.doc, row.chords),
        style: row.style,
        prompt: row.prompt,
        savedAt: row.savedAt.getTime(),
    };
}

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await db
        .select()
        .from(savedProgressions)
        .where(eq(savedProgressions.userId, userId))
        .orderBy(desc(savedProgressions.savedAt));

    return NextResponse.json({ progressions: rows.map(toResponse) });
}

export async function POST(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
        id: string;
        chords: string[];
        doc?: unknown;
        style: string;
        prompt: string;
    };
    if (!body.id || !body.chords || !body.style) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Whatever the client sent is coerced into a valid document, and `chords`
    // is derived from it so the two can never drift apart.
    const doc = normalizeDoc(body.doc, body.chords);

    await db
        .insert(savedProgressions)
        .values({
            id: body.id,
            userId,
            chords: doc.slots.map((slot) => slot.symbol),
            doc,
            style: body.style,
            prompt: body.prompt ?? "",
        })
        .onConflictDoUpdate({
            target: [savedProgressions.id, savedProgressions.userId],
            set: { doc, chords: doc.slots.map((slot) => slot.symbol) },
        });

    return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await db
        .delete(savedProgressions)
        .where(and(eq(savedProgressions.id, id), eq(savedProgressions.userId, userId)));

    return NextResponse.json({ ok: true });
}
