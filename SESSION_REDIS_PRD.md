# Redis Session Management - PRD & Implementation Plan

## Product Requirements Document (PRD)

### 1. Overview

Implement centralized session management using Redis to support stateless load-balanced architecture across multiple Vercel deployments. Users will maintain persistent sessions regardless of which Vercel instance handles their request.

### 2. Goals

- **High Availability**: Session persists across server failover
- **Stateless Instances**: Each Vercel instance is replaceable
- **Fast Session Lookup**: Redis provides <1ms session access
- **Scalability**: Support unlimited concurrent users
- **Security**: Sessions encrypted, secure cookies, HTTPS-only

### 3. Requirements

#### Functional Requirements

**FR1: Session Creation**
- User logs in → Session created in Redis
- Session ID stored in HTTP-only cookie
- Session expires after 7 days of last activity
- Session contains: userId, loginTime, permissions, metadata

**FR2: Session Persistence**
- Session survives Vercel instance restart
- Session survives load balancer failover
- Session data consistent across all instances
- Session updates atomic (no race conditions)

**FR3: Session Validation**
- Every request validates session from Redis
- Invalid/expired sessions rejected
- User redirected to login on session loss
- Clear error messages for expired sessions

**FR4: Session Revocation**
- Logout immediately revokes session
- Admin can revoke user sessions remotely
- Revoked sessions can't be re-used

**FR5: Session Security**
- Cookies HTTP-only (not accessible to JS)
- Secure flag (HTTPS-only)
- SameSite: Lax (CSRF protection)
- Session ID cryptographically random
- No sensitive data in cookie (only ID)
- All session data in Redis (secure backend)

#### Non-Functional Requirements

**NFR1: Performance**
- Session lookup: <10ms
- Session creation: <50ms
- Logout: <20ms
- 99.9% availability

**NFR2: Data Retention**
- Active sessions: 7 days TTL
- Inactive sessions: Auto-delete after TTL
- Logout: Immediate deletion
- No persistent storage of sessions

**NFR3: Scalability**
- Support 10,000+ concurrent sessions
- Linear scaling with Redis instance size
- No session replication needed (Redis handles)

### 4. Architecture

```
Browser
   ↓ (with session cookie)
Nginx (port 80)
   ↓ round-robin
┌──────────────────────┐
│ Vercel Instance 1    │
│ - Receives request   │
│ - Reads cookie ID    │
│ - Checks Redis       │
└──────────────────────┘
         ↓
    ┌────────────┐
    │   Redis    │ ← Single source of truth for all sessions
    └────────────┘
         ↑
┌──────────────────────┐
│ Vercel Instance 2    │
│ - Receives request   │
│ - Reads cookie ID    │
│ - Checks Redis       │
└──────────────────────┘
```

### 5. Data Model

**Session Object in Redis**

```
Key: session:{randomId}
Value: {
  userId: "user123",
  email: "user@example.com",
  loginTime: 1702549200,
  lastActivity: 1702635600,
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  permissions: ["read", "write", "upload"],
  metadata: {
    loginMethod: "email", // or "oauth"
    source: "web", // or "mobile"
    country: "US"
  }
}

TTL: 604800 seconds (7 days)
```

**Redis Storage Strategy**

- Key namespace: `session:{sessionId}`
- Pattern matching: `session:*` for bulk operations
- Index: Optional secondary index for user → sessionIds (for multi-session tracking)

### 6. Session Lifecycle

```
1. LOGIN
   User submits credentials
   ↓
   Validate credentials against database
   ↓
   Generate random sessionId (32+ bytes)
   ↓
   Store session object in Redis with 7-day TTL
   ↓
   Set HTTP-only cookie: sessionId={sessionId}
   ↓
   Return success

2. REQUEST (with session)
   User makes request
   ↓
   Nginx routes to Vercel instance
   ↓
   Middleware extracts sessionId from cookie
   ↓
   Query Redis: session:{sessionId}
   ↓
   If found: Update lastActivity timestamp, continue
   ↓
   If not found: Reject, redirect to login
   ↓
   Continue to handler with user context

3. LOGOUT
   User clicks logout
   ↓
   Delete session:{sessionId} from Redis
   ↓
   Clear cookie on client
   ↓
   Redirect to login page

4. EXPIRY (automatic)
   Redis TTL timer expires
   ↓
   Redis auto-deletes session:{sessionId}
   ↓
   Next request: session not found, user redirected to login
```

### 7. Security Considerations

| Aspect | Implementation |
|--------|----------------|
| Session ID | Cryptographically random (32+ bytes hex) |
| Cookie Storage | HTTP-only, Secure, SameSite=Lax |
| Transport | HTTPS only (Nginx enforces) |
| Data Encryption | Redis in-transit encryption (TLS) |
| Data at Rest | Redis persistence (RDB/AOF) encrypted by provider |
| Session Fixation | New sessionId on each login |
| CSRF | SameSite cookie + token on state-changing operations |
| XSS Protection | HTTPOnly cookies prevent JS access |
| Brute Force | Rate limit login attempts (separate from sessions) |

### 8. Dependencies

**External Services:**
- Redis instance (Upstash, Redis Cloud, or self-hosted)
- HTTPS certificate (Let's Encrypt via Nginx)

**Libraries:**
- `express-session` - Session middleware
- `connect-redis` - Redis session store
- `redis` - Redis client
- `uuid` - Session ID generation
- `crypto` - Cryptographic operations

**Environment Variables:**
```
REDIS_URL=redis://user:password@host:port
SESSION_SECRET=<random-32-char-string>
SESSION_TIMEOUT=604800 (7 days in seconds)
COOKIE_DOMAIN=files.thnkandgrow.com
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=lax
```

### 9. Monitoring & Observability

**Metrics to Track:**
- Active session count: `DBSIZE` or custom counter
- Session creation rate: Events/min
- Session lookup latency: p50, p95, p99
- Session eviction rate: Auto-expired sessions/min
- Redis memory usage: Bytes
- Redis connection count: Active connections
- Failed session lookups: Count + alerts

**Logging:**
- Session created: userId, timestamp, source IP
- Session accessed: userId, timestamp (sample 10%)
- Session revoked: userId, reason, timestamp
- Session expired: userId, timestamp
- Session errors: All errors logged with context

**Alerts:**
- Redis connection loss → Critical
- Session lookup errors >1% → Warning
- Redis memory >80% → Warning
- High session creation rate (abuse) → Warning

### 10. Testing Strategy

**Unit Tests:**
- Session creation with valid data
- Session validation with valid/invalid IDs
- Session expiry logic
- Cookie encoding/decoding
- TTL application

**Integration Tests:**
- Full login flow
- Multi-instance session sharing (Vercel-1 → Vercel-2)
- Logout across instances
- Session expiry
- Concurrent session access
- Redis failover behavior

**Load Tests:**
- 10,000 concurrent sessions
- 100 logins/second
- Session lookup under load
- Redis memory limits

**Security Tests:**
- Session fixation prevention
- CSRF protection
- HTTPOnly cookie verification
- Secure flag enforcement
- Session ID entropy (randomness)
- Race condition testing (concurrent access)

### 11. Deployment Checklist

- [ ] Redis instance provisioned and tested
- [ ] HTTPS/TLS configured end-to-end
- [ ] Session middleware implemented
- [ ] Cookie policy configured
- [ ] Monitoring and alerting set up
- [ ] Redis backup/disaster recovery plan
- [ ] Load test passed (10k sessions)
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Team trained on session flow
- [ ] Gradual rollout to 10% → 50% → 100% users
- [ ] Fallback plan (revert to stateful if issues)

### 12. Success Criteria

✅ Sessions persist across Vercel instances
✅ Session lookup <10ms (p95)
✅ Zero data loss on Vercel restart
✅ Automatic cleanup of expired sessions
✅ 100% pass rate on security tests
✅ Load test: 10k concurrent sessions, zero failures
✅ Zero unplanned session losses in production (30-day period)
✅ User feedback: "Login stayed persistent across refreshes"

---

## Implementation Plan

### Phase 1: Infrastructure Setup (1-2 days)

**1.1 Provision Redis Instance**
- [ ] Choose provider: Upstash (cheapest free tier), Redis Cloud, or self-hosted
- [ ] Create Redis instance
- [ ] Configure: Max memory policy, persistence (RDB), eviction (allkeys-lru)
- [ ] Test connectivity from local machine
- [ ] Document connection string format

**1.2 Environment Configuration**
- [ ] Add REDIS_URL to Vercel environment variables (all 3 deployments)
- [ ] Add SESSION_SECRET to env (same across all deployments)
- [ ] Add cookie configuration env vars
- [ ] Test env vars accessible in all deployments

**1.3 HTTPS/TLS Setup**
- [ ] Generate SSL certificate (Let's Encrypt)
- [ ] Configure in Nginx
- [ ] Verify HTTPS on files.thnkandgrow.com
- [ ] Test secure cookie flag works

---

### Phase 2: Core Session Middleware (2-3 days)

**2.1 Session Middleware Module**
- [ ] Create `middleware/sessionMiddleware.js`
- [ ] Implement Redis client initialization
- [ ] Implement session ID generation (crypto)
- [ ] Implement session validation logic
- [ ] Implement TTL refresh on activity
- [ ] Error handling for Redis connection loss

**2.2 Login Endpoint**
- [ ] Create `/api/auth/login` endpoint
- [ ] Implement credential validation
- [ ] Implement session creation
- [ ] Implement cookie setting
- [ ] Implement response (redirect or JSON)
- [ ] Error handling (invalid credentials, etc)

**2.3 Logout Endpoint**
- [ ] Create `/api/auth/logout` endpoint
- [ ] Implement session deletion from Redis
- [ ] Implement cookie clearing
- [ ] Implement redirect

**2.4 Session Validation**
- [ ] Apply middleware to protected routes
- [ ] Implement `req.user` context population
- [ ] Implement unauthorized redirect
- [ ] Test across all Vercel instances

---

### Phase 3: Integration & Testing (2-3 days)

**3.1 Integrate with Existing Auth**
- [ ] Replace or wrap existing auth system
- [ ] Ensure backward compatibility (if needed)
- [ ] Update login/logout flows
- [ ] Test user profile endpoints

**3.2 Unit & Integration Tests**
- [ ] Mock Redis for unit tests
- [ ] Test session creation/validation
- [ ] Test TTL expiry
- [ ] Test multi-instance sessions (Vercel-1 → Vercel-2)
- [ ] Test error scenarios

**3.3 Security Testing**
- [ ] Verify HTTPOnly cookie flag
- [ ] Verify Secure flag (HTTPS)
- [ ] Verify SameSite flag
- [ ] Test session fixation prevention
- [ ] Test session ID entropy
- [ ] Penetration test: Can attacker forge session?

**3.4 Load Testing**
- [ ] Simulate 1000 concurrent logins
- [ ] Simulate 10,000 concurrent sessions
- [ ] Measure Redis memory usage
- [ ] Verify zero session loss
- [ ] Measure p50, p95, p99 latency

---

### Phase 4: Monitoring & Deployment (1-2 days)

**4.1 Monitoring Setup**
- [ ] Configure Redis metrics export
- [ ] Set up CloudWatch/DataDog dashboards
- [ ] Implement alerting rules
- [ ] Create runbook for Redis issues
- [ ] Implement session count tracking

**4.2 Logging**
- [ ] Log session creation (userId, IP, timestamp)
- [ ] Log session validation (sample 10%)
- [ ] Log logout (userId, timestamp)
- [ ] Log errors (with stack trace)
- [ ] Route logs to centralized store (CloudWatch/ELK)

**4.3 Documentation**
- [ ] Session flow diagram
- [ ] Troubleshooting guide
- [ ] API endpoint docs
- [ ] Environment config docs
- [ ] Disaster recovery plan

**4.4 Gradual Rollout**
- [ ] Deploy to 1 Vercel instance (test)
- [ ] Monitor for 24 hours
- [ ] Deploy to 2nd instance (50% traffic)
- [ ] Monitor for 24 hours
- [ ] Deploy to 3rd instance (100% traffic)
- [ ] Monitor for 7 days

---

### Phase 5: Post-Deployment (Ongoing)

**5.1 Monitoring Dashboard**
- [ ] Active sessions over time
- [ ] Login/logout rate
- [ ] Session lookup latency (p50, p95, p99)
- [ ] Redis memory usage
- [ ] Failed authentications
- [ ] Session creation errors

**5.2 Maintenance**
- [ ] Weekly: Check Redis health
- [ ] Monthly: Review session logs for anomalies
- [ ] Quarterly: Audit session security
- [ ] Backup Redis data (automate)

**5.3 Optimization**
- [ ] Monitor Redis memory after 1 month
- [ ] Analyze slowlog for slow operations
- [ ] Profile session lookup latency
- [ ] Identify hot sessions for optimization

---

### Timeline Summary

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Infrastructure | 1-2 days | Day 1 | Day 2 |
| Core Middleware | 2-3 days | Day 3 | Day 5 |
| Integration & Testing | 2-3 days | Day 6 | Day 8 |
| Monitoring & Deployment | 1-2 days | Day 9 | Day 10 |
| **Total** | **7-10 days** | | |

Post-deployment monitoring: Ongoing

---

### Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Redis connection loss | Medium | Critical | Connection pooling, retry logic, fallback |
| Session data loss | Low | High | Redis persistence (RDB), backup strategy |
| Performance degradation | Low | Medium | Load testing, monitoring, optimization |
| Security breach (session hijacking) | Low | Critical | HTTPOnly cookies, HTTPS, IP validation |
| Scaling issues (10k+ sessions) | Low | Medium | Redis cluster, pre-planning |
| Deployment bug causes logout loop | Medium | High | Gradual rollout, quick rollback plan |

---

### Rollback Plan

If critical issues discovered post-deployment:
1. Immediate: Rollback Vercel deployments to previous version
2. Sessions lost: Users re-login (acceptable for brief period)
3. Root cause analysis: Debug logs, Redis state
4. Fix and re-deploy
5. Post-mortem: Document lessons learned

---

### Success Metrics (Post-Launch)

After 30 days in production:
- ✅ Zero unplanned session losses
- ✅ P95 session lookup: <10ms
- ✅ Redis uptime: 99.9%
- ✅ User feedback: No session-related complaints
- ✅ Load test: 10k concurrent, zero failures
- ✅ Memory usage: <500MB (adjust based on session count)

