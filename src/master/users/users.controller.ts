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
import {UsersService} from './users.service';
import {MasterAccess} from '../../common/decorators';
import {CreateUserDto, UpdateUserDto} from './dto';
import {BulkDeleteDto} from '../../common/dto';
import {BulkDeleteSwagger} from '../../common/swagger';
import {MasterAuthGuard} from '../auth/guards';
import {MasterAuthService} from '../auth/auth.service';
import {Request} from 'express';
import {ApiTags} from "@nestjs/swagger";
import {UsersSwagger} from "./swagger";

/**
 * Type-safe request interface for authenticated users
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role?: string;
  };
}

@ApiTags('User Management')
@UsersSwagger.Auth()
@Controller('master/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly masterAuthService: MasterAuthService,
  ) {}

  // List all users (paginated)
  @Get()
  @MasterAccess('view-user')
  @UsersSwagger.GetAll()
  async all(@Query('page') page: number = 1, @Query('limit') limit?: number) {
    return this.usersService.paginate(page, ['role'], limit !== undefined ? Number(limit) : undefined);
  }

  // Create a new user (Admin only)
  @Post()
  @MasterAccess('create-user')
  @UsersSwagger.Create()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get('search')
  @MasterAccess('view-user')
  @UsersSwagger.Search()
  async search(
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('role_id') roleId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.search(limit ? Number(limit) : undefined, {
      name,
      email,
      roleId: roleId ? Number(roleId) : undefined,
    });
  }

  // Update current logged-in user's own profile
  // Must appear BEFORE `@Put(':id')` to avoid routing conflicts
  @UseGuards(MasterAuthGuard)
  @Put('profile')
  @UsersSwagger.UpdateProfile()
  async updateUserInfo(@Req() req: AuthenticatedRequest, @Body() dto: UpdateUserDto) {
    if (!req.user) {
      throw new BadRequestException('User not authenticated');
    }

    return await this.masterAuthService.updateProfile(req.user.id, dto);
  }

  // Get single user by numeric ID
  @Get(':id')
  @MasterAccess('view-user')
  @UsersSwagger.GetOne()
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id, ['role']);
  }

  // Update user by ID (Admin)
  @Put(':id')
  @MasterAccess('edit-user')
  @UsersSwagger.Update()
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // Bulk delete users (Admin)
  @Delete('bulk')
  @MasterAccess('delete-user')
  @BulkDeleteSwagger('users')
  async bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.usersService.bulkDelete(dto.ids);
  }

  // Delete user by ID (Admin)
  @Delete(':id')
  @MasterAccess('delete-user')
  @UsersSwagger.Delete()
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.delete(id);
  }
}
