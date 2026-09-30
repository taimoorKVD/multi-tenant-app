import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantAccess } from '../../../common/decorators/tenant-access.decorator';
import { AssignmentsService } from '../services/assignments.service';
// Re-enable with Assignment Due Reminder endpoint:
// import { AssignmentReminderService } from '../services/assignment-reminder.service';
import { QueryAssignmentDto } from '../dto/assignments/query-assignment.dto';
import { QueryAssignedFormsDto } from '../dto/assignments/query-assigned-forms.dto';
import { QueryAssignedFormDetailDto } from '../dto/assignments/query-assigned-form-detail.dto';
import { StartAssignmentDto } from '../dto/assignments/start-assignment.dto';

@ApiTags('Data Collection - Assignments')
@ApiBearerAuth('access-token')
@Controller(['data-collection/assignments', 'tenant/:tenantId/data-collection/assignments'])
export class AssignmentsController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    // private readonly assignmentReminderService: AssignmentReminderService,
  ) {}

  @Get('my-work')
  @TenantAccess('view-dc-assignment')
  @ApiOperation({
    summary: "Today's Work",
    description:
      'Lists assignments for the authenticated employee. Each item includes `formName`, `mode`, `submissionId`, `submission`, and `completion` (employee-facing title/message for shared vs individual completed states). ' +
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

  @Get('assigned-forms')
  @TenantAccess('view-dc-assignment')
  @ApiOperation({
    summary: 'Assigned Forms (admin listing)',
    description:
      '1 assignment = 1 row (template + assignee for individual, template for shared). ' +
      'Includes frequency, start/end period, progress counts (completed / inProgress / overdue), and nextDue. ' +
      'Filter by `userId` (one or many) and/or `jobPositionId` (one or many). ' +
      '`stats` is occurrence-level for the current filters. ' +
      '`assignmentStats` is the board summary (independent of status filter): ' +
      '`totalAssigned` = active templates; withOverdue / withInProgress / fullyCompleted = series progress. ' +
      'Use `responseStatus` (submitted|flagged|failed|approved) to filter by submission review outcome — independent of assignment `status`. ' +
      'Use `GET assigned-forms/:assignmentId` for View Details (summary + paginated occurrences).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'assigneeUserId',
    required: false,
    type: Number,
    description: 'Single assignee filter (legacy). Prefer userId.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    isArray: true,
    description: 'One or more assignee user IDs (`userId=4&userId=8` or `userId=4,8`).',
  })
  @ApiQuery({
    name: 'jobPositionId',
    required: false,
    type: Number,
    isArray: true,
    description: 'One or more job position IDs (`jobPositionId=5&jobPositionId=6` or `jobPositionId=5,6`).',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'not_started', 'in_progress', 'completed', 'overdue', 'cancelled'],
    description: 'Assignment workflow status. For review outcomes use responseStatus.',
  })
  @ApiQuery({
    name: 'responseStatus',
    required: false,
    enum: ['submitted', 'flagged', 'failed', 'approved'],
    isArray: true,
    description:
      'Filter by submission/response review status. Repeat or comma-separate ' +
      '(`responseStatus=flagged&responseStatus=failed` or `responseStatus=flagged,failed`).',
  })
  @ApiQuery({ name: 'dueFrom', required: false, type: String, example: '2026-09-01' })
  @ApiQuery({ name: 'dueTo', required: false, type: String, example: '2026-09-30' })
  @ApiQuery({
    name: 'recentSubmissions',
    required: false,
    type: Boolean,
    description: 'When true, only rows with a submitted submission in the recent window.',
  })
  @ApiQuery({ name: 'recentDays', required: false, type: Number, example: 7 })
  @ApiResponse({
    status: 200,
    description: 'Grouped assignment listing.',
    schema: {
      example: {
        success: true,
        stats: {
          level: 'occurrence',
          totalAssigned: 420,
          completed: 18,
          inProgress: 4,
          overdue: 2,
          notStarted: 396,
        },
        assignmentStats: {
          level: 'assignment',
          totalAssigned: 24,
          withOverdue: 2,
          withInProgress: 4,
          fullyCompleted: 3,
        },
        meta: { total: 24, page: 1, lastPage: 2, limit: 15 },
        data: [
          {
            id: 101,
            seriesKey: 't:10:u:5',
            formName: 'Kitchen Daily Checklist',
            assignedTo: [{ id: 5, name: 'Ahmer' }],
            frequencyLabel: 'Daily',
            startDateLabel: 'Sep 1, 2026',
            periodLabel: 'Sep 1, 2026 → Aug 31, 2027',
            progress: {
              total: 365,
              completed: 18,
              inProgress: 2,
              overdue: 1,
              pending: 344,
              upcoming: 346,
            },
            completed: 18,
            inProgress: 2,
            overdue: 1,
            nextDueLabel: 'Sep 23, 2026',
          },
        ],
      },
    },
  })
  assignedForms(@Req() req: any, @Query() query: QueryAssignedFormsDto) {
    return this.assignmentsService.findAssignedForms(req, query);
  }

  @Get('assigned-forms/:assignmentId')
  @TenantAccess('view-dc-assignment')
  @ApiOperation({
    summary: 'Assigned Form details (View)',
    description:
      'Single API for the View Details drawer. Pass any occurrence `id` from the listing row. ' +
      'Returns assignment summary (form, assignees, frequency, period, progress totals) plus ' +
      'paginated occurrence history. Default = overdue + completed + in_progress + the next 1 upcoming. ' +
      'Pass `status=upcoming` for all upcoming (paginated), or `month` / `date` / dueFrom/dueTo for a wider range. ' +
      'Filter occurrences by assignment `status` and/or submission `responseStatus` (submitted|flagged|failed|approved). ' +
      'Completed occurrences include full `submission` (answers + template.schema) for read-only View.',
  })
  @ApiParam({
    name: 'assignmentId',
    type: Number,
    description: 'Any assignment occurrence id from the listing (`data[].id`).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 15 })
  @ApiQuery({
    name: 'month',
    required: false,
    type: String,
    example: '2026-09',
    description:
      'Full UTC calendar month. Omit for default (overdue/completed/in_progress + next 1 upcoming).',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2026-09-17',
    description: 'Filter occurrences to a single due date (YYYY-MM-DD, UTC).',
  })
  @ApiQuery({ name: 'dueFrom', required: false, type: String, example: '2026-09-01' })
  @ApiQuery({ name: 'dueTo', required: false, type: String, example: '2026-09-30' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'all',
      'pending',
      'not_started',
      'in_progress',
      'completed',
      'overdue',
      'upcoming',
      'cancelled',
    ],
    description:
      'Assignment occurrence status. `upcoming` returns all pending/in_progress from today onward (paginated). ' +
      'Default with no range params = overdue/completed/in_progress + next 1 upcoming. ' +
      'For review outcomes use responseStatus.',
  })
  @ApiQuery({
    name: 'responseStatus',
    required: false,
    enum: ['submitted', 'flagged', 'failed', 'approved'],
    isArray: true,
    description:
      'Filter occurrences by submission review status. Repeat or comma-separate ' +
      '(`responseStatus=flagged,failed`).',
  })
  @ApiResponse({
    status: 200,
    description: 'Assignment summary + occurrence history.',
    schema: {
      example: {
        success: true,
        data: {
          assignment: {
            id: 101,
            seriesKey: 't:10:u:5',
            formName: 'Kitchen Daily Checklist',
            frequencyLabel: 'Daily',
            periodLabel: 'Sep 1, 2026 → Aug 31, 2027',
            summary: {
              formName: 'Kitchen Daily Checklist',
              assignedTo: [{ id: 5, name: 'Ahmer' }],
              frequencyLabel: 'Daily',
              periodLabel: 'Sep 1, 2026 → Aug 31, 2027',
              totalOccurrences: 365,
              completed: 18,
              inProgress: 2,
              overdue: 1,
              upcoming: 344,
            },
          },
          occurrences: {
            meta: {
              total: 30,
              page: 1,
              lastPage: 1,
              limit: 31,
              month: '2026-09',
              status: 'all',
            },
            data: [
              {
                id: 150,
                dueDateLabel: 'Sep 22, 2026',
                status: 'completed',
                statusLabel: 'Completed',
                submittedAtLabel: 'Sep 22, 2026, 10:30 AM',
                action: 'view',
                submissionId: 40,
                submission: {
                  id: 40,
                  answers: { fld_001: '72°F', fld_002: 'Yes' },
                  template: {
                    id: 10,
                    name: 'Kitchen Daily Checklist',
                    schema: { sections: [] },
                  },
                },
              },
              {
                id: 151,
                dueDateLabel: 'Sep 23, 2026',
                status: 'in_progress',
                statusLabel: 'In Progress',
                action: 'continue',
                submissionId: 41,
              },
            ],
          },
        },
      },
    },
  })
  assignedFormDetail(
    @Req() req: any,
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Query() query: QueryAssignedFormDetailDto,
  ) {
    return this.assignmentsService.findAssignedFormDetail(req, assignmentId, query);
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

  // Temporarily disabled: Assignment Due Reminder emails were sending too many.
  // @Post('send-due-reminders')
  // @TenantAccess('edit-dc-template')
  // @ApiOperation({
  //   summary: 'Send due-assignment reminder emails',
  //   description:
  //     'Runs overdue marking + assignment-due emails for all tenants (same as the hourly cron). Idempotent per assignment/day.',
  // })
  // sendDueReminders() {
  //   return this.assignmentReminderService.runForAllTenants().then((data) => ({
  //     success: true,
  //     message: 'Due reminder run completed',
  //     data,
  //   }));
  // }

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
  @ApiOperation({
    summary: 'Start an assignment (mark in progress)',
    description:
      'Marks the task in progress and ensures a draft submission exists. ' +
      'Pass `answers` to save progress when leaving the form; my-work / get assignment return those answers for resume.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: StartAssignmentDto, required: false })
  start(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StartAssignmentDto = {},
  ) {
    return this.assignmentsService.start(req, id, dto);
  }
}
