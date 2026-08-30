package records

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

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

// -- 아이 현황 (AC-009-14 카드의 "임신 N주차 / 생후 N개월" · ENG-011 + ENG-001) --

// seedFetusProfile / seedChildProfile attach the profile row a subject's
// stage is derived from. Migration 0012 makes fetuses.id / children.id equal
// the record_subjects.id, and the feed query joins on exactly that.
func seedFetusProfile(t *testing.T, db *sql.DB, subjID, userID string, ordinal int, dueDate any) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO fetuses (id, user_id, ordinal, due_date) VALUES (?, ?, ?, ?)`, subjID, userID, ordinal, dueDate); err != nil {
		t.Fatalf("seed fetus profile %s: %v", subjID, err)
	}
}

func seedChildProfile(t *testing.T, db *sql.DB, subjID, userID string, ordinal int, birthDate any) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO children (id, user_id, ordinal, birth_date) VALUES (?, ?, ?, ?)`, subjID, userID, ordinal, birthDate); err != nil {
		t.Fatalf("seed child profile %s: %v", subjID, err)
	}
}

func TestChildStatusText(t *testing.T) {
	// 기록 작성일을 고정해 두고 (ENG-011: 기준 시점 = 작성 당시) 프로필 날짜만
	// 흔든다. 작성자의 "지금" 은 어떤 케이스에서도 개입하지 않아야 한다.
	recordedAt := time.Date(2026, 8, 7, 9, 30, 0, 0, time.UTC)
	str := func(v string) sql.NullString { return sql.NullString{String: v, Valid: true} }
	null := sql.NullString{}

	cases := []struct {
		name      string
		kind      string
		dueDate   sql.NullString
		birthDate sql.NullString
		want      string
	}{
		// 280 - (due - 작성일) = 280 - 140 = 140일 → 20주.
		{"임신 20주차", "fetus", str("2026-12-25"), null, "임신 20주차"},
		// 예정일 당일 → daysPregnant = 280 → 40주.
		{"예정일 당일은 40주차", "fetus", str("2026-08-07"), null, "임신 40주차"},
		// 5주 이내 과거 예정일은 아직 표시한다 (ENG-001 경계값 표).
		{"예정일 4주 경과", "fetus", str("2026-07-10"), null, "임신 44주차"},
		// 5주 이상 과거 → 방치된 프로필로 보고 배지를 숨긴다.
		{"예정일 6주 경과는 숨김", "fetus", str("2026-06-26"), null, ""},
		// 45주 초과 미래 → Stage 1 피커가 막는 범위 밖.
		{"45주 초과 미래는 숨김", "fetus", str("2027-07-01"), null, ""},
		// 40주보다 먼 미래 예정일 → daysPregnant 음수를 0 으로 clamp.
		{"만삭 이전은 0주로 clamp", "fetus", str("2027-06-01"), null, "임신 0주차"},
		{"예정일 미설정은 숨김", "fetus", null, null, ""},
		{"예정일 파싱 불가는 숨김", "fetus", str("2026/12/25"), null, ""},

		{"생후 5개월", "child", null, str("2026-03-07"), "생후 5개월"},
		// 같은 day-of-month 가 아직 안 지났으면 한 달 깎는다.
		{"생일 도래 전은 한 달 적게", "child", null, str("2026-03-08"), "생후 4개월"},
		{"당일 출생은 0개월", "child", null, str("2026-08-07"), "생후 0개월"},
		// 12개월까지는 개월, 13개월부터 살 — 앱 childLabel 과 같은 경계.
		{"12개월은 개월 표기", "child", null, str("2025-08-07"), "생후 12개월"},
		{"13개월은 1살", "child", null, str("2025-07-07"), "1살"},
		{"4살", "child", null, str("2022-01-07"), "4살"},
		{"미래 생일은 숨김", "child", null, str("2026-09-01"), ""},
		{"생일 미설정은 숨김", "child", null, null, ""},

		{"알 수 없는 kind 는 숨김", "unknown", str("2026-12-25"), str("2026-03-07"), ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := childStatusText(c.kind, c.dueDate, c.birthDate, recordedAt); got != c.want {
				t.Fatalf("childStatusText(%s) = %q, want %q", c.kind, got, c.want)
			}
		})
	}
}

func TestChildStatusTextUsesRecordDateNotToday(t *testing.T) {
	// 같은 예정일이라도 언제 쓴 글이냐에 따라 단계가 달라야 한다 — ENG-011 의
	// "작성 당시 단계" 규칙이 지켜지는지 직접 잠근다.
	due := sql.NullString{String: "2026-12-25", Valid: true}
	early := childStatusText("fetus", due, sql.NullString{}, time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC))
	late := childStatusText("fetus", due, sql.NullString{}, time.Date(2026, 8, 7, 0, 0, 0, 0, time.UTC))
	if early == late {
		t.Fatalf("stage should differ by write date, got %q for both", early)
	}
	if early != "임신 6주차" {
		t.Fatalf("early = %q, want 임신 6주차", early)
	}
	if late != "임신 20주차" {
		t.Fatalf("late = %q, want 임신 20주차", late)
	}
}

func TestCommunityFeedIncludesChildStatusText(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()
	seedFeedUser(t, db, "viewer", "viewer@example.com")
	seedFeedUser(t, db, "author", "seoyeon1@example.com")
	viewerSubj := seedSubject(t, db, "subj-viewer", "viewer", "fetus", 0)
	authorSubj := seedSubject(t, db, "subj-author", "author", "fetus", 0)
	seedFetusProfile(t, db, viewerSubj, "viewer", 0, "2026-11-01")
	seedFetusProfile(t, db, authorSubj, "author", 0, "2026-12-25")
	seedRecord(t, db, "rec-1", "author", authorSubj, "오늘은 태동이 유난히 셌어", "public", "2026-08-07 09:30:00", nil)

	rec := getFeed(t, h, "viewer", "?subject_id="+url.QueryEscape(viewerSubj))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rec.Code, rec.Body.String())
	}
	got := decodeFeed(t, rec)
	if len(got.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(got.Items))
	}
	if got.Items[0].ChildStatusText != "임신 20주차" {
		t.Fatalf("child_status_text = %q, want 임신 20주차", got.Items[0].ChildStatusText)
	}
	// 마스킹은 그대로 — 현황이 붙었다고 작성자 식별 정보가 새면 안 된다.
	if got.Items[0].AuthorName != "seo***1" {
		t.Fatalf("author_name = %q, want seo***1", got.Items[0].AuthorName)
	}
}

func TestCommunityFeedWithoutProfileRowStillReturnsRecord(t *testing.T) {
	// 프로필 행이 없어도 (레거시 subject) 기록은 사라지지 않고 현황만 빈다 —
	// LEFT JOIN 이 INNER 로 바뀌면 이 테스트가 잡는다.
	h, db := newFeedHandlers(t)
	defer db.Close()
	seedFeedUser(t, db, "viewer", "viewer@example.com")
	seedFeedUser(t, db, "author", "author@example.com")
	viewerSubj := seedSubject(t, db, "subj-viewer", "viewer", "child", 0)
	authorSubj := seedSubject(t, db, "subj-author", "author", "child", 0)
	seedChildProfile(t, db, viewerSubj, "viewer", 0, "2026-01-01")
	seedRecord(t, db, "rec-1", "author", authorSubj, "첫 이유식을 먹었다", "public", "2026-08-07 09:30:00", nil)

	rec := getFeed(t, h, "viewer", "?subject_id="+url.QueryEscape(viewerSubj))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body=%s)", rec.Code, rec.Body.String())
	}
	got := decodeFeed(t, rec)
	if len(got.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(got.Items))
	}
	if got.Items[0].ChildStatusText != "" {
		t.Fatalf("child_status_text = %q, want empty", got.Items[0].ChildStatusText)
	}
}

// -- 콘텐츠 타입 필터 (AC-009-06) -------------------------------------------

// seedTypeMixedPool seeds one viewer plus another author holding one 질문답변
// record and one 자유일기 record, and returns the viewer's subject id. The
// 자유일기 rows deliberately cover both shapes the column can take — NULL and
// the empty string — because the app's createRecord omits question_text
// entirely while a stray caller could still send "".
func seedTypeMixedPool(t *testing.T, db *sql.DB) string {
	t.Helper()
	seedFeedUser(t, db, "viewer", "viewer1@x.com")
	seedFeedUser(t, db, "other", "otheruser@x.com")
	viewerSubj := seedSubject(t, db, "subj-viewer-f", "viewer", "fetus", 0)
	otherSubj := seedSubject(t, db, "subj-other-f", "other", "fetus", 0)

	q := "엄마, 오늘 저를 처음 알게 된 기분은 어땠어요?"
	empty := ""
	seedRecord(t, db, "r-diary-null", "other", otherSubj, "자유 일기 본문", "public", "2026-08-05 10:00:00", nil)
	seedRecord(t, db, "r-question", "other", otherSubj, "질문 답변 본문", "public", "2026-08-05 11:00:00", &q)
	seedRecord(t, db, "r-diary-empty", "other", otherSubj, "빈 질문 자유 일기", "public", "2026-08-05 12:00:00", &empty)
	return viewerSubj
}

func feedIDs(items []FeedItem) []string {
	out := make([]string, 0, len(items))
	for _, it := range items {
		out = append(out, it.ID)
	}
	return out
}

func TestCommunityFeed_ContentTypeFilter(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()
	viewerSubj := seedTypeMixedPool(t, db)

	cases := []struct {
		name  string
		query string
		want  []string
	}{
		// AC-009-06 기본 선택값은 `전체` — type 을 아예 넘기지 않은 요청이
		// 필터 이전과 같은 응답을 내야 한다.
		{"default is 전체", "", []string{"r-diary-empty", "r-question", "r-diary-null"}},
		{"explicit all", "&type=all", []string{"r-diary-empty", "r-question", "r-diary-null"}},
		{"질문답변만", "&type=question", []string{"r-question"}},
		{"자유일기만", "&type=diary", []string{"r-diary-empty", "r-diary-null"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := getFeed(t, h, "viewer", "?subject_id="+viewerSubj+tc.query)
			if rec.Code != http.StatusOK {
				t.Fatalf("status: got %d body=%s", rec.Code, rec.Body.String())
			}
			got := feedIDs(decodeFeed(t, rec).Items)
			if len(got) != len(tc.want) {
				t.Fatalf("ids: got %v want %v", got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("ids: got %v want %v", got, tc.want)
				}
			}
		})
	}
}

// An unknown type must not silently degrade to 전체 — a client typo would
// then render a feed that looks filtered but isn't.
func TestCommunityFeed_InvalidContentType_400(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()
	viewerSubj := seedTypeMixedPool(t, db)

	rec := getFeed(t, h, "viewer", "?subject_id="+viewerSubj+"&type=bogus")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400 (body=%s)", rec.Code, rec.Body.String())
	}
}

// The keyset cursor must walk the FILTERED pool, not the whole one:
// otherwise page 2 of a 자유일기 feed would skip past 자유일기 rows that a
// 질문답변 row happened to sit between.
func TestCommunityFeed_ContentTypeFilterPaginates(t *testing.T) {
	h, db := newFeedHandlers(t)
	defer db.Close()

	seedFeedUser(t, db, "viewer", "viewer1@x.com")
	seedFeedUser(t, db, "other", "otheruser@x.com")
	viewerSubj := seedSubject(t, db, "subj-viewer-f", "viewer", "fetus", 0)
	otherSubj := seedSubject(t, db, "subj-other-f", "other", "fetus", 0)

	q := "오늘의 질문"
	// Interleaved so a whole-pool cursor would produce a different page 2.
	seedRecord(t, db, "d1", "other", otherSubj, "자유 1", "public", "2026-08-05 10:00:00", nil)
	seedRecord(t, db, "q1", "other", otherSubj, "질문 1", "public", "2026-08-05 11:00:00", &q)
	seedRecord(t, db, "d2", "other", otherSubj, "자유 2", "public", "2026-08-05 12:00:00", nil)
	seedRecord(t, db, "q2", "other", otherSubj, "질문 2", "public", "2026-08-05 13:00:00", &q)
	seedRecord(t, db, "d3", "other", otherSubj, "자유 3", "public", "2026-08-05 14:00:00", nil)

	rec := getFeed(t, h, "viewer", "?subject_id="+viewerSubj+"&type=diary&limit=2")
	page1 := decodeFeed(t, rec)
	if got := feedIDs(page1.Items); len(got) != 2 || got[0] != "d3" || got[1] != "d2" {
		t.Fatalf("page1: got %v want [d3 d2]", got)
	}
	if page1.NextCursor == "" {
		t.Fatal("page1 should have a next cursor")
	}

	rec = getFeed(t, h, "viewer", "?subject_id="+viewerSubj+"&type=diary&limit=2&cursor="+url.QueryEscape(page1.NextCursor))
	page2 := decodeFeed(t, rec)
	if got := feedIDs(page2.Items); len(got) != 1 || got[0] != "d1" {
		t.Fatalf("page2: got %v want [d1]", got)
	}
	if page2.NextCursor != "" {
		t.Errorf("page2 should be the last page, got cursor %q", page2.NextCursor)
	}
}

func TestParseFeedContentType(t *testing.T) {
	cases := []struct {
		raw   string
		want  FeedContentType
		valid bool
	}{
		{"", FeedTypeAll, true},
		{"all", FeedTypeAll, true},
		{"question", FeedTypeQuestion, true},
		{"diary", FeedTypeDiary, true},
		{"All", "", false},
		{"질문답변", "", false},
		{"bogus", "", false},
	}
	for _, tc := range cases {
		got, ok := ParseFeedContentType(tc.raw)
		if ok != tc.valid || (ok && got != tc.want) {
			t.Errorf("ParseFeedContentType(%q) = (%q, %v), want (%q, %v)", tc.raw, got, ok, tc.want, tc.valid)
		}
	}
}
