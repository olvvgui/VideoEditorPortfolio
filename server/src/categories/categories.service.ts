import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.module";

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async create(name: string) {
    return this.prisma.write("category.create", async (tx) => {
      const categories = await tx.category.findMany({
        select: { name: true },
      });
      if (
        categories.some(
          (category) =>
            category.name.localeCompare(name, "pt-BR", {
              sensitivity: "base",
            }) === 0,
        )
      )
        throw new ConflictException("Essa categoria já existe.");

      if (categories.length >= 100)
        throw new BadRequestException("Limite de 100 categorias atingido.");
      return tx.category.create({ data: { name } });
    });
  }

  async delete(id: string) {
    return this.prisma.write("category.delete", async (tx) => {
      const category = await tx.category.findUnique({ where: { id } });
      if (!category) throw new NotFoundException("Categoria não encontrada.");
      if (category.isDefault)
        throw new BadRequestException(
          "As categorias padrão não podem ser excluídas.",
        );

      const videos = await tx.video.count({
        where: { category: category.name },
      });
      if (videos)
        throw new BadRequestException(
          "Mova ou exclua os vídeos desta categoria antes de removê-la.",
        );

      await tx.category.delete({ where: { id } });
      return { deleted: true };
    });
  }
}
