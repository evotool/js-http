import { BeforeInsert, Column, PrimaryGeneratedColumn } from 'typeorm';

export class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: ObjectId;

  @Column('timestamp', { default: () => 'LOCALTIMESTAMP' })
  createdAt!: Date;

  @Column('timestamp', { default: () => 'LOCALTIMESTAMP' })
  updatedAt!: Date;

  @BeforeInsert()
  $setCreatedAndUpdatedAt(): void {
    const date = new Date();

    if (!this.createdAt) {
      this.createdAt = date;
      this.updatedAt = date;
    } else if (!this.updatedAt || this.updatedAt.getTime() < this.createdAt.getTime()) {
      this.updatedAt = date;
    }
  }

  clone<M extends BaseEntity>(this: M): M {
    const constructor = this.constructor as unknown as new () => BaseEntity;

    const instance = Object.assign(new constructor(), this) as M;

    for (const key in instance) {
      if (instance.hasOwnProperty(key)) {
        const value = instance[key];

        if (value instanceof BaseEntity) {
          instance[key] = value.clone();
        } else if (isArray(value)) {
          instance[key] = value.map((v) => v instanceof BaseEntity ? v.clone() : v) as any;
        }
      }
    }

    return instance;
  }

  toJSON(): Record<string, any> {
    return this;
  }

  static create<Entity extends BaseEntity>(data: Partial<Entity>): Entity {
    const entity = new this();

    if (data.id) {
      entity.id = data.id as any;
    }

    if (data.createdAt instanceof Date) {
      entity.createdAt = data.createdAt;
      entity.updatedAt = data.updatedAt instanceof Date && +data.createdAt < +data.updatedAt ? data.updatedAt : data.createdAt;
    }

    return entity as Entity;
  }
}

export const BASE_MIGRATION_COLUMNS = [
  { name: 'id', type: 'uuid', generationStrategy: 'uuid', isGenerated: true, isPrimary: true },
  { name: 'created_at', type: 'timestamp', default: 'LOCALTIMESTAMP' },
  { name: 'updated_at', type: 'timestamp', default: 'LOCALTIMESTAMP' },
] as const;

export type DatabaseEntity<M extends BaseEntity> = { [P in keyof M as NonNullable<M[P]> extends BaseEntity ? never : M[P] extends (...args: any[]) => any ? never : P]: M[P] };
