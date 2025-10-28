// src/tenants/users/dto/create-user.dto.ts
import {IsEmail, IsNotEmpty, IsNumber, IsString, MaxLength, MinLength,} from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty({message: 'Name is required.'})
    @MaxLength(100, {message: 'Name must not exceed 100 characters.'})
    name: string;

    @IsEmail({}, {message: 'Invalid email address.'})
    @IsNotEmpty({message: 'Email is required.'})
    email: string;

    @IsString()
    @IsNotEmpty({message: 'Password is required.'})
    @MinLength(6, {message: 'Password must be at least 6 characters long.'})
    @MaxLength(50, {message: 'Password must not exceed 50 characters.'})
    password: string;

    @IsNumber({}, {message: 'Role ID must be numeric if provided.'})
    role_id: number;
}
