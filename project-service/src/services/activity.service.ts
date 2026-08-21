import { redis, redisSubscriber } from "../config/redis.js";
import { deletePod, deleteService } from "./kubernetes.service.js";

// ==========================================
// Constants & Configuration
// ==========================================

// Prefix for Redis keys tracking active preview sessions
const ACTIVITY_KEY_PREFIX = "preview:active:";

// Prefix for distributed lock keys to prevent duplicate teardowns of the same preview
const REAP_LOCK_PREFIX = "preview:reaping:";

// Redis Pub/Sub channel to broadcast preview activity/heartbeat events
const ACTIVITY_CHANNEL = "preview:activity:";

// Redis Pub/Sub channel to broadcast when a preview has been torn down/reaped
const REAPED_CHANNEL = "preview:reaped";

// Time (in milliseconds) of inactivity before a preview is considered idle and expired (Default: 10 minutes)
const IDLE_TTL_MS = Number(process.env.PREVIEW_IDLE_TTL_MS || 10 * 60 * 1000);

// List of callback handlers registered to run when a preview is reaped
const reapedHandler: Array<(uniqueId: string) => void> = [];

// ==========================================
// Service Functions
// ==========================================

/**
 * Registers a listener/callback function that gets triggered
 * whenever a preview container is reaped (torn down due to inactivity).
 *
 * @param handler - Callback function receiving the `uniqueId` of the reaped preview
 */
export function onPreviewReaped(handler: (uniqueId: string) => void) {
  reapedHandler.push(handler);
}

/**
 * Records activity/heartbeat for a given preview session.
 * 
 * Sets an expiring key in Redis with a TTL (`IDLE_TTL_MS`). As long as user
 * activity keeps calling this function, the expiration timer resets, keeping
 * the preview environment alive. Also publishes a message to the activity channel.
 *
 * @param uniqueId - The unique identifier of the preview session
 */
export async function recordActivity(uniqueId: string) {
  const key = `${ACTIVITY_KEY_PREFIX}${uniqueId}`;
  try {
    // Atomically reset the TTL key and publish an activity event
    await redis
      .multi()
      .set(key, Date.now().toString(), "PX", IDLE_TTL_MS)
      .publish(ACTIVITY_CHANNEL, uniqueId)
      .exec();
  } catch (error) {
    console.error(`Failed to record activity for ${uniqueId}`, error);
  }
}

/**
 * Stops tracking activity for a given preview by deleting its active key from Redis.
 * 
 * Useful when a preview is explicitly stopped, closed, or manually terminated.
 *
 * @param uniqueId - The unique identifier of the preview session
 */
export async function stopTracking(uniqueId: string) {
  const key = `${ACTIVITY_KEY_PREFIX}${uniqueId}`;
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Failed to stop tracking for ${uniqueId}`, error);
  }
}

/**
 * Tears down and cleans up resources (Kubernetes Pod and Service) for an idle preview.
 *
 * Uses a Redis lock (`NX` flag with a 60-second expiration) to ensure that only
 * one instance or worker handles the teardown if multiple events fire concurrently.
 * After teardown, it publishes a notification on the `REAPED_CHANNEL`.
 *
 * @param uniqueId - The unique identifier of the preview session to tear down
 */
export async function reap(uniqueId: string) {
  const lockKey = `${REAP_LOCK_PREFIX}${uniqueId}`;
  
  // Acquire a distributed lock for 60 seconds (NX = only set if key does not exist)
  const acquired = await redis.set(lockKey, "1", "EX", 60, "NX");
  if (!acquired) {
    // Another worker is already reaping this preview
    return;
  }

  console.log(`[idle-reaper] preview ${uniqueId} is idle, tearing down`);

  try {
    // 1. Delete associated Kubernetes Service and Pod
    await deleteService(`nextjs-service-${uniqueId}`);
    await deletePod(`nextjs-pod-${uniqueId}`);
    
    // 2. Broadcast that the preview has been reaped
    await redis.publish(REAPED_CHANNEL, uniqueId);
  } catch (error) {
    console.error(`[idle-reaper] failed to tear down ${uniqueId}:`, error);
    // Release the lock on failure so a retry can be attempted if needed
    await redis.del(`${REAP_LOCK_PREFIX}${uniqueId}`);
  }
}

/**
 * Initializes and starts the idle reaper background listener.
 *
 * 1. Enables Redis Keyspace Notifications for expired events (`Ex`) if not already enabled.
 * 2. Subscribes to Redis key expiration events (`__keyevent@<db>__:expired`) and the `REAPED_CHANNEL`.
 * 3. Listens for expiring preview activity keys and automatically triggers `reap(uniqueId)`.
 * 4. Invokes all registered `onPreviewReaped` handlers when a reap event occurs.
 */
export async function startIdleReaper() {
  const db = redis.options.db ?? 0;
  const expiredChannel = `__keyevent@${db}__:expired`;

  try {
    // Check if Redis is configured to send keyspace events on expiration ('Ex')
    const [, current] = (await redis.config(
      "GET",
      "notify-keyspace-events",
    )) as [string, string];
    if (!current.includes("E") || !current.includes("x")) {
      // Enable expired keyspace events dynamically
      await redis.config("SET", "notify-keyspace-events", `${current}Ex`);
    }
  } catch (error) {
    console.warn(
      "[idle-reaper] could not enable keyspace notifications, enable 'Ex' on the server:",
      error,
    );
  }

  // Subscribe to Redis expiration events and reaped channel
  await redisSubscriber.subscribe(expiredChannel, REAPED_CHANNEL);

  redisSubscriber.on("message", (channel, message) => {
    // Case 1: An activity key has expired -> Reap the corresponding preview
    if (channel === expiredChannel && message.startsWith(ACTIVITY_KEY_PREFIX)) {
      const uniqueId = message.slice(ACTIVITY_KEY_PREFIX.length);
      void reap(uniqueId);
      return;
    }

    // Case 2: A preview was reaped -> Execute all registered callback handlers
    if (channel === REAPED_CHANNEL) {
      reapedHandler.forEach((handler) => handler(message));
    }
  });

  console.log(`[idle-reaper] listening on ${expiredChannel} (idle ttl ${IDLE_TTL_MS}ms)`);
}

