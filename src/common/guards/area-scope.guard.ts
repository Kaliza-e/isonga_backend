import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { CHECK_AREA_SCOPE_KEY, AreaScopeOptions } from '../decorators/check-area-scope.decorator';
import { AreasService } from '../../modules/areas/areas.service';

@Injectable()
export class AreaScopeGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private areasService: AreasService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scopeOptions = this.reflector.getAllAndOverride<AreaScopeOptions>(
      CHECK_AREA_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!scopeOptions) {
      return true; // No geographic restriction defined on this handler
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context required for geographical scope verification.');
    }

    // Super Admin has national scope
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Extract target areaId from request
    const targetAreaId = request[scopeOptions.source]?.[scopeOptions.field];
    if (!targetAreaId) {
      // If no area was targeted in request, allow or deny based on presence
      return true;
    }

    // Admin must have permissions loaded
    const adminPermissions = user.adminPermissions || [];
    if (adminPermissions.length === 0) {
      throw new ForbiddenException(
        'You have no assigned administrative areas. Access denied.',
      );
    }

    // Check if targetAreaId is within any of the admin's assigned areas
    for (const permission of adminPermissions) {
      const isAuthorized = await this.areasService.isWithinScope(
        permission.areaId,
        targetAreaId,
      );
      if (isAuthorized) {
        return true;
      }
    }

    throw new ForbiddenException(
      'Geographical scope violation: You do not possess administrative authority over the requested area.',
    );
  }
}

