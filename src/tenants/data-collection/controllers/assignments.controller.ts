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
    description: 'Lists assignments for the authenticated employee.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'Assignments fetched successfully.' })
  myWork(@Req() req: any, @Query() query: QueryAssignmentDto) {
    return this.assignmentsService.findMyWork(req, query);
  }

  @Post('mark-overdue')
  @TenantAccess('edit-dc-template')
  @ApiOperation({ summary: 'Mark past-due pending/in-progress assignments as overdue' })
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
