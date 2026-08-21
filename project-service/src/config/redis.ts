import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL);
export const redisSubscriber = new Redis(REDIS_URL);


// redis error listener
redis.on("error", (err) => {
  console.log("error from redis", err.message);
});

// redis pubsub error listener
redisSubscriber.on("error", (err) => {
  console.log("error from redis pubsub", err.message);
});

// redis ready listener
redis.once("ready", () => {
  console.log("Redis connection established");
});

// redis pubsub ready listener
redisSubscriber.once("ready", () => {
  console.log("Redis Subscriber connection established");
});