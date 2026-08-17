import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const publicRoutes = [
      "/api/flats",
      "/api/society",
      "/api/society/emergency",
    ];

    const requestPath = req.path || req.originalUrl?.split("?")[0];

    if (publicRoutes.includes(requestPath)) {
      return true;
    }

    // Prefer the HTTP-only session cookie, then fall back to
    // Authorization: Bearer <token> for non-browser clients and tests.
    let token = req.cookies?.access_token;
    if (!token) {
      const authorization = req.headers.authorization;

      if (authorization?.startsWith("Bearer ")) {
        token = authorization.substring(7).trim();
      }
    }

    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const secret =
        process.env.JWT_SECRET ?? "development-only-secret";

      const payload = jwt.verify(token, secret);

      if (
        typeof payload !== "object" ||
        payload === null ||
        !payload.sub ||
        !payload.role
      ) {
        throw new Error("Invalid token");
      }

      req.user = {
        id: String(payload.sub),
        role: String(payload.role),
      };

      return true;
    } catch {
      throw new UnauthorizedException("Session expired");
    }
  }
}


 
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest) => {
    if (!req.user) {
      throw new UnauthorizedException("Authentication required");
    }

    if (!roles.includes(req.user.role)) {
      throw new UnauthorizedException("Insufficient permissions");
    }

    return true;
  };
}