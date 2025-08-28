

import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
	],
	callbacks: {
		async jwt({ token, user }: { token: any; user?: any }) {
			if (user) {
				token.role = user.email?.endsWith("@gehu.ac.in") ? "admin" : "volunteer"
			}
			return token
		},
		async session({ session, token }: { session: any; token: any }) {
			if (session.user) {
				session.user.role = token.role as string
			}
			return session
		},
	},
	pages: {
		signIn: "/",
	},
})

export const GET = handler;
export const POST = handler;
