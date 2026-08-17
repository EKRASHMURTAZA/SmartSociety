import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { Response } from "express";
import { AuthGuard, AuthenticatedRequest } from "./auth.guard";
import { AuthService } from "./auth.service";

class LoginDto { @IsString() identifier!: string; @IsString() @MinLength(6) password!: string; }
class RegisterDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @Matches(/^\+?[0-9\s()-]{10,20}$/, { message: "Enter a valid phone number" }) phone!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: "Password must contain letters and numbers" }) password!: string;
  @IsOptional() @IsString() @MinLength(2) flat?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() staffId?: string;
}
class ForgotDto { @IsString() phone!: string; }
class ResetDto { @IsString() token!: string; @IsString() @MinLength(8) password!: string; }

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto);
    res.cookie("access_token", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    return { user: result.user };
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.identifier, dto.password);
    res.cookie("access_token", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    return { user: result.user };
  }

  @Get("demo-accounts")
  demoAccounts() { return this.auth.demoAccounts(); }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("access_token", { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/" });
    return { ok: true };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  async me(@Req() req: AuthenticatedRequest) { return { user: await this.auth.me(req.user.id) }; }

  @Post("forgot-password")
  forgot(@Body() dto: ForgotDto) { return this.auth.requestPasswordReset(dto.phone); }

  @Post("reset-password")
  reset(@Body() dto: ResetDto) { return this.auth.resetPassword(dto.token, dto.password); }
}
