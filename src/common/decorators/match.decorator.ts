import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'Match' })
export class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const relatedPropertyName =
      typeof args.constraints?.[0] === 'string' ? args.constraints[0] : '';
    const obj = args.object as Record<string, unknown>;
    const relatedValue = obj[relatedPropertyName];
    return value === relatedValue;
  }

  defaultMessage(args: ValidationArguments) {
    const relatedPropertyName =
      typeof args.constraints?.[0] === 'string' ? args.constraints[0] : '';
    return `${args.property} must match ${relatedPropertyName}`;
  }
}

export function Match(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: MatchConstraint,
    });
  };
}
