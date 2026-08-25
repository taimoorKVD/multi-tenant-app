import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional } from 'class-validator';

export class SaveSchemaDto {
  @ApiProperty({
    example: {
      fields: [
        {
          id: 'fld_1787661766339_c985abb',
          type: 'image',
          fieldTypeName: 'image',
          label: 'Upload Images',
          name: 'image_upload',
          referenceImages: [
            {
              url: 'http://localhost:3000/uploads/acme/reference/example-1.png',
              path: '/uploads/acme/reference/example-1.png',
              key: 'acme/reference/example-1.png',
              fileName: 'example-1.png',
              mimeType: 'image/png',
              size: 24576,
              purpose: 'reference',
            },
            {
              url: 'http://localhost:3000/uploads/acme/reference/example-2.png',
              path: '/uploads/acme/reference/example-2.png',
              key: 'acme/reference/example-2.png',
              fileName: 'example-2.png',
              mimeType: 'image/png',
              size: 28400,
              purpose: 'reference',
            },
          ],
          multiple: true,
          minFiles: 1,
          maxFiles: 5,
          required: true,
          isShow: true,
          isReadonly: false,
          isEditable: true,
          validations: {},
          width: 12,
          order: 10,
        },
      ],
    },
    description:
      'Full builder schema payload owned by frontend. For `type`/`fieldTypeName` = `image`, store builder examples on `referenceImages` (array; each item from POST /api/uploads/images?purpose=reference). Use `multiple`/`minFiles`/`maxFiles` for multi-upload. User answers are an array of upload meta under the field id — no image comparison.',
  })
  @IsObject()
  schema: Record<string, any>;

  @ApiPropertyOptional({
    example: true,
    description: 'If true, force form status to draft after save. Omit or set false to publish the form on save.',
  })
  @IsOptional()
  @IsBoolean()
  markAsDraft?: boolean = false;

  @ApiPropertyOptional({ example: 1, description: 'Actor user id.' })
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
