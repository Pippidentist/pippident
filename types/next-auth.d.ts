import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    studioId: string;
    role: "super_admin" | "admin" | "dentist" | "secretary";
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      studioId: string;
      role: "super_admin" | "admin" | "dentist" | "secretary";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    studioId: string;
    role: string;
  }
}
