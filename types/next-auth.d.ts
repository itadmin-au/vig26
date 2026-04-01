import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import type { UserRole } from "@/types";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: UserRole;
            departments: string[];
        } & DefaultSession["user"];
    }

    interface User extends DefaultUser {
        role: UserRole;
        departments: string[];
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        id: string;
        role: UserRole;
        departments: string[];
        lastChecked?: number;
    }
}