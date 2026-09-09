import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.module";
import { VideoDto } from "./video.dto";
import { extractYouTubeId } from "../../../shared/youtube";
import { VideoQueryDto } from "./video-query.dto";
const detailSelect = {
  id: true,
  title: true,
  description: true,
  youtubeUrl: true,
  videoId: true,
  category: true,
  isShowreel: true,
} as const;
@Injectable()
export class VideosService {
  constructor(private prisma: PrismaService) {}
  async list(query: VideoQueryDto) {
    const { page, limit, search, category, showreel, sort } = query;
    const where: Prisma.VideoWhereInput = {
      ...(category ? { category } : {}),
      ...(showreel ? { isShowreel: showreel === "true" } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { description: { contains: search } },
              { category: { contains: search } },
            ],
          }
        : {}),
    };
    const direction = sort === "oldest" ? "asc" : "desc";
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.video.findMany({
        where,
        orderBy: [{ createdAt: direction }, { id: direction }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          videoId: true,
          category: true,
          isShowreel: true,
        },
      }),
      this.prisma.video.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        ...row,
        description: row.description.slice(0, 180),
      })),
      total,
      page,
      limit,
      hasNext: page * limit < total,
    };
  }
  async detail(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!video) throw new NotFoundException("Projeto não encontrado.");
    return video;
  }
  async featured() {
    return (
      (await this.prisma.video.findFirst({
        where: { isShowreel: true },
        select: detailSelect,
      })) ??
      this.prisma.video.findFirst({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: detailSelect,
      })
    );
  }
  async create(dto: VideoDto) {
    return this.prisma.write("video.create", async (transaction) => {
      await this.ensureCategory(dto.category, transaction);
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
    try {
      return await this.prisma.write("video.update", async (transaction) => {
        await this.ensureCategory(dto.category, transaction);
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
  private async ensureCategory(
    name: string,
    transaction: Prisma.TransactionClient,
  ) {
    if (!(await transaction.category.findUnique({ where: { name } })))
      throw new BadRequestException("Selecione uma categoria cadastrada.");
  }
  async delete(id: string) {
    try {
      await this.prisma.write("video.delete", async (transaction) => {
        const video = await transaction.video.findUnique({ where: { id } });
        if (!video) throw new NotFoundException("Projeto não encontrado.");
        await transaction.video.delete({ where: { id } });
        if (video.isShowreel) {
          const next = await transaction.video.findFirst({
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
    throw e;
  }
}
