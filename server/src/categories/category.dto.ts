import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class CreateCategoryDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^[\p{L}\p{N} .&/_-]+$/u, {
    message: "A categoria contém caracteres não permitidos.",
  })
  name!: string;
}
