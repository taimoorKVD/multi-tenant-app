import { PartialType } from '@nestjs/mapped-types';
import { CreateEmailTemplateRecipientDto } from './create-email-template-recipient.dto';

export class UpdateEmailTemplateRecipientDto extends PartialType(CreateEmailTemplateRecipientDto) {}