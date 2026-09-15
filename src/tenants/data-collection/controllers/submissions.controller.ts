import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantAccess } from '../../../common/decorators/tenant-access.decorator';
import { SubmissionsService } from '../services/submissions.service';
import { CreateSubmissionDto, UpdateSubmissionDto } from '../dto/submissions/submission.dto';
import { QuerySubmissionDto } from '../dto/submissions/query-submission.dto';

@ApiTags('Data Collection - Submissions')
@ApiBearerAuth('access-token')
@Controller(['data-collection', 'tenant/:tenantId/data-collection'])
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post('assignments/:assignmentId/submissions')
  @TenantAccess('complete-dc-assignment')
  @ApiOperation({
    summary: 'Submit (or draft) answers for an assignment',
    description: 'Validates required fields against the pinned template version when submit=true.',
  })
  @ApiParam({ name: 'assignmentId', type: Number })
  @ApiBody({ type: CreateSubmissionDto })
  @ApiResponse({ status: 201, description: 'Submission created.' })
  create(
    @Req() req: any,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissionsService.create(req, assignmentId, dto);
  }

  @Get('submissions')
  @TenantAccess('review-dc-submission')
  @ApiOperation({
    summary: 'List submissions (manager review)',
    description:
      'Requires Task → Review (`review-dc-submission`). Each item includes employee `answers` plus the full `template` (schema from the pinned template version when available).',
  })
  findAll(@Req() req: any, @Query() query: QuerySubmissionDto) {
    return this.submissionsService.findAll(req, query);
  }

  @Get('submissions/:id')
  @TenantAccess('review-dc-submission')
  @ApiOperation({
    summary: 'Get submission by ID',
    description:
      'Requires Task → Review (`review-dc-submission`). Returns the submission including employee `answers` and the full `template`.',
  })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.submissionsService.findOne(req, id);
  }

  @Put('submissions/:id')
  @TenantAccess('complete-dc-assignment')
  @ApiOperation({ summary: 'Update draft submission or finalize with submit=true' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateSubmissionDto })
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubmissionDto) {
    return this.submissionsService.update(req, id, dto);
  }
}
