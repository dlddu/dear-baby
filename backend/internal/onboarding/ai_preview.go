package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/dlddu/dear-baby/backend/internal/tasks"
)

// workerResult mirrors the JSON published by the worker on the
// tasks:result:ai_preview:{user_id} channel. Drift here surfaces as a
// processor error and a dropped fanout.
type workerResult struct {
	Status  string `json:"status"`
	Preview string `json:"preview,omitempty"`
	Error   string `json:"error,omitempty"`
}

// AIPreviewProcessor persists a successful preview before the hub fans
// it out to SSE subscribers. Error-status results fall through to
// fanout without a DB write — the UI surfaces them and the next retry
// re-runs the job.
func AIPreviewProcessor(store *Store) tasks.ResultProcessor {
	return func(ctx context.Context, userID, payload string) error {
		var msg workerResult
		if err := json.Unmarshal([]byte(payload), &msg); err != nil {
			return fmt.Errorf("parse worker payload: %w", err)
		}
		if msg.Status != "ok" {
			return nil
		}
		if msg.Preview == "" {
			return errors.New("ok result without preview text")
		}
		if err := store.UpdateAIPreview(ctx, userID, msg.Preview); err != nil {
			return fmt.Errorf("persist preview: %w", err)
		}
		return nil
	}
}

// SyncPendingAIPreviews re-enqueues every user whose first record is
// stamped but whose ai_preview is still null. Runs at backend boot so
// jobs lost across a Redis restart (or jobs enqueued while the worker
// was absent) are replayed without the worker needing to know anything
// about backend state.
func SyncPendingAIPreviews(ctx context.Context, store *Store, client *tasks.Client, logger *slog.Logger) {
	rows, err := store.ListPendingAIPreviews(ctx, 100)
	if err != nil {
		if logger != nil {
			logger.Error("sync pending ai previews: list failed", "err", err)
		}
		return
	}
	if len(rows) == 0 {
		return
	}
	if logger != nil {
		logger.Info("replaying pending ai previews", "count", len(rows))
	}
	for _, r := range rows {
		if err := client.Enqueue(ctx, "ai_preview", aiPreviewEnqueuePayload{
			UserID:   r.UserID,
			RecordID: r.RecordID,
			Content:  r.Content,
		}); err != nil {
			if logger != nil {
				logger.Error("sync ai preview enqueue failed", "user_id", r.UserID, "err", err)
			}
		}
	}
}
