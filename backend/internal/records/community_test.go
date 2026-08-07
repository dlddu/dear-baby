package records

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/dlddu/dear-baby/backend/internal/users"
)

// newFeedHandlers builds a Handlers backed by a fresh in-memory DB with no
// users seeded — feed tests seed their own users / subjects / records so
// they can control authorship, visibility and subject kind precisely.
func newFeedHandlers(t *testing.T) (*Handlers, *sql.DB) {
	t.Helper()
	db := newTestDB(t)
	return &Handlers{
		Store: &Store{DB: db},
		Users: &users.Store{DB: db},
		UserIDFromCtxFn: func(r *http.Request) (string, bool) {
			v, _ := r.Context().Value(ctxKeyUser{}).(string)
			return v, v != ""
		},
	}, db
}

func seedFeedUser(t *testing.T, db *sql.DB, id, email string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO users (id, email) VALUES (?, ?)`, id, email); err != nil {
		t.Fatalf("seed user %s: %v", id, err)
	}
}

// seedSubject inserts a record_subjects row of the given kind and returns
// its id.
func seedSubject(t *testing.T, db *sql.DB, subjID, userID, kind string, ordinal int) string {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO record_subjects (id, user_id, kind, ordinal) VALUES (?, ?, ?, ?)`, subjID, userID, kind, ordinal); err != nil {
		t.Fatalf("seed subject %s: %v", subjID, err)
	}
	return subjID
}

// seedRecord inserts a record with an explicit created_at (SQLite datetime
// format) so ordering and cursor tests are deterministic.
func seedRecord(t *testing.T, db *sql.DB, id, userID, subjectID, content, visibility, createdAt string, questionText *string) {
	t.Helper()
	var q any
	if questionText != nil {
		q = *questionText
	}
	if _, err := db.Exec(`
		INSERT INTO records (id, user_id, subject_id, content, source, question_text, visibility, created_at)
		VALUES (?, ?, ?, ?, 'text', ?, ?, ?)
	`, id, userID, subjectID, content, q, visibility, createdAt); err != nil {
		t.Fatalf("seed record %s: %v", id, err)
	}
}

func getFeed(t *testing.T, h *Handlers, uid, query string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/v1/community/feed"+query, nil)
	if uid != "" {
		req = withUser(req, uid)
	}
	rec := httptest.NewRecorder()
	h.CommunityFeed(rec, req)
	return rec
}

func decodeFeed(t *testing.T, rec *httptest.ResponseRecorder) communityFeedResponse {
	t.Helper()
	var got communityFeedResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode feed: %v (body=%s)", err, rec.Body.String())
	}
	return got
}

// -- masking (AC-009-10 / TC-009-10) ----------------------------------------

func TestMaskDisplayName(t *testing.T) {
	cases := []struct {
		email string
		want  string
	}{
		{"seoul1@gmail.com", "seo***1"}, // 6 chars → first3 + *** + last1
		{"seoul@gmail.com", "seo***l"},  // 5 chars → first3 + *** + last1
		{"mom@gmail.com", "m***"},       // 3 chars → first1 + ***
		{"abcd@x.com", "a***"},          // 4 chars (boundary) → first1 + ***
		{"@x.com", "***"},               // empty local-part → ***
	}
	for _, c := range cases {
		if got := maskDisplayName(c.email); got != c.want {
			t.Errorf("maskDisplayName(%q) = %q, want %q", c.email, got, c.want)
		}
	}
}

// -- exposure pool (AC-009-01 / ENG-008 / ENG-010 / TC-009-01) ---------------

// TestCommunityFeed_ExposurePool asserts the feed shows only OTHER users'
// PUBLIC records whose subject kind matches the viewer's, excluding the
// viewer's own records, private records, and mismatched-kind records.
func TestCommunityFeed_ExposurePool(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()

	seedFeedUser(t, db, "viewer", "viewer1@x.com")
	seedFeedUser(t, db, "other", "otheruser@x.com")
	seedFeedUser(t, db, "child_author", "childmom@x.com")

	viewerSubj := seedSubject(t, db, "subj-viewer-f", "viewer", "fetus", 0)
	otherFetus := seedSubject(t, db, "subj-other-f", "other", "fetus", 0)
	childSubj := seedSubject(t, db, "subj-child-c", "child_author", "child", 0)

	// visible: other user's public fetus record
	seedRecord(t, db, "r-visible", "other", otherFetus, "보이는 공개 기록", "public", "2026-08-05 10:00:00", nil)
	// excluded: other user's private record
	seedRecord(t, db, "r-private", "other", otherFetus, "비공개 기록", "private", "2026-08-05 10:01:00", nil)
	// excluded: viewer's own public record (ENG-010)
	seedRecord(t, db, "r-own", "viewer", viewerSubj, "내 기록", "public", "2026-08-05 10:02:00", nil)
	// excluded: public record of the other (child) kind (ENG-008 no mixing)
	seedRecord(t, db, "r-childkind", "child_author", childSubj, "육아 공개 기록", "public", "2026-08-05 10:03:00", nil)

	rec := getFeed(t, h, "viewer", "?subject_id="+viewerSubj)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
	}
	got := decodeFeed(t, rec)
	if len(got.Items) != 1 {
		t.Fatalf("expected exactly 1 item, got %d: %+v", len(got.Items), got.Items)
	}
	item := got.Items[0]
	if item.ID != "r-visible" {
		t.Errorf("wrong item surfaced: got %q", item.ID)
	}
	if item.AuthorName != "oth***r" { // "otheruser" → first3 "oth" + *** + last1 "r"
		t.Errorf("author name not masked as expected: got %q", item.AuthorName)
	}
	if item.SubjectKind != "fetus" {
		t.Errorf("subject_kind: got %q want fetus", item.SubjectKind)
	}
	if item.Preview != "보이는 공개 기록" {
		t.Errorf("preview: got %q", item.Preview)
	}
}

// -- pagination (ENG-009 / TC-009-02) ---------------------------------------

func TestCommunityFeed_Pagination(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()

	seedFeedUser(t, db, "viewer", "viewer1@x.com")
	seedFeedUser(t, db, "other", "otheruser@x.com")
	viewerSubj := seedSubject(t, db, "subj-viewer-f", "viewer", "fetus", 0)
	otherSubj := seedSubject(t, db, "subj-other-f", "other", "fetus", 0)

	// 3 public records, ascending created_at; feed returns newest-first.
	seedRecord(t, db, "r1", "other", otherSubj, "첫 번째", "public", "2026-08-05 10:00:00", nil)
	seedRecord(t, db, "r2", "other", otherSubj, "두 번째", "public", "2026-08-05 11:00:00", nil)
	seedRecord(t, db, "r3", "other", otherSubj, "세 번째", "public", "2026-08-05 12:00:00", nil)

	// page 1: limit 2 → newest two (r3, r2) + a next cursor
	rec := getFeed(t, h, "viewer", "?subject_id="+viewerSubj+"&limit=2")
	page1 := decodeFeed(t, rec)
	if len(page1.Items) != 2 || page1.Items[0].ID != "r3" || page1.Items[1].ID != "r2" {
		t.Fatalf("page1 wrong: %+v", page1.Items)
	}
	if page1.NextCursor == "" {
		t.Fatal("page1 should have a next cursor")
	}

	// page 2: pass the cursor → the remaining oldest (r1) + empty cursor.
	// The cursor is a SQLite datetime with a space, so URL-encode it.
	rec = getFeed(t, h, "viewer", "?subject_id="+viewerSubj+"&limit=2&cursor="+url.QueryEscape(page1.NextCursor))
	page2 := decodeFeed(t, rec)
	if len(page2.Items) != 1 || page2.Items[0].ID != "r1" {
		t.Fatalf("page2 wrong: %+v", page2.Items)
	}
	if page2.NextCursor != "" {
		t.Errorf("page2 should be the last page, got cursor %q", page2.NextCursor)
	}
}

// -- input & auth guards ----------------------------------------------------

func TestCommunityFeed_RequiresSubjectID(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()
	seedFeedUser(t, db, "viewer", "viewer1@x.com")

	rec := getFeed(t, h, "viewer", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400", rec.Code)
	}
}

func TestCommunityFeed_ForeignSubject_400(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()
	seedFeedUser(t, db, "viewer", "viewer1@x.com")
	seedFeedUser(t, db, "other", "otheruser@x.com")
	foreign := seedSubject(t, db, "subj-other-f", "other", "fetus", 0)

	rec := getFeed(t, h, "viewer", "?subject_id="+foreign)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestCommunityFeed_Unauthorized(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()

	rec := getFeed(t, h, "", "?subject_id=whatever")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status: got %d want 401", rec.Code)
	}
}

// TestCommunityFeed_EmptyPool covers the AC-009-13 "no public records" empty
// state at the API boundary: a valid request against an empty pool returns
// 200 with an empty item list (not an error).
func TestCommunityFeed_EmptyPool(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()
	seedFeedUser(t, db, "viewer", "viewer1@x.com")
	viewerSubj := seedSubject(t, db, "subj-viewer-f", "viewer", "fetus", 0)

	rec := getFeed(t, h, "viewer", "?subject_id="+viewerSubj)
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", rec.Code)
	}
	got := decodeFeed(t, rec)
	if len(got.Items) != 0 {
		t.Errorf("expected empty pool, got %d items", len(got.Items))
	}
	if got.NextCursor != "" {
		t.Errorf("empty pool should have no cursor, got %q", got.NextCursor)
	}
}
