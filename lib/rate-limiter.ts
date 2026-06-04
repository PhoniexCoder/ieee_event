type SlidingWindow = { timestamps: number[]; lastAccess: number }
const stores = new Map<string, SlidingWindow>()

let cleanupTimer: ReturnType<typeof setInterval> | null = null
const CLEANUP_INTERVAL = 60_000
let maxWindowMs = 0

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    const ttl = maxWindowMs + 5000
    for (const [key, window] of stores) {
      if (now - window.lastAccess > ttl) {
        stores.delete(key)
      }
    }
    if (stores.size === 0) {
      maxWindowMs = 0
      if (cleanupTimer) {
        clearInterval(cleanupTimer)
        cleanupTimer = null
      }
    }
  }, CLEANUP_INTERVAL)
}

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  maxWindowMs = Math.max(maxWindowMs, windowMs)
  const now = Date.now()
  let window = stores.get(key)
  if (!window) {
    window = { timestamps: [], lastAccess: now }
    stores.set(key, window)
    startCleanup()
  }
  window.lastAccess = now
  const cutoff = now - windowMs
  window.timestamps = window.timestamps.filter((t) => t > cutoff)
  if (window.timestamps.length >= maxRequests) {
    return false
  }
  window.timestamps.push(now)
  return true
}

export function cleanupRateLimiter() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
  stores.clear()
  maxWindowMs = 0
}
