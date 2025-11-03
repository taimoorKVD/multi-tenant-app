import {IsEmail, IsNumber, IsOptional, IsString, MaxLength, MinLength,} from 'class-validator';

export class UpdateUserDto {
    @IsOptional()
    @IsString({message: 'Name must be a string.'})
    @MaxLength(100, {message: 'Name must not exceed 100 characters.'})
    name?: string;

    @IsOptional()
    @IsEmail({}, {message: 'Invalid email address.'})
    email?: string;

    @IsOptional()
    @IsString({message: 'Password must be a string.'})
    @MinLength(6, {message: 'Password must be at least 6 characters long.'})
    @MaxLength(50, {message: 'Password must not exceed 50 characters.'})
    password?: string;

    @IsOptional()
    @IsNumber({}, {message: 'Role ID must be numeric.'})
    role_id?: number;
}
