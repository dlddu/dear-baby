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
	}{
		{"", "u1", "r1", "users/u1/records/r1.m4a"},
		{"prod/", "u1", "r1", "prod/users/u1/records/r1.m4a"},
		{"dev/alice/", "u-2", "r-3", "dev/alice/users/u-2/records/r-3.m4a"},
	}
	for _, tc := range cases {
		c := &Client{Config: Config{KeyPrefix: tc.prefix}}
		if got := c.BuildRecordAudioKey(tc.user, tc.record); got != tc.want {
			t.Errorf("BuildRecordAudioKey(%q,%q,%q) = %q want %q",
				tc.prefix, tc.user, tc.record, got, tc.want)
		}
	}
}

func TestIsValidRecordAudioKey(t *testing.T) {
	c := &Client{Config: Config{KeyPrefix: "prod/"}}
	good := c.BuildRecordAudioKey("u1", "r1")
	if !c.IsValidRecordAudioKey("u1", "r1", good) {
		t.Errorf("expected %q to be valid for u1/r1", good)
	}
	// Wrong user.
	if c.IsValidRecordAudioKey("u2", "r1", good) {
		t.Errorf("expected %q to be invalid for u2/r1", good)
	}
	// Wrong record.
	if c.IsValidRecordAudioKey("u1", "r2", good) {
		t.Errorf("expected %q to be invalid for u1/r2", good)
	}
	// Empty rejected.
	if c.IsValidRecordAudioKey("u1", "r1", "") {
		t.Errorf("empty key should be invalid")
	}
	// Path traversal / hand-rolled key rejected (different prefix).
	if c.IsValidRecordAudioKey("u1", "r1", "users/u1/records/r1.m4a") {
		t.Errorf("key without configured prefix should be invalid")
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
