package onboarding

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/dlddu/dear-baby/backend/internal/tasks"
)

// maxAIPreviewAttempts bounds how many times a transient LLM failure is
// retried automatically before the error is surfaced to the UI. Chosen
// so that three quick attempts (cumulative wait ≈ 3.5s) still fit well
// inside the SSE client's tolerance.
const maxAIPreviewAttempts = 3

// aiPreviewRetryBackoff returns the delay before re-enqueuing after the
// given (just-failed) attempt. Exponential: 500ms, 1s, 2s... — capped
// well below the SSE client timeout so the UI never sees a noticeable
// stall from an internal retry.
func aiPreviewRetryBackoff(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	d := 500 * time.Millisecond
	for i := 1; i < attempt; i++ {
		d *= 2
	}
	return d
}

// workerResult mirrors the JSON published by the worker on the
// tasks:result:ai_preview:{user_id} channel. Drift here surfaces as a
// processor error and a dropped fanout.
type workerResult struct {
	Status  string `json:"status"`
	Preview string `json:"preview,omitempty"`
	Error   string `json:"error,omitempty"`
	// Attempt is echoed by the worker from the enqueued payload. Zero
	// means "unknown" — treated as attempt 1 for retry math.
	Attempt int `json:"attempt,omitempty"`
}

// AIPreviewProcessor returns a tasks.ResultProcessor that persists a
// successful preview before fanout and auto-retries transient failures
// up to maxAIPreviewAttempts. Only after the cap is hit does the UI see
// a final error event (so the user can kick off a manual retry).
func AIPreviewProcessor(store *Store, client *tasks.Client, logger *slog.Logger) tasks.ResultProcessor {
	return func(ctx context.Context, userID, payload string) (bool, error) {
		var msg workerResult
		if err := json.Unmarshal([]byte(payload), &msg); err != nil {
			return false, fmt.Errorf("parse worker payload: %w", err)
		}

		switch msg.Status {
		case "ok":
			if msg.Preview == "" {
				return false, errors.New("ok result without preview text")
			}
			if err := store.UpdateAIPreview(ctx, userID, msg.Preview); err != nil {
				return false, fmt.Errorf("persist preview: %w", err)
			}
			return true, nil

		case "error":
			attempt := msg.Attempt
			if attempt < 1 {
				attempt = 1
			}
			if attempt >= maxAIPreviewAttempts {
				if logger != nil {
					logger.Info("ai preview retry cap reached; surfacing error",
						"user_id", userID, "attempt", attempt, "err", msg.Error)
				}
				return true, nil
			}
			// Schedule the retry off the hub goroutine so we don't block
			// other inbound results. The hub's runCtx is propagated here,
			// so shutdown cancels any pending sleep.
			next := attempt + 1
			backoff := aiPreviewRetryBackoff(attempt)
			scheduleAIPreviewRetry(ctx, store, client, logger, userID, next, backoff)
			return false, nil

		default:
			return false, fmt.Errorf("unknown worker status: %q", msg.Status)
		}
	}
}

// scheduleAIPreviewRetry re-reads the oldest record for the user and
// LPUSHes a fresh envelope after the backoff. Re-reading avoids cross-
// process state: we don't hang on to the original content string, so a
// (hypothetical) content edit between attempts would be picked up.
func scheduleAIPreviewRetry(
	ctx context.Context,
	store *Store,
	client *tasks.Client,
	logger *slog.Logger,
	userID string,
	attempt int,
	backoff time.Duration,
) {
	go func() {
		select {
		case <-time.After(backoff):
		case <-ctx.Done():
			return
		}

		recordID, content, err := store.GetOldestRecord(ctx, userID)
		if err != nil {
			if logger != nil {
				logger.Error("ai preview retry: lookup record failed",
					"user_id", userID, "attempt", attempt, "err", err)
			}
			return
		}
		if err := client.Enqueue(ctx, "ai_preview", aiPreviewEnqueuePayload{
			UserID:   userID,
			RecordID: recordID,
			Content:  content,
			Attempt:  attempt,
		}); err != nil {
			if logger != nil {
				logger.Error("ai preview retry: enqueue failed",
					"user_id", userID, "attempt", attempt, "err", err)
			}
			return
		}
		if logger != nil {
			logger.Info("ai preview retry enqueued",
				"user_id", userID, "attempt", attempt)
		}
	}()
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
			Attempt:  1,
		}); err != nil {
			if logger != nil {
				logger.Error("sync ai preview enqueue failed", "user_id", r.UserID, "err", err)
			}
		}
	}
}
