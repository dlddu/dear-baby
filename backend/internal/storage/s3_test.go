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
		{"", ImageFormatJPEG, true, ".jpg", "image/jpeg"},
		{"jpeg", ImageFormatJPEG, true, ".jpg", "image/jpeg"},
		{"jpg", ImageFormatJPEG, true, ".jpg", "image/jpeg"},
		{"png", ImageFormatPNG, true, ".png", "image/png"},
		{"heic", ImageFormatHEIC, true, ".heic", "image/heic"},
		{"heif", ImageFormatHEIC, true, ".heic", "image/heic"},
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

func TestBuildChildPhotoTmpKey(t *testing.T) {
	c := &Client{Config: Config{KeyPrefix: "prod/"}}
	got := c.BuildChildPhotoTmpKey("u1", "abcd1234", ImageFormatJPEG)
	if got != "prod/users/u1/onboarding-tmp/abcd1234.jpg" {
		t.Errorf("got %q", got)
	}
}

func TestBuildChildPhotoKey(t *testing.T) {
	c := &Client{Config: Config{KeyPrefix: "prod/"}}
	got := c.BuildChildPhotoKey("u1", "child-1", ImageFormatHEIC)
	if got != "prod/users/u1/children/child-1/photo.heic" {
		t.Errorf("got %q", got)
	}
}

func TestIsValidChildPhotoTmpKey(t *testing.T) {
	c := &Client{Config: Config{KeyPrefix: "prod/"}}
	cases := []struct {
		userID, key string
		want        bool
	}{
		{"u1", "prod/users/u1/onboarding-tmp/x.jpg", true},
		{"u1", "prod/users/u1/onboarding-tmp/x.JPEG", true},
		{"u1", "prod/users/u1/onboarding-tmp/x.heic", true},
		{"u1", "prod/users/u1/onboarding-tmp/x.png", true},
		// Wrong user — must reject so a client cannot point at someone else's
		// tmp object.
		{"u1", "prod/users/u2/onboarding-tmp/x.jpg", false},
		// Permanent prefix is not the tmp prefix.
		{"u1", "prod/users/u1/children/u1/photo.jpg", false},
		// Path traversal between subfolders.
		{"u1", "prod/users/u1/onboarding-tmp/sub/x.jpg", false},
		// Unknown extension.
		{"u1", "prod/users/u1/onboarding-tmp/x.gif", false},
		// Empty.
		{"u1", "", false},
	}
	for _, tc := range cases {
		if got := c.IsValidChildPhotoTmpKey(tc.userID, tc.key); got != tc.want {
			t.Errorf("IsValidChildPhotoTmpKey(%q,%q)=%v want %v", tc.userID, tc.key, got, tc.want)
		}
	}
}

func TestImageFormatFromKey(t *testing.T) {
	cases := []struct {
		key  string
		want ImageFormat
		ok   bool
	}{
		{"a/b.jpg", ImageFormatJPEG, true},
		{"a/b.JPEG", ImageFormatJPEG, true},
		{"a/b.png", ImageFormatPNG, true},
		{"a/b.heic", ImageFormatHEIC, true},
		{"a/b.heif", ImageFormatHEIC, true},
		{"a/b.gif", "", false},
	}
	for _, tc := range cases {
		got, ok := ImageFormatFromKey(tc.key)
		if got != tc.want || ok != tc.ok {
			t.Errorf("ImageFormatFromKey(%q)=(%q,%v) want (%q,%v)", tc.key, got, ok, tc.want, tc.ok)
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
