import {Body, Controller, Delete, Get, Param, Post, Put, Req} from '@nestjs/common';
import {ProductsService} from './products.service';
import {Product} from './entities';

@Controller('tenant/:tenantId/products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) {
    }

    @Post()
    create(
        @Req() req,
        @Param('tenantId') tenantId: string,
        @Body() body: Partial<Product>,
    ) {
        return this.productsService.create(req, body);
    }

    @Get()
    findAll(@Req() req, @Param('tenantId') tenantId: string) {
        return this.productsService.findAll(req);
    }

    @Get(':id')
    findOne(@Req() req, @Param('tenantId') tenantId: string, @Param('id') id: number) {
        return this.productsService.findOne(req, id);
    }

    @Put(':id')
    update(
        @Req() req,
        @Param('tenantId') tenantId: string,
        @Param('id') id: number,
        @Body() body: Partial<Product>,
    ) {
        return this.productsService.update(req, id, body);
    }

    @Delete(':id')
    remove(@Req() req, @Param('tenantId') tenantId: string, @Param('id') id: number) {
        return this.productsService.remove(req, id);
    }
}
