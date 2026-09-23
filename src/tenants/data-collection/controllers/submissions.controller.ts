import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantAccess } from '../../../common/decorators/tenant-access.decorator';
import { SubmissionsService } from '../services/submissions.service';
import { SubmissionFlagsService } from '../services/submission-flags.service';
import { CreateSubmissionDto, UpdateSubmissionDto } from '../dto/submissions/submission.dto';
import { QuerySubmissionDto } from '../dto/submissions/query-submission.dto';
import {
  CreateSubmissionFlagDto,
  FailSubmissionDto,
  ResolveSubmissionFlagDto,
  UpdateSubmissionFlagDto,
} from '../dto/submissions/submission-flag.dto';

@ApiTags('Data Collection - Submissions')
@ApiBearerAuth('access-token')
@Controller(['data-collection', 'tenant/:tenantId/data-collection'])
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly submissionFlagsService: SubmissionFlagsService,
  ) {}

  @Post('assignments/:assignmentId/submissions')
  @TenantAccess('complete-dc-assignment')
  @ApiOperation({
    summary: 'Submit (or draft) answers for an assignment',
    description:
      'Validates required fields against the pinned template version when submit=true. ' +
      'When submit=false, upserts a single draft per assignment (resume-safe) and marks the task in progress. ' +
      'On final submit: draft → submitted when there are no unresolved flags, otherwise draft → flagged.',
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
      'Requires Task → Review (`review-dc-submission`). Each item includes employee `answers`, full `template` (schema from the pinned template version when available), `mode` (individual|shared), and `completion` (employee-facing title/message for shared vs individual completed states). Status includes draft|submitted|flagged|failed|approved.',
  })
  @ApiResponse({
    status: 200,
    description: 'Submissions fetched successfully.',
    schema: {
      example: {
        success: true,
        meta: { total: 1, page: 1, lastPage: 1 },
        data: [
          {
            id: 10,
            assignmentId: 5,
            templateVersionId: 6,
            submittedBy: 7,
            answers: { fld_001: 'hello' },
            status: 'submitted',
            submittedAt: '2026-09-17T14:16:57.919Z',
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: null,
            templateId: 1,
            formName: 'Manager Report',
            mode: 'shared',
            completion: {
              state: 'completed_by_other',
              title: 'Completed by another user',
              message:
                'This shared task was completed by Cyrus Mccarty on September 17, 2026 at 7:16 PM.',
              completedByUserId: 7,
              completedByName: 'Cyrus Mccarty',
              completedAt: '2026-09-17T14:16:57.919Z',
            },
          },
        ],
      },
    },
  })
  findAll(@Req() req: any, @Query() query: QuerySubmissionDto) {
    return this.submissionsService.findAll(req, query);
  }

  @Get('submissions/:id')
  @TenantAccess('review-dc-submission')
  @ApiOperation({
    summary: 'Get submission by ID',
    description:
      'Requires Task → Review (`review-dc-submission`). Returns the submission including employee `answers`, full `template`, `mode`, and `completion`.',
  })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.submissionsService.findOne(req, id);
  }

  @Put('submissions/:id')
  @TenantAccess('complete-dc-assignment')
  @ApiOperation({
    summary: 'Update draft submission or finalize with submit=true',
    description:
      'On finalize: draft → submitted (no open flags) or draft → flagged (unresolved flags exist).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateSubmissionDto })
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubmissionDto) {
    return this.submissionsService.update(req, id, dto);
  }

  @Post('submissions/:submissionId/flags')
  @TenantAccess()
  @ApiOperation({
    summary: 'Create a field-level or response-level flag',
    description:
      'Requires `complete-dc-assignment` (assignee / shared peer) or `review-dc-submission`. ' +
      'When `fieldId` is provided it must exist on the submission’s pinned template version. ' +
      'Null/omitted `fieldId` creates a response-level flag. ' +
      'If the submission is already `submitted`, status becomes `flagged`.',
  })
  @ApiParam({ name: 'submissionId', type: Number })
  @ApiBody({ type: CreateSubmissionFlagDto })
  @ApiResponse({ status: 201, description: 'Flag created.' })
  @ApiResponse({ status: 400, description: 'Invalid field id or status.' })
  @ApiResponse({ status: 403, description: 'Not authorized for this submission.' })
  createFlag(
    @Req() req: any,
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Body() dto: CreateSubmissionFlagDto,
  ) {
    return this.submissionFlagsService.create(req, submissionId, dto);
  }

  @Get('submissions/:submissionId/flags')
  @TenantAccess()
  @ApiOperation({
    summary: 'List flags for a submission',
    description:
      'Returns open and resolved flags. Assignees (including shared peers) and reviewers may list.',
  })
  @ApiParam({ name: 'submissionId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Flags listed.',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 1,
            submissionId: 125,
            fieldId: 'temperature',
            reason: 'Temperature seems unusually high.',
            severity: 'high',
            isResolved: false,
            createdBy: { id: 42, name: 'John' },
            createdAt: '2026-09-23T10:15:00.000Z',
            resolvedBy: null,
            resolvedAt: null,
            resolutionNote: null,
          },
        ],
      },
    },
  })
  listFlags(
    @Req() req: any,
    @Param('submissionId', ParseIntPipe) submissionId: number,
  ) {
    return this.submissionFlagsService.findBySubmission(req, submissionId);
  }

  @Post('submissions/:submissionId/flags/:flagId/resolve')
  @TenantAccess('review-dc-submission')
  @ApiOperation({
    summary: 'Resolve a submission flag',
    description:
      'Requires `review-dc-submission`. Marks the flag resolved; does not auto-approve the submission. ' +
      'When the last open flag is resolved the submission remains `flagged` until explicit approve/fail.',
  })
  @ApiParam({ name: 'submissionId', type: Number })
  @ApiParam({ name: 'flagId', type: Number })
  @ApiBody({ type: ResolveSubmissionFlagDto })
  @ApiResponse({ status: 200, description: 'Flag resolved.' })
  resolveFlag(
    @Req() req: any,
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Param('flagId', ParseIntPipe) flagId: number,
    @Body() dto: ResolveSubmissionFlagDto,
  ) {
    return this.submissionFlagsService.resolve(req, submissionId, flagId, dto);
  }

  @Patch('submissions/:submissionId/flags/:flagId')
  @TenantAccess()
  @ApiOperation({
    summary: 'Update an unresolved flag',
    description:
      'Employees may edit their own unresolved flags. Reviewers may edit any unresolved flag. ' +
      'Resolved flags cannot be modified.',
  })
  @ApiParam({ name: 'submissionId', type: Number })
  @ApiParam({ name: 'flagId', type: Number })
  @ApiBody({ type: UpdateSubmissionFlagDto })
  updateFlag(
    @Req() req: any,
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Param('flagId', ParseIntPipe) flagId: number,
    @Body() dto: UpdateSubmissionFlagDto,
  ) {
    return this.submissionFlagsService.update(req, submissionId, flagId, dto);
  }

  @Post('submissions/:submissionId/approve')
  @TenantAccess('review-dc-submission')
  @ApiOperation({
    summary: 'Approve a submission',
    description:
      'Requires `review-dc-submission`. Rejects if any unresolved flags remain. ' +
      'Valid from `submitted` or `flagged` → `approved`. Sets reviewed_by / reviewed_at.',
  })
  @ApiParam({ name: 'submissionId', type: Number })
  @ApiResponse({ status: 200, description: 'Submission approved.' })
  @ApiResponse({
    status: 400,
    description: 'Unresolved flags or invalid status transition.',
  })
  approve(
    @Req() req: any,
    @Param('submissionId', ParseIntPipe) submissionId: number,
  ) {
    return this.submissionsService.approve(req, submissionId);
  }

  @Post('submissions/:submissionId/fail')
  @TenantAccess('review-dc-submission')
  @ApiOperation({
    summary: 'Fail a submission',
    description:
      'Requires `review-dc-submission`. Sets status to `failed` with a required review note. ' +
      'Existing flags are retained. Valid from `submitted` or `flagged`.',
  })
  @ApiParam({ name: 'submissionId', type: Number })
  @ApiBody({ type: FailSubmissionDto })
  @ApiResponse({ status: 200, description: 'Submission failed.' })
  fail(
    @Req() req: any,
    @Param('submissionId', ParseIntPipe) submissionId: number,
    @Body() dto: FailSubmissionDto,
  ) {
    return this.submissionsService.fail(req, submissionId, dto);
  }
}
