import GoogleProvider from "next-auth/providers/google"
import type { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        // List of admin emails
        const adminEmails = [
          "prinskanyal@gmail.com", // <-- Replace with your admin emails
          // Add more admin emails here
        ];
        if (adminEmails.includes(user.email)) {
          token.role = "admin";
        } else if (user.email?.endsWith("@gehu.ac.in")) {
          token.role = "admin";
        } else {
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
