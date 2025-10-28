import {IsEmail, IsNumber, IsOptional, IsString, Matches, MaxLength, MinLength,} from 'class-validator';

export class UpdateUserDto {
    @IsOptional()
    @IsString({message: 'Name must be a string.'})
    @MaxLength(100, {message: 'Name must not exceed 100 characters.'})
    name?: string;

    @IsOptional()
    @IsEmail({}, {message: 'Email must be a valid email address.'})
    email?: string;

    @IsOptional()
    @IsString({message: 'Password must be a string.'})
    @MinLength(6, {message: 'Password must be at least 6 characters long.'})
    @MaxLength(50, {message: 'Password must not exceed 50 characters.'})
    @Matches(/^[A-Za-z0-9!@#$%^&*()_+=-]+$/, {
        message: 'Password contains invalid characters.',
    })
    password?: string;

    @IsOptional()
    @IsNumber({}, {message: 'Role ID must be a number.'})
    role_id?: number;
}
