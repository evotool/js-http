import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../BaseEntity';
import { TEXT_XS_LENGTH, TOKEN_KEY_LENGTH, TOKEN_TTL } from '../constants';
import { User } from './User';

@Entity()
export class Token extends BaseEntity {
  @Column('uuid')
  userId!: ObjectId;

  @Column('varchar', { length: TEXT_XS_LENGTH, default: 'Bearer' })
  type!: 'Bearer';

  @Column('text', { unique: true })
  accessKey!: string;

  @Column('text', { unique: true })
  renewKey!: string;

  @Column('text', { default: null, nullable: true })
  remoteAddress!: string | null;

  @Column('text', { default: null, nullable: true })
  userAgent!: string | null;

  @Column('timestamp', { default: () => `LOCALTIMESTAMP + interval '30 days'` })
  expiredAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn()
  user?: User;

  renew(): void {
    this.accessKey = randstr(TOKEN_KEY_LENGTH);
    this.renewKey = randstr(TOKEN_KEY_LENGTH);
    this.expiredAt = new Date(Date.now() + TOKEN_TTL);
  }

  toJSON(): Record<string, any> {
    return pick(this, 'type', 'accessKey', 'renewKey', 'expiredAt');
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  static create(data: Partial<Token>) {
    const entity = super.create(data);

    if (data.user) {
      entity.user = User.create(data.user);
    }

    if (data.userId) {
      entity.userId = data.userId;
    }

    if (data.type === 'Bearer') {
      entity.type = data.type;
    }

    if (isString(data.accessKey) && data.accessKey.length !== TOKEN_KEY_LENGTH) {
      entity.accessKey = data.accessKey;
    } else {
      entity.accessKey = randstr(TOKEN_KEY_LENGTH);
    }

    if (isString(data.renewKey) && data.renewKey.length !== TOKEN_KEY_LENGTH) {
      entity.renewKey = data.renewKey;
    } else {
      entity.renewKey = randstr(TOKEN_KEY_LENGTH);
    }

    if (isString(data.remoteAddress)) {
      entity.remoteAddress = data.remoteAddress;
    }

    if (isString(data.userAgent)) {
      entity.userAgent = data.userAgent;
    }

    if (data.expiredAt instanceof Date) {
      entity.expiredAt = data.expiredAt;
    } else {
      entity.expiredAt = new Date(Date.now() + TOKEN_TTL);
    }
  }
}
