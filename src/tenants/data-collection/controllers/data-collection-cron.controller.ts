import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
// Re-enable with Assignment Due Reminder cron:
// import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
// import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
// import { AssignmentReminderService } from '../services/assignment-reminder.service';
// import { CronSecretGuard } from '../guards/cron-secret.guard';

@ApiTags('Cron')
@Controller('cron/data-collection')
export class DataCollectionCronController {
  // Temporarily disabled: Assignment Due Reminder emails were sending too many.
  // constructor(private readonly assignmentReminderService: AssignmentReminderService) {}
  //
  // @Post('due-reminders')
  // @HttpCode(200)
  // @UseGuards(CronSecretGuard)
  // @ApiOperation({
  //   summary: 'Run due-assignment reminder emails (for GitHub Actions / external cron)',
  //   description:
  //     'No JWT required. Secure with CRON_SECRET via `x-cron-secret` header or `Authorization: Bearer <CRON_SECRET>`. Processes all tenants.',
  // })
  // @ApiHeader({
  //   name: 'x-cron-secret',
  //   required: true,
  //   description: 'Must match server env CRON_SECRET',
  // })
  // @ApiResponse({ status: 200, description: 'Reminder run completed.' })
  // @ApiResponse({ status: 401, description: 'Missing/invalid CRON_SECRET.' })
  // async dueReminders() {
  //   const data = await this.assignmentReminderService.runForAllTenants();
  //   return {
  //     success: true,
  //     message: 'Due reminder run completed',
  //     data,
  //   };
  // }
}
