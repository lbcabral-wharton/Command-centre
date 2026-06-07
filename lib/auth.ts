import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { supabaseAdmin } from "./supabase";

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL!;
const OWNER_UUID = "a0000000-0000-4000-8000-000000000001";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/gmail.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    // Gate: only allow the single authorised email
    async signIn({ profile }) {
      return profile?.email === ALLOWED_EMAIL;
    },

    // Persist tokens so server components can call Google APIs
    async jwt({ token, account }) {
      if (account?.provider === "google") {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;

        // Persist refresh token to Supabase so server jobs can use it
        if (account.refresh_token) {
          await supabaseAdmin
            .from("google_tokens")
            .upsert({
              owner: OWNER_UUID,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at
                ? new Date(account.expires_at * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq("owner", OWNER_UUID);
        }
      }

      // Refresh access token if expired
      if (
        token.expiresAt &&
        typeof token.expiresAt === "number" &&
        Date.now() > token.expiresAt * 1000
      ) {
        token = await refreshAccessToken(token);
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});

async function refreshAccessToken(token: Record<string, unknown>) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + refreshed.expires_in),
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
