package records

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/dlddu/dear-baby/backend/internal/httpx"
)

// communityFeedResponse is the GET /community/feed body: a page of masked
// feed items plus the opaque keyset cursor for the next page (empty when the
// pool is exhausted).
type communityFeedResponse struct {
	Items      []FeedItem `json:"items"`
	NextCursor string     `json:"next_cursor"`
}

// CommunityFeed handles GET
// /v1/community/feed?subject_id=…&type=…&cursor=…&limit=….
//
// subject_id is REQUIRED and must be one of the caller's own subjects: its
// kind selects the exposure pool (임신 case → 'fetus' records, 육아 case →
// 'child' records; ENG-008 no case mixing), and PRD-009 AC-009-03 auto-picks
// it from the active child on the client. Passing another user's subject_id
// is rejected as 400 — collapsed with "unknown subject" so the API never
// leaks whether a subject exists for someone else.
//
// type is the AC-009-06 콘텐츠 타입 필터 — `all` (default, 전체) /
// `question` (질문답변) / `diary` (자유일기). Omitting it reproduces the
// pre-filter response exactly. An unrecognised value is a 400 rather than a
// silent fallback to 전체, so a client typo can't masquerade as a working
// filter.
//
// The feed is public records by other users (AC-009-01, ENG-010),
// newest-first (ENG-007), keyset-paginated (ENG-009), with author names
// masked (AC-009-10). No writes happen here — likes, comments, reports and
// the same-question collection are separate slices.
func (h *Handlers) CommunityFeed(w http.ResponseWriter, r *http.Request) {
	uid, ok := h.UserIDFromCtxFn(r)
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	q := r.URL.Query()
	subjectID := strings.TrimSpace(q.Get("subject_id"))
	if subjectID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "subject_id is required")
		return
	}

	limit := defaultFeedLimit
	if l := strings.TrimSpace(q.Get("limit")); l != "" {
		n, err := strconv.Atoi(l)
		if err != nil || n <= 0 {
			httpx.WriteError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		if n > maxFeedLimit {
			n = maxFeedLimit
		}
		limit = n
	}
	contentType, ok := ParseFeedContentType(strings.TrimSpace(q.Get("type")))
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "invalid type")
		return
	}
	cursor := strings.TrimSpace(q.Get("cursor"))

	kind, err := h.Store.SubjectKindForUser(r.Context(), uid, subjectID)
	if err != nil {
		if errors.Is(err, ErrInvalidSubject) {
			httpx.WriteError(w, http.StatusBadRequest, "invalid subject_id")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}

	items, next, err := h.Store.CommunityFeed(r.Context(), uid, kind, contentType, cursor, limit)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "internal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, communityFeedResponse{Items: items, NextCursor: next})
}
