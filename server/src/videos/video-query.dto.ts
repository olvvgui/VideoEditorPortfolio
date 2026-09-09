import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
export class VideoQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 24;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsIn(["true", "false"]) showreel?: string;
  @IsIn(["newest", "oldest"]) sort: "newest" | "oldest" = "newest";
}
