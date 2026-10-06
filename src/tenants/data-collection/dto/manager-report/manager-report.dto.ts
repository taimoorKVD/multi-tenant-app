import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ManagerOrderStatus, ManagerRequestKind, ManagerRequestStatus } from '../../entities/enums';

export class QueryManagerRequestsDto {
  @ApiPropertyOptional({
    enum: ManagerRequestKind,
    example: ManagerRequestKind.PURCHASE,
    description:
      '`purchase` | `maintenance` | `notification` — maps to Manager Portal sidebar tabs. Notification rows come from `sendNotification` actions.',
  })
  @IsOptional()
  @IsEnum(ManagerRequestKind)
  kind?: ManagerRequestKind;

  @ApiPropertyOptional({ enum: ManagerRequestStatus, example: ManagerRequestStatus.OPEN })
  @IsOptional()
  @IsEnum(ManagerRequestStatus)
  status?: ManagerRequestStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

export class QueryManagerCartDto {
  @ApiPropertyOptional({ enum: ManagerRequestKind, example: ManagerRequestKind.PURCHASE })
  @IsOptional()
  @IsEnum(ManagerRequestKind)
  kind?: ManagerRequestKind;
}

export class CatalogCartItemDto {
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  itemId?: number;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  vendorId!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitCost?: number;

  @ApiPropertyOptional({ example: '1kg' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: '001' })
  @IsOptional()
  @IsString()
  itemNumber?: string;

  @ApiPropertyOptional({ example: 'Apple' })
  @IsOptional()
  @IsString()
  itemLabel?: string;
}

export class AddToCartDto {
  @ApiProperty({ enum: ManagerRequestKind, example: ManagerRequestKind.PURCHASE })
  @IsEnum(ManagerRequestKind)
  kind!: ManagerRequestKind;

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  requestIds?: number[];

  @ApiPropertyOptional({ type: [CatalogCartItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogCartItemDto)
  catalogItems?: CatalogCartItemDto[];
}

export class CheckoutCartDto {
  @ApiProperty({ enum: ManagerRequestKind, example: ManagerRequestKind.PURCHASE })
  @IsEnum(ManagerRequestKind)
  kind!: ManagerRequestKind;
}

export class QueryManagerOrdersDto {
  @ApiPropertyOptional({ enum: ManagerRequestKind, example: ManagerRequestKind.PURCHASE })
  @IsOptional()
  @IsEnum(ManagerRequestKind)
  kind?: ManagerRequestKind;

  @ApiPropertyOptional({
    enum: ManagerOrderStatus,
    example: ManagerOrderStatus.PENDING,
    description: 'pending = Pending Purchases; done = Purchases Done. contacted is also pending-tab.',
  })
  @IsOptional()
  @IsEnum(ManagerOrderStatus)
  status?: ManagerOrderStatus;

  @ApiPropertyOptional({ enum: ['pending', 'done'], example: 'pending' })
  @IsOptional()
  @IsString()
  tab?: 'pending' | 'done';

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

export class MarkOrderContactDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  website?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  phone?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  email?: boolean;
}

export class ReceiveOrderItemDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  id!: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  received?: boolean;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  actualPrice?: number;
}

export class ReceiveOrderDto {
  @ApiProperty({ type: [ReceiveOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveOrderItemDto)
  items!: ReceiveOrderItemDto[];
}
