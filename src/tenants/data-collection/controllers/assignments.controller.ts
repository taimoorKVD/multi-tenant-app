import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantAccess } from '../../../common/decorators/tenant-access.decorator';
import { AssignmentsService } from '../services/assignments.service';
import { AssignmentReminderService } from '../services/assignment-reminder.service';
import { QueryAssignmentDto } from '../dto/assignments/query-assignment.dto';

@ApiTags('Data Collection - Assignments')
@ApiBearerAuth('access-token')
@Controller(['data-collection/assignments', 'tenant/:tenantId/data-collection/assignments'])
export class AssignmentsController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly assignmentReminderService: AssignmentReminderService,
  ) {}

  @Get('my-work')
  @TenantAccess('view-dc-assignment')
  @ApiOperation({
    summary: "Today's Work",
    description:
      'Lists assignments for the authenticated employee. Each item includes `formName`, `assignmentType`, `submissionId`, `submission`, and `completion` (employee-facing title/message for shared vs individual completed states). ' +
      'Use `status=today` and/or `date=YYYY-MM-DD` to filter by due calendar day (UTC). When both are sent, `date` selects the day.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'in_progress', 'completed', 'overdue', 'cancelled', 'today'],
    description: 'Assignment status, or `today` for due-day filtering.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-09-15',
    description: 'Due date filter (YYYY-MM-DD, UTC). Combined with `status=today`, this date is used as the day.',
  })
  @ApiResponse({
    status: 200,
    description: 'Assignments fetched successfully.',
    schema: {
      example: {
        success: true,
        meta: { total: 1, page: 1, lastPage: 1 },
        data: [
          {
            id: 1,
            templateId: 1,
            templateVersionId: 1,
            assigneeUserId: 1,
            jobPositionId: null,
            locationId: null,
            dueAt: '2026-09-15T00:00:00.000Z',
            status: 'completed',
            assignmentType: 'shared',
            mode: 'shared',
            sharedGroupKey: '1:1:2026-09-15T00:00:00.000Z:shared',
            completedByUserId: 9,
            completedAt: '2026-09-15T14:10:00.000Z',
            occurrenceKey: '1:1:2026-09-15T00:00:00.000Z:u:1',
            formName: 'Manager Report',
            templateName: 'Manager Report',
            submissionId: null,
            submission: null,
            completion: {
              state: 'completed_by_other',
              title: 'Completed by another user',
              message:
                'This shared task was completed by Ahmed on September 15, 2026 at 7:10 PM.',
              completedByUserId: 9,
              completedByName: 'Ahmed',
              completedAt: '2026-09-15T14:10:00.000Z',
            },
            createdBy: 1,
            updatedBy: 9,
            createdAt: '2026-09-15T01:41:18.879Z',
            updatedAt: '2026-09-15T14:10:00.000Z',
            deletedAt: null,
          },
        ],
      },
    },
  })
  myWork(@Req() req: any, @Query() query: QueryAssignmentDto) {
    return this.assignmentsService.findMyWork(req, query);
  }

  @Post('mark-overdue')
  @TenantAccess('edit-dc-template')
  @ApiOperation({
    summary: 'Mark past-due pending/in-progress assignments as overdue',
    description:
      'Marks open assignments overdue only after their due calendar day (UTC) has ended. ' +
      'Also heals same-day rows that were incorrectly marked overdue earlier.',
  })
  markOverdue(@Req() req: any) {
    return this.assignmentsService.markOverdue(req);
  }

  @Post('send-due-reminders')
  @TenantAccess('edit-dc-template')
  @ApiOperation({
    summary: 'Send due-assignment reminder emails',
    description:
      'Runs overdue marking + assignment-due emails for all tenants (same as the hourly cron). Idempotent per assignment/day.',
  })
  sendDueReminders() {
    return this.assignmentReminderService.runForAllTenants().then((data) => ({
      success: true,
      message: 'Due reminder run completed',
      data,
    }));
  }

  @Get()
  @TenantAccess('view-dc-assignment')
  @ApiOperation({ summary: 'List assignments' })
  findAll(@Req() req: any, @Query() query: QueryAssignmentDto) {
    return this.assignmentsService.findAll(req, query);
  }

  @Get(':id')
  @TenantAccess('view-dc-assignment')
  @ApiOperation({ summary: 'Get assignment by ID' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.findOne(req, id);
  }

  @Post(':id/start')
  @TenantAccess('complete-dc-assignment')
  @ApiOperation({ summary: 'Start an assignment (mark in progress)' })
  @ApiParam({ name: 'id', type: Number })
  start(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.start(req, id);
  }
}
