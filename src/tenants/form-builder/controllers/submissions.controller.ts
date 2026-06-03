import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../../common/decorators';
import { CreateSubmissionDto } from '../dto';
import { PermissionsGuard } from '../guards';
import { SubmissionsService } from '../services';
import { TenantAuthGuard } from '../../auth/guards';
import { TenantFormBuilderSubmissionsSwagger } from '../swagger';

@TenantFormBuilderSubmissionsSwagger.Tags()
@TenantFormBuilderSubmissionsSwagger.Auth()
@UseGuards(TenantAuthGuard, PermissionsGuard)
@Controller()
export class SubmissionsController {
    constructor(private readonly submissionsService: SubmissionsService) { }

    @Post(['forms/:id/submit', 'tenant/:tenantId/forms/:id/submit'])
    @Permissions('submit-form')
    @TenantFormBuilderSubmissionsSwagger.Submit()
    submit(
        @Req() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CreateSubmissionDto,
    ) {
        return this.submissionsService.submit(req, id, dto);
    }

    @Get(['forms/:id/submissions', 'tenant/:tenantId/forms/:id/submissions'])
    @Permissions('view-form')
    @TenantFormBuilderSubmissionsSwagger.FindAll()
    findAll(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.submissionsService.findAll(req, id);
    }

    @Get(['submissions/:id', 'tenant/:tenantId/submissions/:id'])
    @Permissions('view-form')
    @TenantFormBuilderSubmissionsSwagger.FindOne()
    findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.submissionsService.findOne(req, id);
    }
}
