import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  ValidateBy,
} from "class-validator";
import { Transform } from "class-transformer";
export class LoginDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  @ValidateBy({
    name: "bcryptBytes",
    validator: {
      validate: (value: unknown) =>
        typeof value === "string" && Buffer.byteLength(value, "utf8") <= 72,
      defaultMessage: () => "A senha deve ter no máximo 72 bytes UTF-8.",
    },
  })
  password!: string;
}
