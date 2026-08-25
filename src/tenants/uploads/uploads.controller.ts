import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';
import { DeleteImageDto } from './dto';
import { TenantUploadsSwagger } from './swagger';
import { UploadsService } from './uploads.service';

@TenantUploadsSwagger.Tags()
@TenantUploadsSwagger.Auth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @TenantAccess()
  @Post('images')
  @TenantUploadsSwagger.UploadImage()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: Number(process.env.UPLOAD_IMAGE_MAX_BYTES || 5 * 1024 * 1024),
        files: 1,
      },
    }),
  )
  async uploadImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('purpose') purpose?: string,
  ) {
    const origin =
      `${req.protocol}://${req.get?.('host') || req.headers?.host || ''}`.replace(
        /\/+$/,
        '',
      );

    const data = await this.uploadsService.saveImage(file, {
      tenantSlug: String(req.tenantId || 'tenant'),
      purpose,
      requestOrigin: origin,
    });

    return {
      success: true,
      message: 'Image uploaded successfully',
      data,
    };
  }

  @TenantAccess()
  @Delete('images')
  @HttpCode(200)
  @TenantUploadsSwagger.DeleteImage()
  async deleteImage(
    @Req() req: any,
    @Body() dto: DeleteImageDto,
    @Query('key') keyQuery?: string,
    @Query('path') pathQuery?: string,
  ) {
    const data = this.uploadsService.deleteImage({
      tenantSlug: String(req.tenantId || 'tenant'),
      key: dto?.key || keyQuery || null,
      path: dto?.path || pathQuery || null,
    });

    return {
      success: true,
      message: 'Image deleted successfully',
      data,
    };
  }
}
