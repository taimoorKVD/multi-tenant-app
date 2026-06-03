import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../../common/decorators';
import { CreateFieldTypeDto } from '../dto';
import { PermissionsGuard } from '../guards';
import { FieldTypesService } from '../services';
import { TenantAuthGuard } from '../../auth/guards';
import { TenantFormBuilderFieldTypesSwagger } from '../swagger';

@TenantFormBuilderFieldTypesSwagger.Tags()
@TenantFormBuilderFieldTypesSwagger.Auth()
@UseGuards(TenantAuthGuard, PermissionsGuard)
@Controller()
export class FieldTypesController {
    constructor(private readonly fieldTypesService: FieldTypesService) { }

    @Get(['field-types', 'tenant/:tenantId/field-types'])
    @Permissions('view-form')
    @TenantFormBuilderFieldTypesSwagger.FindAll()
    findAll(@Req() req: any) {
        return this.fieldTypesService.findAll(req);
    }

    @Post(['field-types', 'tenant/:tenantId/field-types'])
    @Permissions('edit-form')
    @TenantFormBuilderFieldTypesSwagger.Create()
    create(@Req() req: any, @Body() dto: CreateFieldTypeDto) {
        return this.fieldTypesService.create(req, dto);
    }
}
