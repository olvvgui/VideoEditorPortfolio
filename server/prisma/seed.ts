import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcrypt";
import { demoVideos } from "../../shared/demo";
import { categories } from "../../shared/youtube";
import { isEmail } from "class-validator";
import { protectDatabaseFiles } from "../src/security/files";
process.umask(0o077);
const prisma = new PrismaClient();
async function main() {
  await protectDatabaseFiles();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (
    !email ||
    !isEmail(email) ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72 ||
    password.startsWith("replace-")
  )
    throw new Error(
      "Defina ADMIN_EMAIL e ADMIN_PASSWORD (12 a 72 bytes) no .env.",
    );
  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await hash(password, 12) },
  });
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: { isDefault: true },
      create: { name, isDefault: true },
    });
  }
  if (process.env.SEED_DEMO === "true")
    for (const v of demoVideos) {
      await prisma.video.upsert({
        where: { id: v.id },
        update: {},
        create: {
          id: v.id,
          title: v.title,
          description: v.description,
          category: v.category,
          videoId: v.videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        },
      });
    }
  console.log("Administrador e dados iniciais configurados.");
}
main()
  .catch(() => {
    console.error(
      "Falha no seed. Verifique o banco e ADMIN_EMAIL/ADMIN_PASSWORD (mínimo 12 caracteres, máximo 72 bytes).",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
