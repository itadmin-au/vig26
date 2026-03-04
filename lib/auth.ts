// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { verifyPassword } from "@/lib/utils";
import type { UserRole } from "@/types";

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },

    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },

    providers: [
        // ─── Google OAuth (public/student accounts only) ─────────────────────
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        }),

        // ─── Credentials (all roles) ─────────────────────────────────────────
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required");
                }

                await connectDB();

                const user = await User.findOne({
                    email: credentials.email.toLowerCase().trim(),
                }).select("+passwordHash");

                if (!user) {
                    throw new Error("No account found with this email");
                }

                if (!user.passwordHash) {
                    throw new Error(
                        "This account uses Google Sign-In. Please continue with Google."
                    );
                }

                const isValid = await verifyPassword(
                    credentials.password,
                    user.passwordHash
                );
                if (!isValid) {
                    throw new Error("Incorrect password");
                }

                return {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role as UserRole,
                    departments: (user.departments ?? []).map((d: any) =>
                        d.toString()
                    ),
                    image: null,
                };
            },
        }),
    ],

    callbacks: {
        // ─── signIn ──────────────────────────────────────────────────────────
        async signIn({ user, account }) {
            if (account?.provider === "google") {
                await connectDB();

                const existingUser = await User.findOne({ email: user.email });

                if (existingUser) {
                    // Block management accounts from using Google OAuth
                    const managementRoles: UserRole[] = [
                        "coordinator",
                        "dept_admin",
                        "super_admin",
                    ];
                    if (managementRoles.includes(existingUser.role)) {
                        return "/manage/login?error=OAuthNotAllowed";
                    }

                    // ── Merge: link googleId to existing email/password account ──
                    // This handles the case where a student first signed up with
                    // email+password and then tries "Continue with Google" using
                    // the same email. We link the Google identity without forcing
                    // them to create a second account.
                    if (!existingUser.googleId) {
                        await User.findByIdAndUpdate(existingUser._id, {
                            googleId: account.providerAccountId,
                        });
                    }
                } else {
                    // New user via Google — create student account
                    await User.create({
                        name: user.name ?? undefined,
                        email: user.email ?? undefined,
                        googleId: account.providerAccountId,
                        role: "student",
                        departments: [],
                        registeredEvents: [],
                    });
                }
            }
            return true;
        },

        // ─── JWT ─────────────────────────────────────────────────────────────
        async jwt({ token, user, account, trigger, session }) {
            // On first sign-in with credentials, `user` object is fully populated
            if (user && account?.provider === "credentials") {
                token.id = user.id;
                token.role = (user as any).role;
                token.departments = (user as any).departments ?? [];
            }

            // On every Google sign-in (first AND subsequent), always fetch fresh
            // data from the DB so that role/department changes are reflected and
            // the googleId→userId mapping is resolved correctly.
            if (account?.provider === "google" && token.email) {
                await connectDB();
                const dbUser = await User.findOne({
                    email: token.email,
                }).lean();

                if (dbUser) {
                    token.id = (dbUser._id as any).toString();
                    token.role = dbUser.role;
                    token.departments = (dbUser.departments ?? []).map((d: any) =>
                        d.toString()
                    );
                }
            }

            // Handle session update trigger (e.g. after profile edit)
            if (trigger === "update" && session) {
                token.name = session.name ?? token.name;
            }

            return token;
        },

        // ─── Session ─────────────────────────────────────────────────────────
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as UserRole;
                session.user.departments = (token.departments as string[]) ?? [];
            }
            return session;
        },
    },
};