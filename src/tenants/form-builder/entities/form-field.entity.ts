import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Form } from './form.entity';
import { FormSection } from './form-section.entity';
import { FieldType } from './field-type.entity';
import { FieldOption } from './field-option.entity';
import { FieldValidation } from './field-validation.entity';
import { FieldConditionalRule } from './field-conditional-rule.entity';

@Entity('form_fields')
export class FormField {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'form_id' })
    formId!: number;

    @ManyToOne(() => Form, (form) => form.fields, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'form_id' })
    form!: Form;

    @Column({ type: 'int', name: 'section_id', nullable: true })
    sectionId!: number | null;

    @ManyToOne(() => FormSection, (section) => section.fields, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'section_id' })
    section!: FormSection | null;

    @Column({ type: 'int', name: 'field_type_id' })
    fieldTypeId!: number;

    @ManyToOne(() => FieldType, (fieldType) => fieldType.fields, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'field_type_id' })
    fieldType!: FieldType;

    @Column({ type: 'varchar', name: 'field_key', length: 120 })
    fieldKey!: string;

    @Column({ type: 'varchar', length: 180 })
    label!: string;

    @Column({ type: 'varchar', length: 180 })
    name!: string;

    @Column({ type: 'varchar', nullable: true, length: 255 })
    placeholder!: string | null;

    @Column({ type: 'text', name: 'help_text', nullable: true })
    helpText!: string | null;

    @Column({ type: 'boolean', name: 'is_required', default: false })
    isRequired!: boolean;

    @Column({ type: 'boolean', name: 'is_unique', default: false })
    isUnique!: boolean;

    @Column({ type: 'boolean', name: 'is_readonly', default: false })
    isReadonly!: boolean;

    @Column({ type: 'boolean', name: 'is_system_default', default: false })
    isSystemDefault!: boolean;

    @Column({ type: 'boolean', name: 'is_system_field', default: false })
    isSystemField!: boolean;

    @Column({ type: 'varchar', name: 'system_mapping_key', length: 120, nullable: true })
    systemMappingKey!: string | null;

    @Column({ type: 'boolean', name: 'is_deletable', default: true })
    isDeletable!: boolean;

    @Column({ type: 'boolean', name: 'is_editable', default: true })
    isEditable!: boolean;

    @Column({ type: 'int', name: 'sort_order', default: 0 })
    sortOrder!: number;

    @Column({
        type: 'jsonb',
        name: 'layout_config',
        default: { grid_width_desktop: 6, grid_width_mobile: 12 },
    })
    layoutConfig!: Record<string, any>;

    @OneToMany(() => FieldOption, (option) => option.field, { cascade: true })
    options!: FieldOption[];

    @OneToMany(() => FieldValidation, (validation) => validation.field, { cascade: true })
    validations!: FieldValidation[];

    @OneToMany(() => FieldConditionalRule, (rule) => rule.dependentField, { cascade: true })
    dependentRules!: FieldConditionalRule[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;

    @Column({ type: 'int', name: 'created_by', nullable: true })
    createdBy!: number | null;

    @Column({ type: 'int', name: 'updated_by', nullable: true })
    updatedBy!: number | null;

    @DeleteDateColumn({ name: 'deleted_at', nullable: true })
    deletedAt!: Date | null;
}
