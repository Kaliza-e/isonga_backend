import { SetMetadata } from '@nestjs/common';

export const CHECK_AREA_SCOPE_KEY = 'checkAreaScope';

export interface AreaScopeOptions {
  source: 'params' | 'body' | 'query';
  field: string;
}

export const CheckAreaScope = (options: AreaScopeOptions = { source: 'body', field: 'areaId' }) =>
  SetMetadata(CHECK_AREA_SCOPE_KEY, options);

