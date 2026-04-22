package tasks

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// queueKey mirrors worker/src/protocol.ts QUEUE_KEY.
const queueKey = "tasks:queue"

// Client pushes task envelopes onto the shared Redis queue. It is the
// only write-side surface the backend needs — the worker consumes from
// the same queue via BRPOP, so ordering is FIFO per LIST push.
type Client struct {
	Redis *redis.Client
}

// envelope mirrors the shape in worker/src/protocol.ts. Keep field names
// snake_case so the wire contract stays compatible without a
// serialization translator.
type envelope struct {
	Type     string `json:"type"`
	Payload  any    `json:"payload"`
	JobID    string `json:"job_id"`
	IssuedAt string `json:"issued_at"`
	V        int    `json:"v"`
}

// Enqueue LPUSHes a new task envelope onto the queue. The worker BRPOPs
// from the tail, so LPUSH preserves issuance order.
func (c *Client) Enqueue(ctx context.Context, taskType string, payload any) error {
	env := envelope{
		Type:     taskType,
		Payload:  payload,
		JobID:    uuid.NewString(),
		IssuedAt: time.Now().UTC().Format(time.RFC3339),
		V:        1,
	}
	raw, err := json.Marshal(env)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}
	if err := c.Redis.LPush(ctx, queueKey, raw).Err(); err != nil {
		return fmt.Errorf("lpush: %w", err)
	}
	return nil
}
