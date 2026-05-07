import {Transform, Type} from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {VendorOrderDay, VendorPaymentMethod} from '../entities';

export class CreateVendorContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone_number?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_primary?: boolean;
}

export class CreateVendorOrderDeadlineDto {
  @Transform(({value}) => String(value).trim().toLowerCase())
  @IsEnum(VendorOrderDay)
  day!: VendorOrderDay;
}

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({message: 'country_id must be an integer.'})
  country_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({message: 'state_id must be an integer.'})
  state_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({message: 'city_id must be an integer.'})
  city_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone_number?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contact_person?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contact_phone?: string;

  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({maxDecimalPlaces: 2})
  min_order?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  payment_cod?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  payment_eft?: boolean;

  @IsOptional()
  @Transform(({value}) =>
    Array.isArray(value) ? value.map((item) => String(item).trim().toLowerCase()) : value,
  )
  @IsArray()
  @ArrayUnique()
  @IsEnum(VendorPaymentMethod, {each: true})
  payment_methods?: VendorPaymentMethod[];

  @IsOptional()
  @Transform(({value}) =>
    Array.isArray(value) ? value.map((item) => String(item).trim().toLowerCase()) : value,
  )
  @IsArray()
  @ArrayUnique()
  @IsEnum(VendorOrderDay, {each: true})
  order_deadline_days?: VendorOrderDay[];

  @IsOptional()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => CreateVendorContactDto)
  contacts?: CreateVendorContactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => CreateVendorOrderDeadlineDto)
  order_deadlines?: CreateVendorOrderDeadlineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  instructions?: string;
}
