# Wallet Backend - Environment Variables Setup

## Generated Secrets (Use these):
```
JWT_SECRET=7a8a1cc72489ee600a1ac9e5ac678b83ba9db98b895c4f0f9c1f40c9e45421f3
ENCRYPTION_KEY=9e816fd9cd49235a9563fc8cec6c53ee
JWT_EXPIRES_IN=7d
PORT=4000
NODE_ENV=production
```

## Variables to Set (via MCP after service creation):

### wallet-backend service:
1. DATABASE_URL - (from wallet-db or taskforce-db)
2. REDIS_URL - (from taskforce-redis: redis://default:JKLzDgwnuFbBnBvOXCHYeFFjNOyduAzQ@taskforce-redis.railway.internal:6379)
3. PORT=4000
4. NODE_ENV=production
5. JWT_SECRET=7a8a1cc72489ee600a1ac9e5ac678b83ba9db98b895c4f0f9c1f40c9e45421f3
6. JWT_EXPIRES_IN=7d
7. ENCRYPTION_KEY=9e816fd9cd49235a9563fc8cec6c53ee
8. CORS_ORIGIN=<wallet-frontend-url> (set after frontend deployed)

### wallet-frontend service:
1. NEXT_PUBLIC_API_URL=<wallet-backend-url> (set after backend deployed)

## Code Verification:
✅ All services implemented
✅ All routes implemented
✅ Redis caching integrated
✅ Payment processing complete
✅ Wallet management complete
✅ Exchange rate service complete
✅ Authentication complete

