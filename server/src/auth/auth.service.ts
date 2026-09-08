import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcrypt";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.module";
import {
  digest,
  SESSION_SECONDS,
  validClaims,
  type SessionClaims,
} from "./session";
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}
  async login(email: string, password: string) {
    if (Buffer.byteLength(password, "utf8") > 72)
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    const valid = await compare(
      password,
      admin?.passwordHash ??
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
    );
    if (!admin || !valid)
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    const jti = randomBytes(32).toString("hex");
    const token = await this.jwt.signAsync({ sub: admin.id, jti });
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
      await tx.session.create({
        data: {
          id: digest(jti),
          adminId: admin.id,
          credentialHash: digest(admin.passwordHash),
          expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
        },
      });
    });
    return token;
  }
  async claims(token: unknown): Promise<SessionClaims | null> {
    if (typeof token !== "string" || token.length > 2048) return null;
    try {
      const payload: unknown = await this.jwt.verifyAsync(token);
      return validClaims(payload) ? payload : null;
    } catch {
      return null;
    }
  }
  async authenticate(token: unknown) {
    const payload = await this.claims(token);
    if (!payload)
      throw new UnauthorizedException("Sua sessão expirou. Entre novamente.");
    const session = await this.prisma.session.findUnique({
      where: { id: digest(payload.jti) },
      include: { admin: { select: { id: true, passwordHash: true } } },
    });
    if (
      !session ||
      session.adminId !== payload.sub ||
      session.expiresAt.getTime() <= Date.now() ||
      session.credentialHash !== digest(session.admin.passwordHash)
    )
      throw new UnauthorizedException("Sua sessão expirou. Entre novamente.");
  }
  async logout(token: unknown) {
    const payload = await this.claims(token);
    if (payload)
      await this.prisma.session.deleteMany({
        where: { id: digest(payload.jti), adminId: payload.sub },
      });
  }
}
