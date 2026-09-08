import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./login.dto";
import { Public } from "./public.decorator";
import { SESSION_SECONDS } from "./session";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api",
});
@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post("login")
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.cookie("session", await this.auth.login(dto.email, dto.password), {
      ...cookieOptions(),
      maxAge: SESSION_SECONDS * 1000,
    });
    return { authenticated: true };
  }
  @Get("me") me() {
    return { authenticated: true };
  }
  @Public()
  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.session);
    res.clearCookie("session", cookieOptions());
    return { authenticated: false };
  }
}
