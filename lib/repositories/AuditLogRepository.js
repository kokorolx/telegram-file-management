import { BaseRepository } from "./BaseRepository.js";
import { AuditLog } from "../entities/AuditLog.js";

export class AuditLogRepository extends BaseRepository {
  constructor() {
    super(AuditLog);
  }

  async log(userId, action, resourceType, resourceId, details, req) {
    const ip = req?.headers?.get('x-forwarded-for') || req?.socket?.remoteAddress;
    const ua = req?.headers?.get('user-agent');

    return this.save({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ip,
      user_agent: ua,
    });
  }

  async findByUserId(userId) {
    return this.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }
}

export const auditLogRepository = new AuditLogRepository();
