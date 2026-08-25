import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DeleteImageDto } from '../dto';

export const TenantUploadsSwagger = {
  Tags: () => ApiTags('Uploads'),
  Auth: () => ApiBearerAuth('access-token'),

  UploadImage: () =>
    applyDecorators(
      ApiOperation({
        operationId: 'uploadImage',
        summary: 'Upload an image',
        description:
          'POST /api/uploads/images — multipart field `file`. Use `purpose=reference` (builder) or `purpose=answer` (form fill).',
      }),
      ApiConsumes('multipart/form-data'),
      ApiQuery({
        name: 'purpose',
        required: false,
        enum: ['reference', 'answer'],
        description: 'reference = builder example; answer = user upload',
      }),
      ApiBody({
        schema: {
          type: 'object',
          required: ['file'],
          properties: {
            file: {
              type: 'string',
              format: 'binary',
              description: 'JPEG, PNG, GIF, or WebP (max 5MB)',
            },
          },
        },
      }),
      ApiResponse({
        status: 201,
        description: 'Image uploaded successfully.',
        schema: {
          example: {
            success: true,
            message: 'Image uploaded successfully',
            data: {
              url: 'http://localhost:3000/uploads/acme/reference/a1b2c3d4.png',
              path: '/uploads/acme/reference/a1b2c3d4.png',
              key: 'acme/reference/a1b2c3d4.png',
              fileName: 'example.png',
              mimeType: 'image/png',
              size: 24576,
              purpose: 'reference',
            },
          },
        },
      }),
      ApiResponse({ status: 400, description: 'Invalid file or purpose.' }),
      ApiResponse({ status: 401, description: 'Unauthorized.' }),
    ),

  DeleteImage: () =>
    applyDecorators(
      ApiOperation({
        operationId: 'deleteImage',
        summary: 'Delete an uploaded image',
        description:
          'DELETE /api/uploads/images — removes file from storage. Pass `key` (preferred) from upload response `data.key`.',
      }),
      ApiQuery({
        name: 'key',
        required: false,
        type: String,
        example: 'acme/reference/a1b2c3d4.png',
        description: 'Storage key from upload (`data.key`)',
      }),
      ApiQuery({
        name: 'path',
        required: false,
        type: String,
        example: '/uploads/acme/reference/a1b2c3d4.png',
        description: 'Optional public path (`data.path`)',
      }),
      ApiBody({ type: DeleteImageDto, required: false }),
      ApiResponse({
        status: 200,
        description: 'Image deleted successfully.',
        schema: {
          example: {
            success: true,
            message: 'Image deleted successfully',
            data: {
              key: 'acme/reference/a1b2c3d4.png',
              deleted: true,
            },
          },
        },
      }),
      ApiResponse({ status: 400, description: 'Invalid key or tenant mismatch.' }),
      ApiResponse({ status: 404, description: 'Image not found on storage.' }),
      ApiResponse({ status: 401, description: 'Unauthorized.' }),
    ),
};
