import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import type { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const adminUser = process.env.ADMIN_USERNAME;
        const adminPass = process.env.ADMIN_PASSWORD;

        if (
          credentials?.username === adminUser &&
          credentials?.password === adminPass
        ) {
          console.log("Auth Debug: Credentials matched for Admin");
          return {
            id: "admin-static-id",
            name: "Administrator",
            email: "admin@gehu.ac.in",
            role: "admin",
          };
        }
        return null;
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        if (process.env.DEBUG_AUTH === "true" || process.env.NODE_ENV !== "production") {
          console.log("Auth Debug: Processing login for:", user.email);
        }

        if (user.role) {
          console.log("Auth Debug: Role inherited from User object ->", user.role);
          token.role = user.role;
          return token;
        }

        // List of admin emails loaded from environment
        const adminEmailsEnv = process.env.ADMIN_EMAILS;
        if (adminEmailsEnv === undefined) {
          throw new Error("Missing required environment variable ADMIN_EMAILS. The adminEmails variable cannot be initialized.");
        }
        const adminEmails = adminEmailsEnv
          ? adminEmailsEnv.split(",").map((e) => e.trim()).filter(Boolean)
          : [];

        // Normalize emails for comparison
        const lowerCaseUserEmail = user.email?.toLowerCase() || "";
        const lowerCaseAdminEmails = adminEmails.map(e => e.toLowerCase());

        if (lowerCaseAdminEmails.includes(lowerCaseUserEmail)) {
          console.log("Auth Debug: Role -> ADMIN (Email Match)");
          token.role = "admin";
        } else if (lowerCaseUserEmail.endsWith("@gehu.ac.in")) {
          console.log("Auth Debug: Role -> ADMIN (Domain Match)");
          token.role = "admin";
        } else {
          console.log("Auth Debug: Role -> VOLUNTEER");
          token.role = "volunteer";
        }
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
}
