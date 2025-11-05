import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { MasterAccess } from '../../common/decorators';
import { CreateUserDto, UpdateUserDto } from './dto';
import { MasterAuthGuard } from '../auth/guards';
import { MasterAuthService } from '../auth/auth.service';
import { Request } from 'express';

/**
 * ✅ Type-safe request interface for authenticated users
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role?: string;
  };
}

@Controller('master/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly masterAuthService: MasterAuthService,
  ) {}

  // ✅ List all users (paginated)
  @Get()
  @MasterAccess('view-user')
  async all(@Query('page') page = 1) {
    return this.usersService.paginate(page, ['role']);
  }

  // ✅ Create a new user (Admin only)
  @Post()
  @MasterAccess('create-user')
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // ✅ Update current logged-in user's own profile
  // Must appear BEFORE `@Put(':id')` to avoid routing conflicts
  @UseGuards(MasterAuthGuard)
  @Put('profile')
  async updateUserInfo(@Req() req: AuthenticatedRequest, @Body() dto: UpdateUserDto) {
    if (!req.user) {
      throw new BadRequestException('User not authenticated');
    }

    const result = await this.masterAuthService.updateProfile(req.user.id, dto);
    return {
      success: true,
      message: 'Profile updated successfully',
      data: result,
    };
  }

  // ✅ Get single user by numeric ID
  @Get(':id')
  @MasterAccess('view-user')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id, ['role']);
  }

  // ✅ Update user by ID (Admin)
  @Put(':id')
  @MasterAccess('edit-user')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // ✅ Delete user by ID (Admin)
  @Delete(':id')
  @MasterAccess('delete-user')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.delete(id);
  }
}
