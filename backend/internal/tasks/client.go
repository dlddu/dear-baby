package tasks

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// QueueKey is the single Redis list workers BRPOP against for new tasks.
// Tasks are multiplexed through a single queue; dispatch inside the worker
// branches by `type`.
const QueueKey = "tasks:queue"

// Envelope is the payload format shared by backend and worker. `Payload` is
// left as raw JSON so the worker can decode it against the task-specific
// schema. `V` is a schema version so we can evolve the envelope safely.
type Envelope struct {
	Type     string          `json:"type"`
	JobID    string          `json:"job_id"`
	IssuedAt time.Time       `json:"issued_at"`
	Version  int             `json:"v"`
	Payload  json.RawMessage `json:"payload"`
}

// Client LPUSHes task envelopes onto the shared queue.
type Client struct {
	Redis *redis.Client
}

// Enqueue serializes the payload and pushes a new envelope onto the queue.
func (c *Client) Enqueue(ctx context.Context, taskType string, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}
	env := Envelope{
		Type:     taskType,
		JobID:    uuid.NewString(),
		IssuedAt: time.Now().UTC(),
		Version:  1,
		Payload:  raw,
	}
	body, err := json.Marshal(env)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}
	if err := c.Redis.LPush(ctx, QueueKey, body).Err(); err != nil {
		return fmt.Errorf("lpush: %w", err)
	}
	return nil
}

// ResultChannel is the Redis pub/sub channel name for a task/user pair.
// Workers PUBLISH to this channel and the backend SSE hub SUBSCRIBEs to the
// pattern `tasks:result:*` to fan results out to open SSE connections.
func ResultChannel(taskType, userID string) string {
	return "tasks:result:" + taskType + ":" + userID
}
