package storage

import "testing"

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
	cases := []struct {
		prefix, user, record, want string
		format                     AudioFormat
	}{
		{"", "u1", "r1", "users/u1/records/r1.m4a", AudioFormatM4A},
		{"prod/", "u1", "r1", "prod/users/u1/records/r1.m4a", AudioFormatM4A},
		{"dev/alice/", "u-2", "r-3", "dev/alice/users/u-2/records/r-3.m4a", AudioFormatM4A},
		{"", "u1", "r1", "users/u1/records/r1.wav", AudioFormatWAV},
		{"prod/", "u1", "r1", "prod/users/u1/records/r1.wav", AudioFormatWAV},
	}
	for _, tc := range cases {
		c := &Client{Config: Config{KeyPrefix: tc.prefix}}
		if got := c.BuildRecordAudioKey(tc.user, tc.record, tc.format); got != tc.want {
			t.Errorf("BuildRecordAudioKey(%q,%q,%q,%q) = %q want %q",
				tc.prefix, tc.user, tc.record, tc.format, got, tc.want)
		}
	}
}

func TestIsValidRecordAudioKey(t *testing.T) {
	c := &Client{Config: Config{KeyPrefix: "prod/"}}
	m4a := c.BuildRecordAudioKey("u1", "r1", AudioFormatM4A)
	wav := c.BuildRecordAudioKey("u1", "r1", AudioFormatWAV)
	if !c.IsValidRecordAudioKey("u1", "r1", m4a) {
		t.Errorf("expected %q to be valid for u1/r1", m4a)
	}
	if !c.IsValidRecordAudioKey("u1", "r1", wav) {
		t.Errorf("expected %q to be valid for u1/r1", wav)
	}
	// Wrong user.
	if c.IsValidRecordAudioKey("u2", "r1", m4a) {
		t.Errorf("expected %q to be invalid for u2/r1", m4a)
	}
	if c.IsValidRecordAudioKey("u2", "r1", wav) {
		t.Errorf("expected %q to be invalid for u2/r1", wav)
	}
	// Wrong record.
	if c.IsValidRecordAudioKey("u1", "r2", m4a) {
		t.Errorf("expected %q to be invalid for u1/r2", m4a)
	}
	// Empty rejected.
	if c.IsValidRecordAudioKey("u1", "r1", "") {
		t.Errorf("empty key should be invalid")
	}
	// Path traversal / hand-rolled key rejected (different prefix).
	if c.IsValidRecordAudioKey("u1", "r1", "users/u1/records/r1.m4a") {
		t.Errorf("key without configured prefix should be invalid")
	}
	// Unknown extension rejected — the canonical format is .m4a or .wav.
	if c.IsValidRecordAudioKey("u1", "r1", "prod/users/u1/records/r1.mp3") {
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

func TestParseImageFormat(t *testing.T) {
	cases := []struct {
		in       string
		want     ImageFormat
		wantOK   bool
		wantExt  string
		wantType string
	}{
		{"jpeg", ImageFormatJPEG, true, ".jpg", "image/jpeg"},
		{"jpg", ImageFormatJPEG, true, ".jpg", "image/jpeg"},
		{"heic", ImageFormatHEIC, true, ".heic", "image/heic"},
		{"heif", ImageFormatHEIC, true, ".heic", "image/heic"},
		{"png", ImageFormatPNG, true, ".png", "image/png"},
		{"", "", false, "", ""}, // no historical default — wire value is required
		{"gif", "", false, "", ""},
	}
	for _, tc := range cases {
		got, ok := ParseImageFormat(tc.in)
		if ok != tc.wantOK || got != tc.want {
			t.Errorf("ParseImageFormat(%q) = (%q,%v) want (%q,%v)",
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

func TestBuildChildPhotoKeys(t *testing.T) {
	c := &Client{Config: Config{KeyPrefix: "prod/"}}
	tmp := c.BuildChildPhotoTmpKey("u1", "abc-123", ImageFormatJPEG)
	if tmp != "prod/users/u1/onboarding-tmp/abc-123.jpg" {
		t.Errorf("tmp key: %q", tmp)
	}
	perm := c.BuildChildPhotoKey("u1", "child-1", "heic")
	if perm != "prod/users/u1/children/child-1/photo.heic" {
		t.Errorf("perm key: %q", perm)
	}
}

func TestIsValidChildPhotoTmpKey(t *testing.T) {
	c := &Client{Config: Config{KeyPrefix: "prod/"}}
	good := c.BuildChildPhotoTmpKey("u1", "abc", ImageFormatJPEG)
	if !c.IsValidChildPhotoTmpKey("u1", good) {
		t.Errorf("expected %q to be valid for u1", good)
	}
	// Wrong user.
	if c.IsValidChildPhotoTmpKey("u2", good) {
		t.Errorf("expected %q to be invalid for u2", good)
	}
	// Empty rejected.
	if c.IsValidChildPhotoTmpKey("u1", "") {
		t.Errorf("empty key should be invalid")
	}
	// Wrong prefix (no env prefix).
	if c.IsValidChildPhotoTmpKey("u1", "users/u1/onboarding-tmp/abc.jpg") {
		t.Errorf("key without configured prefix should be invalid")
	}
	// Subdirectory rejected (path traversal).
	if c.IsValidChildPhotoTmpKey("u1", "prod/users/u1/onboarding-tmp/sub/abc.jpg") {
		t.Errorf("subdir tmp key should be invalid")
	}
	// Permanent prefix rejected.
	if c.IsValidChildPhotoTmpKey("u1", "prod/users/u1/children/c1/photo.jpg") {
		t.Errorf("permanent key should not pass tmp validator")
	}
	// Unsupported extension rejected.
	if c.IsValidChildPhotoTmpKey("u1", "prod/users/u1/onboarding-tmp/abc.gif") {
		t.Errorf("gif should be rejected")
	}
	// Missing extension rejected.
	if c.IsValidChildPhotoTmpKey("u1", "prod/users/u1/onboarding-tmp/abc") {
		t.Errorf("missing extension should be rejected")
	}
}

func TestPhotoExtensionFromTmpKey(t *testing.T) {
	c := &Client{Config: Config{KeyPrefix: "prod/"}}
	cases := []struct {
		key      string
		want     string
		wantOK   bool
	}{
		{"prod/users/u1/onboarding-tmp/abc.jpg", "jpg", true},
		{"prod/users/u1/onboarding-tmp/abc.HEIC", "heic", true},
		{"prod/users/u1/onboarding-tmp/abc.png", "png", true},
		{"prod/users/u1/onboarding-tmp/abc.gif", "", false},
		{"no-extension", "", false},
		{"trailing.", "", false},
	}
	for _, tc := range cases {
		got, ok := c.PhotoExtensionFromTmpKey(tc.key)
		if ok != tc.wantOK || got != tc.want {
			t.Errorf("PhotoExtensionFromTmpKey(%q) = (%q,%v) want (%q,%v)",
				tc.key, got, ok, tc.want, tc.wantOK)
		}
	}
}

func TestEscapePathSegments(t *testing.T) {
	cases := []struct{ in, want string }{
		{"users/u1/onboarding-tmp/abc.jpg", "users/u1/onboarding-tmp/abc.jpg"},
		{"users/u1/onboarding-tmp/space file.jpg", "users/u1/onboarding-tmp/space%20file.jpg"},
	}
	for _, tc := range cases {
		if got := escapePathSegments(tc.in); got != tc.want {
			t.Errorf("escapePathSegments(%q) = %q want %q", tc.in, got, tc.want)
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
