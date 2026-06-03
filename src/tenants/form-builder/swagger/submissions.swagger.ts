import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSubmissionDto } from '../dto';

export const TenantFormBuilderSubmissionsSwagger = {
  Tags: () => ApiTags('Form Builder Management - Submissions'),
  Auth: () => ApiBearerAuth('access-token'),

  Submit: () =>
    applyDecorators(
      ApiOperation({ summary: 'Submit form payload with index ledger transaction' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({ type: CreateSubmissionDto }),
      ApiResponse({ status: 201, description: 'Submission created successfully.' }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({ summary: 'List form submissions' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Submissions returned successfully.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get submission by id' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Submission returned successfully.' }),
      ApiResponse({ status: 404, description: 'Submission not found.' }),
    ),
};
