import { google } from "googleapis";
import { supabaseAdmin, OWNER } from "./supabase";

// ── Token management ──────────────────────────────────────────

async function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  // Load stored tokens
  const { data } = await supabaseAdmin
    .from("google_tokens")
    .select("*")
    .eq("owner", OWNER)
    .single();

  if (!data?.refresh_token) {
    throw new Error("No Google refresh token stored — user must sign in first");
  }

  oauth2Client.setCredentials({
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    expiry_date: data.expires_at
      ? new Date(data.expires_at).getTime()
      : undefined,
  });

  // Refresh if expired
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.refresh_token || tokens.access_token) {
      await supabaseAdmin
        .from("google_tokens")
        .update({
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("owner", OWNER);
    }
  });

  return oauth2Client;
}

// ── Calendar ──────────────────────────────────────────────────

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
};

export async function getUpcomingEvents(daysAhead = 7): Promise<CalendarEvent[]> {
  try {
    const auth = await getOAuth2Client();
    const calendar = google.calendar({ version: "v3", auth });

    const timeMin = new Date().toISOString();
    const timeMax = new Date(
      Date.now() + daysAhead * 24 * 60 * 60 * 1000
    ).toISOString();

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 20,
    });

    return (res.data.items ?? []).map((e) => ({
      id: e.id ?? "",
      summary: e.summary ?? "(No title)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      allDay: !e.start?.dateTime,
      location: e.location ?? undefined,
      htmlLink: e.htmlLink ?? undefined,
    }));
  } catch (err) {
    console.error("getUpcomingEvents error:", err);
    return [];
  }
}

// ── Gmail ─────────────────────────────────────────────────────

export type MailThread = {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
};

export async function getImportantThreads(maxResults = 8): Promise<MailThread[]> {
  try {
    const auth = await getOAuth2Client();
    const gmail = google.gmail({ version: "v1", auth });

    const listRes = await gmail.users.threads.list({
      userId: "me",
      q: "is:important in:inbox newer_than:7d",
      maxResults,
    });

    const threads = listRes.data.threads ?? [];

    const results = await Promise.all(
      threads.map(async (t) => {
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: t.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });

        const headers = thread.data.messages?.[0]?.payload?.headers ?? [];
        const get = (name: string) =>
          headers.find((h) => h.name === name)?.value ?? "";

        return {
          id: t.id!,
          subject: get("Subject") || "(No subject)",
          from: get("From"),
          snippet: thread.data.messages?.[0]?.snippet ?? "",
          date: get("Date"),
        };
      })
    );

    return results;
  } catch (err) {
    console.error("getImportantThreads error:", err);
    return [];
  }
}
