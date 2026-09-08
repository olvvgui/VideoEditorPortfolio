import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { VideosService } from "./videos.service";
import { VideoDto } from "./video.dto";
import { Public } from "../auth/public.decorator";
@Controller("videos")
export class VideosController {
  constructor(private videos: VideosService) {}
  @Public() @Get() list() {
    return this.videos.list();
  }
  @Post() create(@Body() dto: VideoDto) {
    return this.videos.create(dto);
  }
  @Put(":id") update(@Param("id") id: string, @Body() dto: VideoDto) {
    return this.videos.update(id, dto);
  }
  @Delete(":id") delete(@Param("id") id: string) {
    return this.videos.delete(id);
  }
}
