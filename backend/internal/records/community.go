package records

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// defaultFeedLimit / maxFeedLimit cap the community feed page size. 20 is the
// page size ENG-009 (커뮤니티 피드 페이지네이션) specifies for the infinite
// scroll; 100 is the upper bound so a pathological cursor request can't pull
// the whole pool at once. Kept separate from the diary list constants so the
// two surfaces can tune independently.
const (
	defaultFeedLimit = 20
	maxFeedLimit     = 100
)

// feedPreviewRunes caps the content preview shown on a community feed card.
// PRD-009 AC-009-14 describes a "~50자 미리보기"; the full body is only ever
// sent from the (future) community detail endpoint, so the list stays light
// and no full text leaks before a reader opens a post.
const feedPreviewRunes = 50

// FeedItem is one row of the community feed. It is deliberately a projection
// of a record — never the raw Record — so the author's identity is masked
// (AC-009-10) and only the public-safe fields cross the wire. The community
// carries no photos (records hold audio, not images) so the projection is
// text-only by construction, matching the ENG-008 노출 풀 contract.
//
// Like / comment counts are intentionally absent from this first slice: the
// likes and comments tables do not exist yet, so surfacing a count would be
// a lie. They arrive with the like / comment mutation slices.
type FeedItem struct {
	ID           string    `json:"id"`
	AuthorName   string    `json:"author_name"`
	SubjectKind  string    `json:"subject_kind"`
	Source       Source    `json:"source"`
	QuestionText *string   `json:"question_text"`
	Preview      string    `json:"preview"`
	CreatedAt    time.Time `json:"created_at"`
}

// maskDisplayName derives the community display name from an account email
// per PRD-009 AC-009-10: take the local-part (before '@'); when it is 5 or
// more characters show the first 3, then "***", then the last 1 ("seoul1"
// -> "seo***1"); when it is 4 or fewer show the first 1 then "***" ("mom"
// -> "m***"). The real name, child name, dates and the full email are never
// exposed. A pathological empty local-part collapses to "***".
func maskDisplayName(email string) string {
	local := email
	if i := strings.IndexByte(email, '@'); i >= 0 {
		local = email[:i]
	}
	runes := []rune(local)
	switch {
	case len(runes) == 0:
		return "***"
	case len(runes) <= 4:
		return string(runes[:1]) + "***"
	default:
		return string(runes[:3]) + "***" + string(runes[len(runes)-1:])
	}
}

// previewOf truncates content to feedPreviewRunes runes, appending an
// ellipsis when it had to cut. Rune-aware so multibyte Korean text is never
// split mid-character.
func previewOf(content string) string {
	if utf8.RuneCountInString(content) <= feedPreviewRunes {
		return content
	}
	runes := []rune(content)
	return string(runes[:feedPreviewRunes]) + "…"
}

// SubjectKindForUser returns the kind ('fetus' | 'child') of a
// record_subjects row, but only when it belongs to userID. A missing subject
// and a cross-user subject both collapse to ErrInvalidSubject so the API
// never leaks whether a subject exists for another user.
func (s *Store) SubjectKindForUser(ctx context.Context, userID, subjectID string) (string, error) {
	var (
		kind  string
		owner string
	)
	err := s.DB.QueryRowContext(ctx, `
		SELECT kind, user_id FROM record_subjects WHERE id = ?
	`, subjectID).Scan(&kind, &owner)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && owner != userID) {
		return "", ErrInvalidSubject
	}
	if err != nil {
		return "", fmt.Errorf("lookup subject kind: %w", err)
	}
	return kind, nil
}

// CommunityFeed returns the public community feed for a viewer, newest-first.
//
// Exposure pool (ENG-008 노출 풀): only records with visibility='public',
// authored by SOMEONE ELSE (ENG-010 excludes the viewer's own records — those
// surface in "같은 질문" instead), whose subject kind matches the viewer's
// active subject kind (임신 case reads 'fetus' records, 육아 case reads
// 'child' records — no case mixing). viewerKind is derived by the handler
// from the caller's active subject_id.
//
// Order (ENG-007 기본 정렬): creation time descending, id descending as a
// stable tiebreaker. Similarity-stage weighting (ENG-011) is a later slice;
// this slice ships the recency base sort that weighting sits on top of.
//
// Pagination (ENG-009 페이지네이션): keyset on created_at — the identical
// scheme ListForUser uses — so records appended at the head don't drift
// pages. cursor is the created_at of the last item on the prior page; empty
// starts at the head. limit is clamped 1..maxFeedLimit, defaulting to
// defaultFeedLimit.
//
// Returns the page and the next cursor (empty when the page wasn't full).
func (s *Store) CommunityFeed(ctx context.Context, viewerUserID, viewerKind, cursor string, limit int) ([]FeedItem, string, error) {
	if limit <= 0 || limit > maxFeedLimit {
		limit = defaultFeedLimit
	}

	args := []any{viewerKind, viewerUserID}
	clauses := []string{
		"r.visibility = 'public'",
		"rs.kind = ?",
		"r.user_id != ?",
	}
	if cursor != "" {
		clauses = append(clauses, "r.created_at < ?")
		args = append(args, cursor)
	}
	// Fetch limit+1 so we can tell whether a next page exists without a
	// follow-up COUNT — same trick as ListForUser.
	args = append(args, limit+1)

	q := `
		SELECT r.id, u.email, rs.kind, r.source, r.content, r.question_text, r.created_at
		FROM records r
		JOIN record_subjects rs ON rs.id = r.subject_id
		JOIN users u ON u.id = r.user_id
		WHERE ` + strings.Join(clauses, " AND ") + `
		ORDER BY r.created_at DESC, r.id DESC
		LIMIT ?
	`
	rows, err := s.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, "", fmt.Errorf("community feed: %w", err)
	}
	defer rows.Close()

	out := make([]FeedItem, 0, limit)
	var lastCreatedAtRaw string
	for rows.Next() {
		var (
			item         FeedItem
			email        string
			content      string
			questionText sql.NullString
			createdAt    string
		)
		if err := rows.Scan(&item.ID, &email, &item.SubjectKind, (*string)(&item.Source), &content, &questionText, &createdAt); err != nil {
			return nil, "", fmt.Errorf("scan feed item: %w", err)
		}
		item.AuthorName = maskDisplayName(email)
		item.Preview = previewOf(content)
		if questionText.Valid {
			v := questionText.String
			item.QuestionText = &v
		}
		if t, err := time.Parse(sqliteTimeLayout, createdAt); err == nil {
			item.CreatedAt = t
		}
		if len(out) < limit {
			out = append(out, item)
			lastCreatedAtRaw = createdAt
		}
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("iterate feed: %w", err)
	}

	nextCursor := ""
	if len(out) == limit {
		nextCursor = lastCreatedAtRaw
	}
	return out, nextCursor, nil
}
