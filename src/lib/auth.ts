import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials.email as string;
        const password = credentials.password as string;

        if (!email || !password) {
          console.warn("[auth] login rejected: missing email or password");
          return null;
        }

        const normalizedEmail = email.trim();

        // Email is case-insensitive, but it is stored with whatever casing was
        // used at invite/registration time (e.g. "Oscar.Sims@Visory.com.au").
        // A case-sensitive lookup would reject a user who types their address in
        // a different case, so match insensitively — mirroring the registration
        // route's invitation lookup.
        const user = await prisma.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        });

        // Diagnostic logging: collapse-to-null hides why a login failed, which
        // made an invited user's sign-in failure impossible to triage from the
        // runtime logs. Log the discriminating reason and the user id where we
        // have one, but never the email address, password, or hash.
        if (!user) {
          console.warn("[auth] login rejected: no matching user");
          return null;
        }
        if (!user.isActive) {
          console.warn(`[auth] login rejected: user ${user.id} is inactive`);
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
          console.warn(`[auth] login rejected: password mismatch for user ${user.id}`);
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
