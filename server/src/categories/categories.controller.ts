import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { CreateCategoryDto } from "./category.dto";
import { CategoriesService } from "./categories.service";
import { Public } from "../auth/public.decorator";

@Controller("categories")
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  @Public()
  list() {
    return this.categories.list();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto.name);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.categories.delete(id);
  }
}
