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

// Gestation constants for the feed card's "아이 현황" line (PRD-009
// AC-009-14 — 임신 주차 또는 생후 개월/나이). The formula is ENG-001
// (임신 주수 계산 정책): full term is 280 days, so
// daysPregnant = 280 - (due_date - <the day the record was written>), and
// the week is floor(daysPregnant / 7). ENG-011 fixes the reference point:
// the stage a record shows is the author's stage **when they wrote it**,
// never their stage today ("지금 30주차인 사용자가 20주차에 쓴 글은 20주차
// 콘텐츠"), so every calculation here anchors on records.created_at.
//
// The two caps mirror ENG-001's 경계값 table: a due date more than 5 weeks
// in the past is a stale profile the user never updated, and one more than
// 45 weeks out is beyond what the Stage 1 피커 allows. Both suppress the
// badge rather than print a nonsense week — the card simply omits the line.
const (
	gestationDays          = 280
	pregnancyPastCapDays   = 7 * 5
	pregnancyFutureCapDays = 7 * 45
)

// childMonthsAsYearsFrom is the boundary where the 양육 label switches from
// "생후 N개월" to "N살", matching the app's own header formatter
// (app/src/utils/childLabel.ts) so the same child never reads as "13개월"
// on one surface and "1살" on another.
const childMonthsAsYearsFrom = 13

// dateLayout is the YYYY-MM-DD shape onboarding stores due_date / birth_date in.
const dateLayout = "2006-01-02"

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
	ID          string `json:"id"`
	AuthorName  string `json:"author_name"`
	SubjectKind string `json:"subject_kind"`
	// ChildStatusText is the author's 아이 현황 at the time they wrote the
	// record ("임신 20주차", "생후 5개월", "2살") — the one piece of the
	// author's context AC-009-10 allows on a card. Empty when it can't be
	// derived (no due/birth date on the profile, or outside the ENG-001
	// range); the card then omits the line rather than guessing.
	ChildStatusText string    `json:"child_status_text"`
	Source          Source    `json:"source"`
	QuestionText    *string   `json:"question_text"`
	Preview         string    `json:"preview"`
	CreatedAt       time.Time `json:"created_at"`
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

// childStatusText renders the author's stage at the moment the record was
// written, per ENG-011 (기준 시점 = 작성 당시) using the ENG-001 formula.
// dueDate applies to a 'fetus' subject and birthDate to a 'child' one; the
// caller passes both straight from the LEFT JOINed profile rows, either of
// which may be NULL. An empty return means "no badge" — every branch that
// can't produce a trustworthy stage collapses to it.
func childStatusText(kind string, dueDate, birthDate sql.NullString, recordedAt time.Time) string {
	if recordedAt.IsZero() {
		return ""
	}
	day := time.Date(recordedAt.Year(), recordedAt.Month(), recordedAt.Day(), 0, 0, 0, 0, time.UTC)
	switch kind {
	case "fetus":
		if !dueDate.Valid {
			return ""
		}
		due, err := time.Parse(dateLayout, dueDate.String)
		if err != nil {
			return ""
		}
		daysUntilDue := int(due.Sub(day).Hours() / 24)
		if daysUntilDue < -pregnancyPastCapDays || daysUntilDue > pregnancyFutureCapDays {
			return ""
		}
		// A due date further out than full term would make daysPregnant
		// negative; ENG-001 clamps that to 0 instead of hiding the badge.
		daysPregnant := gestationDays - daysUntilDue
		if daysPregnant < 0 {
			daysPregnant = 0
		}
		return fmt.Sprintf("임신 %d주차", daysPregnant/7)
	case "child":
		if !birthDate.Valid {
			return ""
		}
		birth, err := time.Parse(dateLayout, birthDate.String)
		if err != nil {
			return ""
		}
		months := monthsBetween(birth, day)
		if months < 0 {
			// Birth date in the future relative to the record — a typo, not
			// a stage we can name.
			return ""
		}
		if months < childMonthsAsYearsFrom {
			return fmt.Sprintf("생후 %d개월", months)
		}
		return fmt.Sprintf("%d살", months/12)
	default:
		return ""
	}
}

// monthsBetween counts whole calendar months from birth to day, dropping the
// last one when the day-of-month hasn't come around yet. Mirrors the app's
// childLabel.monthsBetween so both surfaces age a child identically.
func monthsBetween(birth, day time.Time) int {
	months := (day.Year()-birth.Year())*12 + int(day.Month()) - int(birth.Month())
	if day.Day() < birth.Day() {
		months--
	}
	return months
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
		SELECT r.id, u.email, rs.kind, r.source, r.content, r.question_text, r.created_at,
		       f.due_date, c.birth_date
		FROM records r
		JOIN record_subjects rs ON rs.id = r.subject_id
		JOIN users u ON u.id = r.user_id
		-- fetuses.id / children.id were made equal to record_subjects.id by
		-- migration 0012, and onboarding keeps inserting them that way, so the
		-- author's due_date / birth_date hang off the subject with no extra
		-- lookup. LEFT so a subject whose profile row is missing still shows
		-- the record (with an empty 아이 현황) instead of vanishing.
		LEFT JOIN fetuses f  ON f.id = rs.id
		LEFT JOIN children c ON c.id = rs.id
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
			dueDate      sql.NullString
			birthDate    sql.NullString
		)
		if err := rows.Scan(&item.ID, &email, &item.SubjectKind, (*string)(&item.Source), &content, &questionText, &createdAt, &dueDate, &birthDate); err != nil {
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
		item.ChildStatusText = childStatusText(item.SubjectKind, dueDate, birthDate, item.CreatedAt)
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
