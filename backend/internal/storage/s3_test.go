package storage

import (
	"testing"
	"time"
)

func TestNormalisePrefix(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"", ""},
		{"/", ""},
		{"prod", "prod/"},
		{"prod/", "prod/"},
		{"/prod/", "prod/"},
		{"  staging  ", "staging/"},
		{"dev/alice", "dev/alice/"},
	}
	for _, tc := range cases {
		if got := normalisePrefix(tc.in); got != tc.want {
			t.Errorf("normalisePrefix(%q) = %q want %q", tc.in, got, tc.want)
		}
	}
}

func TestBuildRecordAudioKey(t *testing.T) {
	// 2026-05-09 14:30:00 UTC — chosen so single-digit month/day exercise
	// zero-padding, and a non-UTC input proves we normalise to UTC.
	utc := time.Date(2026, 5, 9, 14, 30, 0, 0, time.UTC)
	// Same instant expressed in KST (UTC+9). After UTC normalisation the
	// partition must still resolve to 2026-05-09 (14:30 UTC), not the
	// local 2026-05-09 23:30.
	kst := time.FixedZone("KST", 9*60*60)
	utcAsKST := utc.In(kst)

	cases := []struct {
		name                       string
		prefix, user, record, want string
		format                     AudioFormat
		createdAt                  time.Time
	}{
		{"empty prefix m4a", "", "u1", "r1", "year=2026/month=05/day=09/users/u1/records/r1.m4a", AudioFormatM4A, utc},
		{"prod prefix m4a", "prod/", "u1", "r1", "prod/year=2026/month=05/day=09/users/u1/records/r1.m4a", AudioFormatM4A, utc},
		{"nested prefix m4a", "dev/alice/", "u-2", "r-3", "dev/alice/year=2026/month=05/day=09/users/u-2/records/r-3.m4a", AudioFormatM4A, utc},
		{"empty prefix wav", "", "u1", "r1", "year=2026/month=05/day=09/users/u1/records/r1.wav", AudioFormatWAV, utc},
		{"prod prefix wav", "prod/", "u1", "r1", "prod/year=2026/month=05/day=09/users/u1/records/r1.wav", AudioFormatWAV, utc},
		{"non-UTC input normalised", "prod/", "u1", "r1", "prod/year=2026/month=05/day=09/users/u1/records/r1.m4a", AudioFormatM4A, utcAsKST},
	}
	for _, tc := range cases {
		c := &Client{Config: Config{KeyPrefix: tc.prefix}}
		if got := c.BuildRecordAudioKey(tc.user, tc.record, tc.format, tc.createdAt); got != tc.want {
			t.Errorf("%s: BuildRecordAudioKey = %q want %q", tc.name, got, tc.want)
		}
	}
}

func TestIsValidRecordAudioKey(t *testing.T) {
	c := &Client{Config: Config{KeyPrefix: "prod/"}}
	createdAt := time.Date(2026, 5, 9, 14, 30, 0, 0, time.UTC)
	m4a := c.BuildRecordAudioKey("u1", "r1", AudioFormatM4A, createdAt)
	wav := c.BuildRecordAudioKey("u1", "r1", AudioFormatWAV, createdAt)
	if !c.IsValidRecordAudioKey("u1", "r1", m4a, createdAt) {
		t.Errorf("expected %q to be valid for u1/r1", m4a)
	}
	if !c.IsValidRecordAudioKey("u1", "r1", wav, createdAt) {
		t.Errorf("expected %q to be valid for u1/r1", wav)
	}
	// Wrong user.
	if c.IsValidRecordAudioKey("u2", "r1", m4a, createdAt) {
		t.Errorf("expected %q to be invalid for u2/r1", m4a)
	}
	if c.IsValidRecordAudioKey("u2", "r1", wav, createdAt) {
		t.Errorf("expected %q to be invalid for u2/r1", wav)
	}
	// Wrong record.
	if c.IsValidRecordAudioKey("u1", "r2", m4a, createdAt) {
		t.Errorf("expected %q to be invalid for u1/r2", m4a)
	}
	// Wrong creation date — partition must match.
	otherDay := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	if c.IsValidRecordAudioKey("u1", "r1", m4a, otherDay) {
		t.Errorf("expected %q to be invalid when validated against a different day", m4a)
	}
	// Empty rejected.
	if c.IsValidRecordAudioKey("u1", "r1", "", createdAt) {
		t.Errorf("empty key should be invalid")
	}
	// Legacy unpartitioned key rejected.
	if c.IsValidRecordAudioKey("u1", "r1", "prod/users/u1/records/r1.m4a", createdAt) {
		t.Errorf("legacy unpartitioned key should be invalid")
	}
	// Path traversal / hand-rolled key rejected (different prefix).
	if c.IsValidRecordAudioKey("u1", "r1", "year=2026/month=05/day=09/users/u1/records/r1.m4a", createdAt) {
		t.Errorf("key without configured prefix should be invalid")
	}
	// Unknown extension rejected — the canonical format is .m4a or .wav.
	if c.IsValidRecordAudioKey("u1", "r1", "prod/year=2026/month=05/day=09/users/u1/records/r1.mp3", createdAt) {
		t.Errorf("unsupported extension should be invalid")
	}
}

func TestParseAudioFormat(t *testing.T) {
	cases := []struct {
		in       string
		want     AudioFormat
		wantOK   bool
		wantExt  string
		wantType string
	}{
		{"", AudioFormatM4A, true, ".m4a", "audio/mp4"},
		{"m4a", AudioFormatM4A, true, ".m4a", "audio/mp4"},
		{"wav", AudioFormatWAV, true, ".wav", "audio/wav"},
		{"mp3", "", false, "", ""},
		{"WAV", "", false, "", ""}, // case-sensitive on the wire
	}
	for _, tc := range cases {
		got, ok := ParseAudioFormat(tc.in)
		if ok != tc.wantOK || got != tc.want {
			t.Errorf("ParseAudioFormat(%q) = (%q,%v) want (%q,%v)",
				tc.in, got, ok, tc.want, tc.wantOK)
			continue
		}
		if !ok {
			continue
		}
		if ext := got.Extension(); ext != tc.wantExt {
			t.Errorf("Extension(%q) = %q want %q", got, ext, tc.wantExt)
		}
		if ct := got.ContentType(); ct != tc.wantType {
			t.Errorf("ContentType(%q) = %q want %q", got, ct, tc.wantType)
		}
	}
}

func TestConfigValidate(t *testing.T) {
	cases := []struct {
		name    string
		c       Config
		wantErr bool
	}{
		{"ok", Config{Region: "ap-northeast-2", Bucket: "b"}, false},
		{"no region", Config{Bucket: "b"}, true},
		{"no bucket", Config{Region: "us-east-1"}, true},
	}
	for _, tc := range cases {
		err := tc.c.Validate()
		if (err != nil) != tc.wantErr {
			t.Errorf("%s: err=%v wantErr=%v", tc.name, err, tc.wantErr)
		}
	}
}
