package storage

import "testing"

func TestNormalizePrefix(t *testing.T) {
	cases := map[string]string{
		"":            "",
		"prod":        "prod",
		"prod/":       "prod",
		"prod//":      "prod",
		"dev/alice/":  "dev/alice",
		"dev/alice//": "dev/alice",
	}
	for in, want := range cases {
		if got := NormalizePrefix(in); got != want {
			t.Errorf("NormalizePrefix(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestBuildRecordAudioKey(t *testing.T) {
	cases := []struct {
		name   string
		prefix string
		user   string
		record string
		want   string
	}{
		{"empty prefix", "", "u1", "r1", "users/u1/records/r1.m4a"},
		{"single prefix", "prod", "u1", "r1", "prod/users/u1/records/r1.m4a"},
		{"nested prefix", "dev/alice", "u-2", "r-3", "dev/alice/users/u-2/records/r-3.m4a"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := S3Config{Prefix: tc.prefix}
			if got := cfg.BuildRecordAudioKey(tc.user, tc.record); got != tc.want {
				t.Errorf("BuildRecordAudioKey = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestS3Config_Validate(t *testing.T) {
	t.Run("missing region", func(t *testing.T) {
		c := S3Config{Bucket: "b"}
		if err := c.Validate(); err == nil {
			t.Error("expected error for missing region")
		}
	})
	t.Run("missing bucket", func(t *testing.T) {
		c := S3Config{Region: "ap-northeast-2"}
		if err := c.Validate(); err == nil {
			t.Error("expected error for missing bucket")
		}
	})
	t.Run("ok without role", func(t *testing.T) {
		c := S3Config{Region: "ap-northeast-2", Bucket: "b"}
		if err := c.Validate(); err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})
}
