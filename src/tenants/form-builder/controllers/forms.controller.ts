import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Req,
    UseGuards,
} from '@nestjs/common';
import { BulkDeleteDto } from '../../../common/dto';
import { BulkDeleteSwagger } from '../../../common/swagger';
import {
    CreateFormDto,
    SaveSchemaDto,
    UpdateFormDto,
} from '../dto';
import { FormsService } from '../services';
import { TenantAuthGuard } from '../../auth/guards';
import { TenantFormBuilderFormsSwagger } from '../swagger';

@TenantFormBuilderFormsSwagger.Tags()
@TenantFormBuilderFormsSwagger.Auth()
@UseGuards(TenantAuthGuard)
@Controller()
export class FormsController {
    constructor(private readonly formsService: FormsService) { }

    @Get(['modules', 'tenant/:tenantId/modules'])
    @TenantFormBuilderFormsSwagger.GetModules()
    getModules(@Req() req: any) {
        return this.formsService.getModules(req);
    }

    @Get(['forms/modules/:moduleSlug', 'tenant/:tenantId/forms/modules/:moduleSlug'])
    @TenantFormBuilderFormsSwagger.BootstrapByModule()
    bootstrapByModule(@Req() req: any, @Param('moduleSlug') moduleSlug: string) {
        return this.formsService.bootstrapByModuleSlug(req, moduleSlug);
    }

    @Post(['forms', 'tenant/:tenantId/forms'])
    @TenantFormBuilderFormsSwagger.Create()
    create(@Req() req: any, @Body() dto: CreateFormDto) {
        return this.formsService.create(req, dto);
    }

    @Get(['forms', 'tenant/:tenantId/forms'])
    @TenantFormBuilderFormsSwagger.FindAll()
    findAll(@Req() req: any) {
        return this.formsService.findAll(req);
    }

    @Get(['forms/:id', 'tenant/:tenantId/forms/:id'])
    @TenantFormBuilderFormsSwagger.FindOne()
    findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.formsService.findOne(req, id);
    }

    @Put(['forms/:id', 'tenant/:tenantId/forms/:id'])
    @TenantFormBuilderFormsSwagger.Update()
    update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFormDto) {
        return this.formsService.update(req, id, dto);
    }

    @Delete(['forms/bulk', 'tenant/:tenantId/forms/bulk'])
    @BulkDeleteSwagger('forms')
    bulkRemove(@Req() req: any, @Body() dto: BulkDeleteDto) {
        return this.formsService.bulkRemove(req, dto.ids);
    }

    @Delete(['forms/:id', 'tenant/:tenantId/forms/:id'])
    @TenantFormBuilderFormsSwagger.Delete()
    remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.formsService.remove(req, id);
    }

    @Put(['forms/:id/schema', 'tenant/:tenantId/forms/:id/schema'])
    @TenantFormBuilderFormsSwagger.SaveSchema()
    saveSchema(
        @Req() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: SaveSchemaDto,
    ) {
        return this.formsService.saveSchema(req, id, dto);
    }

    @Post(['forms/:id/publish', 'tenant/:tenantId/forms/:id/publish'])
    @TenantFormBuilderFormsSwagger.Publish()
    publish(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.formsService.publish(req, id);
    }

}
