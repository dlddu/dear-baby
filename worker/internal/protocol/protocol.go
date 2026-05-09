// Package protocol defines the wire format the backend uses to enqueue
// jobs onto Redis and the per-user channels the worker publishes results
// on. Producer and consumer share these constants and types so a schema
// change has exactly one place to land.
package protocol

import (
	"encoding/json"
	"errors"
	"fmt"
)

// QueueKey is the single Redis LIST that the backend pushes jobs onto.
// The framework BRPOPs on this key, dispatches by `type`, and publishes
// results on task-specific pub/sub channels.
const QueueKey = "tasks:queue"

// ProtocolVersion is bumped whenever the envelope shape changes in a
// non-backwards-compatible way. Workers that see a foreign version reject
// the message rather than silently mis-parsing it.
const ProtocolVersion = 1

// ResultChannel returns the pub/sub channel for a task's per-user result
// stream. The backend's SSE hub subscribes to `tasks:result:*` and
// fan-outs to connected clients.
func ResultChannel(taskType, userID string) string {
	return fmt.Sprintf("tasks:result:%s:%s", taskType, userID)
}

// Envelope is the outer JSON wrapper every job rides on. The Payload is
// kept as raw bytes so each task validates its own shape.
type Envelope struct {
	Type     string          `json:"type"`
	Payload  json.RawMessage `json:"payload"`
	JobID    string          `json:"job_id"`
	IssuedAt string          `json:"issued_at"`
	V        int             `json:"v"`
}

// ParseEnvelope unmarshals and validates the framing fields. Payload
// validation is the task's job — keep this fast and shape-only.
func ParseEnvelope(raw []byte) (Envelope, error) {
	var env Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return Envelope{}, fmt.Errorf("envelope unmarshal: %w", err)
	}
	if env.Type == "" {
		return Envelope{}, errors.New("envelope: type is empty")
	}
	if env.JobID == "" {
		return Envelope{}, errors.New("envelope: job_id is empty")
	}
	if env.IssuedAt == "" {
		return Envelope{}, errors.New("envelope: issued_at is empty")
	}
	if env.V != ProtocolVersion {
		return Envelope{}, fmt.Errorf("envelope: unsupported protocol version %d", env.V)
	}
	return env, nil
}

// ResultOK is the success shape published on the result channel. Tasks
// may attach optional fields; `preview` is the only one the SSE hub
// currently fans out.
type ResultOK struct {
	Status  string `json:"status"`
	Preview string `json:"preview,omitempty"`
}

// NewResultOK builds an ok result with `status` already filled in so
// callers don't accidentally publish the wrong literal.
func NewResultOK() ResultOK { return ResultOK{Status: "ok"} }
