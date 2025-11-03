import { IsArray, IsString, MinLength } from 'class-validator';

export class RoleUpdateDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}
