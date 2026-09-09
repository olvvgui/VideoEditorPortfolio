import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { ThrottlerLimitDetail } from "@nestjs/throttler/dist/throttler.guard.interface";
@Injectable()
export class RateGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse();
    // Nest's named policies otherwise emit only Retry-After-<name>.
    response.setHeader("Retry-After", Math.max(1, detail.timeToBlockExpire));
    response.setHeader("X-RateLimit-Limit", detail.limit);
    response.setHeader("X-RateLimit-Remaining", 0);
    response.setHeader("X-RateLimit-Reset", detail.timeToBlockExpire);
    return super.throwThrottlingException(context, detail);
  }
}
