import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BulkDeleteDto } from '../dto';

export function BulkDeleteSwagger(resourceLabel: string) {
  return applyDecorators(
    ApiOperation({
      summary: `Bulk delete ${resourceLabel}`,
      description: `Deletes multiple ${resourceLabel} by ID. All provided IDs must exist.`,
    }),
    ApiBody({ type: BulkDeleteDto }),
    ApiResponse({
      status: 200,
      description: `${resourceLabel} deleted successfully.`,
      schema: {
        example: {
          success: true,
          message: '3 record(s) deleted successfully',
          data: {
            deletedIds: [1, 2, 3],
            count: 3,
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'One or more records were not found.',
      schema: {
        example: {
          success: false,
          message: 'Records not found for IDs: 99, 100',
          statusCode: 404,
        },
      },
    }),
  );
}
