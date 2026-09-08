import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  ValidateIf,
  IsString,
  MaxLength,
  ValidateBy,
} from "class-validator";
import { extractYouTubeId } from "../../../shared/youtube";
const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class VideoDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) title!: string;
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  @ValidateBy({
    name: "youtube",
    validator: {
      validate: (value) =>
        typeof value === "string" && !!extractYouTubeId(value),
      defaultMessage: () =>
        "Informe uma URL válida do YouTube (watch, youtu.be ou shorts).",
    },
  })
  youtubeUrl!: string;
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  category!: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isShowreel?: boolean;
}
