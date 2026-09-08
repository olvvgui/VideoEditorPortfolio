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
    const categories = await this.prisma.category.findMany({
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

    return this.prisma.category.create({ data: { name } });
  }

  async delete(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    if (category.isDefault)
      throw new BadRequestException(
        "As categorias padrão não podem ser excluídas.",
      );

    const videos = await this.prisma.video.count({
      where: { category: category.name },
    });
    if (videos)
      throw new BadRequestException(
        "Mova ou exclua os vídeos desta categoria antes de removê-la.",
      );

    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }
}
