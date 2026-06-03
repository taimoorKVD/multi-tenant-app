import { BadRequestException, Injectable } from '@nestjs/common';

type ValidationRuleLike = {
  ruleType?: string;
  ruleValue?: any;
  errorMessage?: string | null;
  isActive?: boolean;
};

type FieldLike = {
  fieldKey?: string;
  name?: string;
  label?: string;
  isRequired?: boolean;
  validations?: ValidationRuleLike[];
};

@Injectable()
export class ValidationService {
  validateSubmission(fields: FieldLike[], payload: Record<string, any>) {
    const errors: string[] = [];

    for (const field of fields) {
      const key = field.fieldKey || field.name;
      if (!key) continue;

      const label = field.label || key;
      const value = payload[key];

      if (field.isRequired && (value === undefined || value === null || value === '')) {
        errors.push(`${label} is required.`);
      }

      for (const validation of field.validations || []) {
        if (!validation.isActive) continue;
        if (value === undefined || value === null) continue;

        switch (validation.ruleType) {
          case 'min_length':
            if (String(value).length < Number(validation.ruleValue || 0)) {
              errors.push(validation.errorMessage || `${label} is too short.`);
            }
            break;
          case 'max_length':
            if (String(value).length > Number(validation.ruleValue || 0)) {
              errors.push(validation.errorMessage || `${label} is too long.`);
            }
            break;
          case 'regex': {
            const regex = new RegExp(String(validation.ruleValue || ''));
            if (!regex.test(String(value))) {
              errors.push(validation.errorMessage || `${label} is invalid.`);
            }
            break;
          }
          default:
            break;
        }
      }
    }

    if (errors.length) {
      throw new BadRequestException({ message: 'Submission validation failed', errors });
    }
  }
}
