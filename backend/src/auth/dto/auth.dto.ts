import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class EmailDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class RegisterDto extends EmailDto {
  @IsString()
  @Length(15, 128)
  password!: string;
}

export class LoginDto extends EmailDto {
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class TokenDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString()
  @Length(15, 128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @IsString()
  @Length(15, 128)
  newPassword!: string;
}

export class SessionsQueryDto {
  @IsOptional()
  @IsUUID('4')
  cursor?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
