import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import { VideoDto } from "./video.dto";
import { extractYouTubeId } from "../../../shared/youtube";
@Injectable()
export class VideosService {
  constructor(private prisma: PrismaService) {}
  list() {
    return this.prisma.video.findMany({ orderBy: { createdAt: "desc" } });
  }
  async create(dto: VideoDto) {
    await this.ensureCategory(dto.category);
    return this.prisma.$transaction(async (transaction) => {
      if (dto.isShowreel)
        await transaction.video.updateMany({
          where: { isShowreel: true },
          data: { isShowreel: false },
        });
      return transaction.video.create({
        data: { ...dto, videoId: extractYouTubeId(dto.youtubeUrl)! },
      });
    });
  }
  async update(id: string, dto: VideoDto) {
    await this.ensureCategory(dto.category);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (dto.isShowreel)
          await transaction.video.updateMany({
            where: { isShowreel: true, id: { not: id } },
            data: { isShowreel: false },
          });
        return transaction.video.update({
          where: { id },
          data: { ...dto, videoId: extractYouTubeId(dto.youtubeUrl)! },
        });
      });
    } catch (e) {
      this.handle(e);
    }
  }
  private async ensureCategory(name: string) {
    if (!(await this.prisma.category.findUnique({ where: { name } })))
      throw new BadRequestException("Selecione uma categoria cadastrada.");
  }
  async delete(id: string) {
    try {
      await this.prisma.$transaction(async (transaction) => {
        const video = await transaction.video.findUnique({ where: { id } });
        if (!video) throw new NotFoundException("Projeto não encontrado.");
        await transaction.video.delete({ where: { id } });
        if (video.isShowreel) {
          const next = await transaction.video.findFirst({
            orderBy: { createdAt: "desc" },
          });
          if (next)
            await transaction.video.update({
              where: { id: next.id },
              data: { isShowreel: true },
            });
        }
      });
      return { deleted: true };
    } catch (e) {
      this.handle(e);
    }
  }
  private handle(e: unknown): never {
    if (e instanceof NotFoundException) throw e;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
      throw new NotFoundException("Projeto não encontrado.");
    throw e;
  }
}
