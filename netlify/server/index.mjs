import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { votes } from "../../db/schema.ts";

const dates = ["2026-12-24", "2026-12-26", "2026-12-31", "2027-01-08"];
const cookieName = "haraka_voter";

function response(data, status = 200, cookie) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(JSON.stringify(data), { status, headers });
}

async function snapshot(voterId) {
  const [totals, mine] = await Promise.all([
    db
      .select({ date: votes.date, count: count() })
      .from(votes)
      .groupBy(votes.date),
    db
      .select({ date: votes.date })
      .from(votes)
      .where(eq(votes.voterId, voterId))
      .limit(1),
  ]);
  const options = dates.map((date) => ({
    date,
    votes: Number(totals.find((row) => row.date === date)?.count ?? 0),
  }));
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  const highest = Math.max(...options.map((option) => option.votes));
  return {
    options: options.map((option) => ({
      ...option,
      percentage: total ? Math.round((option.votes / total) * 1000) / 10 : 0,
    })),
    total,
    selectedDate: mine[0]?.date ?? null,
    leaders: highest
      ? options
          .filter((option) => option.votes === highest)
          .map((option) => option.date)
      : [],
    updatedAt: new Date().toISOString(),
  };
}

export default async function handler(request) {
  const { pathname, origin } = new URL(request.url);
  if (!["/api/poll", "/api/vote"].includes(pathname))
    return response({ error: "Not found." }, 404);
  const expectedMethod = pathname === "/api/poll" ? "GET" : "POST";
  if (request.method !== expectedMethod)
    return response({ error: "Method not allowed." }, 405);

  const cookies = request.headers.get("cookie") ?? "";
  const existingId = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  const validId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      existingId ?? "",
    );
  const voterId = validId ? existingId : randomUUID();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie = validId
    ? undefined
    : `${cookieName}=${voterId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;

  try {
    if (request.method === "POST") {
      const requestOrigin = request.headers.get("origin");
      if (
        (requestOrigin && requestOrigin !== origin) ||
        request.headers.get("sec-fetch-site") === "cross-site"
      ) {
        return response(
          { error: "Please submit your vote from this website." },
          403,
        );
      }
      if (!validId)
        return response(
          { error: "Please allow cookies and refresh the page before voting." },
          400,
          cookie,
        );
      if (!request.headers.get("content-type")?.includes("application/json"))
        return response({ error: "A date selection is required." }, 415);
      const body = await request.text();
      if (body.length > 256)
        return response({ error: "The vote could not be read." }, 413);
      let selected;
      try {
        selected = JSON.parse(body).date;
      } catch {
        return response({ error: "Please select one of the four dates." }, 400);
      }
      if (!dates.includes(selected))
        return response({ error: "Please select one of the four dates." }, 400);
      await db
        .insert(votes)
        .values({ voterId, date: selected })
        .onConflictDoUpdate({
          target: votes.voterId,
          set: { date: selected, updatedAt: new Date() },
        });
    }
    return response(await snapshot(voterId), 200, cookie);
  } catch {
    return response(
      {
        error:
          "We couldn’t connect to the results. Please try again in a moment.",
      },
      503,
      cookie,
    );
  }
}
