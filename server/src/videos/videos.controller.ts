import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { VideosService } from "./videos.service";
import { VideoDto } from "./video.dto";
import { Public } from "../auth/public.decorator";
import { VideoQueryDto } from "./video-query.dto";
@Controller("videos")
export class VideosController {
  constructor(private videos: VideosService) {}
  @Public() @Get() list(@Query() query: VideoQueryDto) {
    return this.videos.list(query);
  }
  @Public() @Get("featured") featured() {
    return this.videos.featured();
  }
  @Public() @Get(":id") detail(@Param("id") id: string) {
    return this.videos.detail(id);
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
