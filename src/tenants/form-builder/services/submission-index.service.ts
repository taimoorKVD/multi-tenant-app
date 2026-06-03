import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { SubmissionIndex } from '../entities';

@Injectable()
export class SubmissionIndexService {
  private detectValueType(value: any): string {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
  }

  private flatten(input: Record<string, any>, prefix = ''): Array<{ key: string; value: any }> {
    const output: Array<{ key: string; value: any }> = [];

    for (const [key, value] of Object.entries(input || {})) {
      const currentKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        output.push(...this.flatten(value, currentKey));
      } else {
        output.push({ key: currentKey, value });
      }
    }

    return output;
  }

  async indexSubmission(
    manager: EntityManager,
    submissionId: number,
    data: Record<string, any>,
    actorId?: number | null,
  ): Promise<void> {
    const repo = manager.getRepository(SubmissionIndex);
    const flattened = this.flatten(data || {});

    if (!flattened.length) return;

    const rows = flattened.map((item) =>
      repo.create({
        submissionId,
        fieldKey: item.key,
        value: item.value,
        valueType: this.detectValueType(item.value),
        createdBy: actorId ?? null,
        updatedBy: actorId ?? null,
      }),
    );

    await repo.save(rows);
  }
}
